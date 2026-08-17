export const GOOGLE_SUBJECT_CLAIM = "googleSubject";

function normaliseNonEmptyString(value) {
  if (typeof value !== "string") return null;

  const normalised = value.trim();
  return normalised.length > 0 ? normalised : null;
}

export function createAuthIdentityService({
  connectToDatabase,
  findGoogleIdentityByEmail,
  findUserByGoogleId,
  createUser,
  updateUserByGoogleId,
}) {
  async function addGoogleSubjectToToken({ token, account } = {}) {
    const providerSubject = account?.provider === "google"
      ? normaliseNonEmptyString(account.providerAccountId)
      : null;

    if (providerSubject) {
      return {
        ...token,
        [GOOGLE_SUBJECT_CLAIM]: providerSubject,
      };
    }

    if (Object.hasOwn(token || {}, GOOGLE_SUBJECT_CLAIM)) {
      return token;
    }

    if (account) return token;

    const email = normaliseNonEmptyString(token?.email);
    if (!email) return token;

    await connectToDatabase();
    const persistedIdentity = await findGoogleIdentityByEmail(email);
    return {
      ...token,
      [GOOGLE_SUBJECT_CLAIM]: normaliseNonEmptyString(
        persistedIdentity?.googleId
      ),
    };
  }

  async function applyGoogleSubjectToSession({ session, token } = {}) {
    if (!session?.user) return session;

    delete session.user.id;
    const googleSubject = normaliseNonEmptyString(
      token?.[GOOGLE_SUBJECT_CLAIM]
    );
    if (googleSubject) {
      session.user.id = googleSubject;
    }

    return session;
  }

  async function persistGoogleSignIn({ user, account } = {}) {
    if (account?.provider !== "google") return;

    const googleId = normaliseNonEmptyString(account.providerAccountId);
    if (!googleId) {
      throw new Error("Google did not provide a canonical account identifier.");
    }

    await connectToDatabase();
    const existingUser = await findUserByGoogleId(googleId);

    if (!existingUser) {
      await createUser({
        name: user?.name,
        email: user?.email,
        profilePicture: user?.image,
        googleId,
        displayName: user?.name || "",
        bio: "",
        location: "",
      });
      return;
    }

    await updateUserByGoogleId(googleId, { name: user?.name });
  }

  return {
    addGoogleSubjectToToken,
    applyGoogleSubjectToSession,
    persistGoogleSignIn,
  };
}
