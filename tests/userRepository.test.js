import assert from "node:assert/strict";
import test from "node:test";
import User from "../src/data/models/User.js";
import { findUserByGoogleId } from "../src/data/repositories/userRepository.js";

test("Google identity lookup preserves the complete existing session profile projection", async () => {
  const originalFindOne = User.findOne;
  const calls = [];

  User.findOne = (filter) => {
    calls.push(["findOne", filter]);
    return {
      select(projection) {
        calls.push(["select", projection]);
        return {
          async lean() {
            calls.push(["lean"]);
            return { _id: "persisted-user-id" };
          },
        };
      },
    };
  };

  try {
    await findUserByGoogleId("google-provider-subject");
  } finally {
    User.findOne = originalFindOne;
  }

  assert.deepEqual(calls, [
    ["findOne", { googleId: "google-provider-subject" }],
    ["select", "_id name displayName profilePicture bio location"],
    ["lean"],
  ]);
});
