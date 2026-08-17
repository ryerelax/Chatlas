export const GOOGLE_SUBJECT_CLAIM = "googleSubject";

function normaliseNonEmptyString(value) {
  if (typeof value !== "string") return null;

  const normalised = value.trim();
  return normalised.length > 0 ? normalised : null;
}

export function createAuthIdentityService({
  connectToDatabase,
  findGoogleIdentityByEmail,
  upsertUserByGoogleId,
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
    const persistedUser = await upsertUserByGoogleId({
      googleId,
      name: user?.name,
      email: user?.email,
      profilePicture: user?.image,
      displayName: user?.name || "",
      bio: "",
      location: "",
    });

    if (
      !persistedUser?._id ||
      persistedUser.googleId !== googleId
    ) {
      throw new Error("Unable to assert the persisted Google identity.");
    }
  }

  return {
    addGoogleSubjectToToken,
    applyGoogleSubjectToSession,
    persistGoogleSignIn,
  };
}

export function createAuthConfig({
  providers,
  secret,
  authIdentityService,
  connectToDatabase,
  findUserByGoogleId,
  logError = console.error,
}) {
  return {
    providers,
    pages: {
      signIn: "/login",
    },
    secret,
    callbacks: {
      async signIn({ user, account }) {
        if (account?.provider === "google") {
          try {
            await authIdentityService.persistGoogleSignIn({ user, account });
            return true;
          } catch {
            logError("Unable to save the signed-in Google user.");
            return false;
          }
        }
        return true;
      },
      async jwt({ token, account }) {
        return authIdentityService.addGoogleSubjectToToken({ token, account });
      },
      async session({ session, token }) {
        try {
          await authIdentityService.applyGoogleSubjectToSession({
            session,
            token,
          });

          const googleId = session?.user?.id;
          if (!googleId) return session;

          await connectToDatabase();
          const user = await findUserByGoogleId(googleId);
          if (user) {
            session.user.image = user.profilePicture || session.user.image;
            session.user.name = user.displayName || user.name;
            session.user.displayName = user.displayName || user.name;
            session.user.bio = user.bio || "";
            session.user.location = user.location || "";
          }
        } catch {
          logError("Unable to load the signed-in user profile.");
        }

        return session;
      },
    },
  };
}
