import assert from "node:assert/strict";
import test from "node:test";
import {
  createAuthConfig,
  createAuthIdentityService,
} from "../src/business/services/authIdentityService.js";

function createConfiguredAuth({ upsertUserByGoogleId, logError } = {}) {
  const authIdentityService = createAuthIdentityService({
    connectToDatabase: async () => {},
    findGoogleIdentityByEmail: async () => null,
    upsertUserByGoogleId:
      upsertUserByGoogleId ??
      (async (input) => ({
        _id: "persisted-user-id",
        googleId: input.googleId,
      })),
  });

  return createAuthConfig({
    providers: [{ id: "google" }],
    secret: "test-only-auth-secret",
    authIdentityService,
    connectToDatabase: async () => {},
    findUserByGoogleId: async () => ({
      _id: "persisted-user-id",
      name: "Wired User",
      displayName: "Wired User",
      profilePicture: "",
      bio: "",
      location: "",
    }),
    logError: logError ?? (() => {}),
  });
}

test("Auth.js config wires provider subject through jwt and session instead of random token.sub", async () => {
  const config = createConfiguredAuth();
  const account = {
    provider: "google",
    providerAccountId: "canonical-google-subject",
  };
  const allowed = await config.callbacks.signIn({
    user: {
      name: "Wired User",
      email: "wired@example.test",
    },
    account,
  });
  const token = await config.callbacks.jwt({
    token: {
      sub: "random-authjs-user-id",
      email: "wired@example.test",
    },
    account,
  });
  const session = await config.callbacks.session({
    session: { user: { email: "wired@example.test" } },
    token,
  });

  assert.equal(allowed, true);
  assert.equal(token.googleSubject, "canonical-google-subject");
  assert.equal(token.sub, "random-authjs-user-id");
  assert.equal(session.user.id, "canonical-google-subject");
});

test("Auth.js signIn callback returns false when canonical persistence is not asserted", async () => {
  const errors = [];
  const config = createConfiguredAuth({
    upsertUserByGoogleId: async () => null,
    logError: (message) => errors.push(message),
  });

  const allowed = await config.callbacks.signIn({
    user: {
      name: "Unpersisted User",
      email: "unpersisted@example.test",
    },
    account: {
      provider: "google",
      providerAccountId: "canonical-google-subject",
    },
  });

  assert.equal(allowed, false);
  assert.deepEqual(errors, ["Unable to save the signed-in Google user."]);
});
