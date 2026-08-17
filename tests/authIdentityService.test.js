import assert from "node:assert/strict";
import test from "node:test";

import {
  createAuthIdentityService,
} from "../src/business/services/authIdentityService.js";

function createService(overrides = {}) {
  return createAuthIdentityService({
    connectToDatabase: async () => {},
    findGoogleIdentityByEmail: async () => null,
    upsertUserByGoogleId: async () => null,
    ...overrides,
  });
}

test("Google sign-in stores the provider subject in the JWT and session while ignoring token.sub", async () => {
  let emailLookups = 0;
  const service = createService({
    findGoogleIdentityByEmail: async () => {
      emailLookups += 1;
      return { googleId: "wrong-legacy-subject" };
    },
  });
  const token = await service.addGoogleSubjectToToken({
    token: {
      sub: "random-authjs-user-id",
      email: "signed-in@example.test",
    },
    account: {
      provider: "google",
      providerAccountId: "google-provider-subject",
    },
  });

  const session = await service.applyGoogleSubjectToSession({
    session: { user: { email: "signed-in@example.test" } },
    token,
  });

  assert.equal(token.googleSubject, "google-provider-subject");
  assert.equal(token.sub, "random-authjs-user-id");
  assert.equal(session.user.id, "google-provider-subject");
  assert.equal(emailLookups, 0);
});

test("a legacy signed JWT recovers only an already-persisted non-empty Google subject", async () => {
  const lookedUpEmails = [];
  const service = createService({
    findGoogleIdentityByEmail: async (email) => {
      lookedUpEmails.push(email);
      if (email === "persisted@example.test") {
        return { googleId: "persisted-google-subject" };
      }
      if (email === "blank@example.test") {
        return { googleId: "   " };
      }
      return null;
    },
  });

  const recoveredToken = await service.addGoogleSubjectToToken({
    token: {
      sub: "random-legacy-authjs-id",
      email: "persisted@example.test",
    },
  });
  assert.equal(recoveredToken.googleSubject, "persisted-google-subject");
  assert.deepEqual(lookedUpEmails, ["persisted@example.test"]);
  const recovered = await service.applyGoogleSubjectToSession({
    session: { user: { email: "persisted@example.test" } },
    token: recoveredToken,
  });
  const blankToken = await service.addGoogleSubjectToToken({
    token: {
      sub: "another-random-authjs-id",
      email: "blank@example.test",
    },
  });
  const blank = await service.applyGoogleSubjectToSession({
    session: { user: { email: "blank@example.test" } },
    token: blankToken,
  });
  const missingToken = await service.addGoogleSubjectToToken({
    token: {
      sub: "third-random-authjs-id",
      email: "missing@example.test",
    },
  });
  const missing = await service.applyGoogleSubjectToSession({
    session: { user: { email: "missing@example.test" } },
    token: missingToken,
  });
  const malformedClaimToken = await service.addGoogleSubjectToToken({
    token: {
      sub: "fourth-random-authjs-id",
      email: "persisted@example.test",
      googleSubject: "   ",
    },
  });
  const malformedClaim = await service.applyGoogleSubjectToSession({
    session: { user: { email: "persisted@example.test" } },
    token: malformedClaimToken,
  });

  assert.equal(recovered.user.id, "persisted-google-subject");
  assert.equal(blank.user.id, undefined);
  assert.equal(missing.user.id, undefined);
  assert.equal(malformedClaim.user.id, undefined);
  assert.equal(blankToken.googleSubject, null);
  assert.equal(missingToken.googleSubject, null);
  assert.deepEqual(lookedUpEmails, [
    "persisted@example.test",
    "blank@example.test",
    "missing@example.test",
  ]);
});

test("concurrent first Google sign-ins use one atomic canonical upsert each instead of read then create", async () => {
  const upserts = [];
  const service = createService({
    upsertUserByGoogleId: async (input) => {
      upserts.push(input);
      return {
        _id: "persisted-user-id",
        googleId: "canonical-google-subject",
      };
    },
  });
  const account = {
    provider: "google",
    providerAccountId: "canonical-google-subject",
  };
  const user = {
    name: "Concurrent User",
    email: "concurrent@example.test",
    image: "https://images.example.test/concurrent-user.jpg",
  };

  await Promise.all([
    service.persistGoogleSignIn({ user, account }),
    service.persistGoogleSignIn({ user, account }),
  ]);

  const expectedInput = {
    googleId: "canonical-google-subject",
    name: "Concurrent User",
    email: "concurrent@example.test",
    profilePicture: "https://images.example.test/concurrent-user.jpg",
    displayName: "Concurrent User",
    bio: "",
    location: "",
  };
  assert.deepEqual(upserts, [expectedInput, expectedInput]);
});

test("Google sign-in persistence rejects an atomic upsert with no canonical persisted mapping", async () => {
  const service = createService({
    upsertUserByGoogleId: async () => null,
  });

  await assert.rejects(
    service.persistGoogleSignIn({
      user: {
        name: "Unpersisted User",
        email: "unpersisted@example.test",
      },
      account: {
        provider: "google",
        providerAccountId: "canonical-google-subject",
      },
    }),
    /persisted Google identity/i
  );
});

test("Google sign-in persistence rejects an atomic upsert for a different canonical subject", async () => {
  const service = createService({
    upsertUserByGoogleId: async () => ({
      _id: "persisted-user-id",
      googleId: "different-google-subject",
    }),
  });

  await assert.rejects(
    service.persistGoogleSignIn({
      user: {
        name: "Mismatched User",
        email: "mismatched@example.test",
      },
      account: {
        provider: "google",
        providerAccountId: "canonical-google-subject",
      },
    }),
    /persisted Google identity/i
  );
});
