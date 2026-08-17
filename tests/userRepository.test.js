import assert from "node:assert/strict";
import test from "node:test";
import User from "../src/data/models/User.js";
import {
  findUserByGoogleId,
  upsertUserByGoogleId,
} from "../src/data/repositories/userRepository.js";

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

test("canonical Google persistence is one atomic upsert keyed only by googleId", async () => {
  const originalFindOneAndUpdate = User.findOneAndUpdate;
  const calls = [];

  User.findOneAndUpdate = (filter, update, options) => {
    calls.push(["findOneAndUpdate", filter, update, options]);
    return {
      select(projection) {
        calls.push(["select", projection]);
        return {
          async lean() {
            calls.push(["lean"]);
            return {
              _id: "persisted-user-id",
              googleId: "canonical-google-subject",
            };
          },
        };
      },
    };
  };

  let result;
  try {
    result = await upsertUserByGoogleId({
      googleId: "canonical-google-subject",
      name: "Atomic User",
      email: "atomic@example.test",
      profilePicture: "https://images.example.test/atomic-user.jpg",
      displayName: "Atomic User",
      bio: "",
      location: "",
    });
  } finally {
    User.findOneAndUpdate = originalFindOneAndUpdate;
  }

  assert.deepEqual(calls, [
    [
      "findOneAndUpdate",
      { googleId: "canonical-google-subject" },
      {
        $set: { name: "Atomic User" },
        $setOnInsert: {
          email: "atomic@example.test",
          profilePicture: "https://images.example.test/atomic-user.jpg",
          googleId: "canonical-google-subject",
          displayName: "Atomic User",
          bio: "",
          location: "",
        },
      },
      { upsert: true, new: true, runValidators: true },
    ],
    ["select", "_id googleId"],
    ["lean"],
  ]);
  assert.deepEqual(result, {
    _id: "persisted-user-id",
    googleId: "canonical-google-subject",
  });
});
