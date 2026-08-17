import assert from "node:assert/strict";
import test from "node:test";

import {
  createAuthIdentityService,
} from "../src/business/services/authIdentityService.js";

function createService(overrides = {}) {
  return createAuthIdentityService({
    connectToDatabase: async () => {},
    findGoogleIdentityByEmail: async () => null,
    findUserByGoogleId: async () => null,
    createUser: async () => {},
    updateUserByGoogleId: async () => {},
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

test("Google user persistence keys creation and updates only by providerAccountId", async () => {
  const calls = [];
  const newUserService = createService({
    findUserByGoogleId: async (googleId) => {
      calls.push(["find", googleId]);
      return null;
    },
    createUser: async (user) => calls.push(["create", user]),
  });

  await newUserService.persistGoogleSignIn({
    user: {
      name: "New User",
      email: "new@example.test",
      image: "https://images.example.test/new-user.jpg",
    },
    account: {
      provider: "google",
      providerAccountId: "canonical-google-subject",
    },
    profile: { sub: "profile-subject-must-not-be-used" },
  });

  assert.deepEqual(calls, [
    ["find", "canonical-google-subject"],
    [
      "create",
      {
        name: "New User",
        email: "new@example.test",
        profilePicture: "https://images.example.test/new-user.jpg",
        googleId: "canonical-google-subject",
        displayName: "New User",
        bio: "",
        location: "",
      },
    ],
  ]);

  const updateCalls = [];
  const existingUserService = createService({
    findUserByGoogleId: async (googleId) => {
      updateCalls.push(["find", googleId]);
      return { _id: "persisted-user-id" };
    },
    updateUserByGoogleId: async (googleId, updates) => {
      updateCalls.push(["update", googleId, updates]);
    },
  });

  await existingUserService.persistGoogleSignIn({
    user: {
      name: "Existing User",
      email: "changed@example.test",
    },
    account: {
      provider: "google",
      providerAccountId: "existing-google-subject",
    },
  });

  assert.deepEqual(updateCalls, [
    ["find", "existing-google-subject"],
    ["update", "existing-google-subject", { name: "Existing User" }],
  ]);
});
