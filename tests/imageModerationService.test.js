import assert from "node:assert/strict";
import test from "node:test";
import {
  createImageModerationService,
  IMAGE_MODERATION_CODES,
  ImageModerationError,
} from "../src/business/services/imageModerationService.js";
import { evaluateChildSafeImagePolicy } from "../src/business/services/childSafeImagePolicy.js";
import { createRekognitionAdapter } from "../src/infrastructure/external/rekognition.js";

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);

function createService(labelsOrError = []) {
  const calls = [];
  const service = createImageModerationService({
    detectLabels: async (bytes, options) => {
      calls.push({ bytes, options });
      if (labelsOrError instanceof Error) throw labelsOrError;
      return labelsOrError;
    },
    getConfiguration: () => ({
      minConfidence: 50,
      rejectConfidence: 70,
    }),
  });

  return { service, calls };
}

function blockedLabel(Name, options = {}) {
  return {
    Name,
    ParentName: "",
    TaxonomyLevel: 1,
    Confidence: 95,
    ...options,
  };
}

test("safe JPEG and PNG images pass and Rekognition receives MinConfidence 50", async () => {
  const { service, calls } = createService([]);

  const jpeg = await service.moderateBytes(JPEG_BYTES, "image/jpeg");
  const png = await service.moderateBytes(PNG_BYTES, "image/png");

  assert.equal(jpeg.mimeType, "image/jpeg");
  assert.equal(png.mimeType, "image/png");
  assert.deepEqual(calls.map((call) => call.options), [
    { minConfidence: 50 },
    { minConfidence: 50 },
  ]);
});

const blockedCases = [
  ["Explicit Nudity", { ParentName: "Explicit", TaxonomyLevel: 2 }],
  ["Explicit Sexual Activity", { ParentName: "Explicit", TaxonomyLevel: 2 }],
  ["Sex Toys", { ParentName: "Explicit", TaxonomyLevel: 2 }],
  ["Non-Explicit Nudity", {
    ParentName: "Non-Explicit Nudity of Intimate parts and Kissing",
    TaxonomyLevel: 2,
  }],
  ["Obstructed Intimate Parts", {
    ParentName: "Non-Explicit Nudity of Intimate parts and Kissing",
    TaxonomyLevel: 2,
  }],
  ["Violence", {}],
  ["Weapons", { ParentName: "Violence", TaxonomyLevel: 2 }],
  ["Graphic Violence", { ParentName: "Violence", TaxonomyLevel: 2 }],
  ["Physical Violence", { ParentName: "Graphic Violence", TaxonomyLevel: 3 }],
  ["Self-Harm", { ParentName: "Graphic Violence", TaxonomyLevel: 3 }],
  ["Blood & Gore", { ParentName: "Graphic Violence", TaxonomyLevel: 3 }],
  ["Visually Disturbing", {}],
  ["Drugs & Tobacco", {}],
  ["Alcohol", {}],
  ["Rude Gestures", {}],
  ["Middle Finger", { ParentName: "Rude Gestures", TaxonomyLevel: 2 }],
  ["Gambling", {}],
  ["Hate Symbols", {}],
];

for (const [name, options] of blockedCases) {
  test(`${name} is rejected by the sensitive-content policy`, async () => {
    const { service } = createService([blockedLabel(name, options)]);

    await assert.rejects(
      service.moderateBytes(JPEG_BYTES, "image/jpeg"),
      {
        name: "ImageModerationError",
        code: IMAGE_MODERATION_CODES.unsafe,
        statusCode: 422,
      }
    );
  });
}

test("a relevant child of a blocked parent is rejected without substring matching", () => {
  assert.deepEqual(
    evaluateChildSafeImagePolicy([
      blockedLabel("Implied Nudity", {
        ParentName: "Non-Explicit Nudity",
        TaxonomyLevel: 3,
        Confidence: 70,
      }),
    ]),
    { approved: false }
  );
});

test("ordinary swimwear stays allowed because it is a separate exact taxonomy branch", () => {
  assert.deepEqual(
    evaluateChildSafeImagePolicy([
      blockedLabel("Swimwear or Underwear"),
      blockedLabel("Female Swimwear or Underwear", {
        ParentName: "Swimwear or Underwear",
        TaxonomyLevel: 2,
      }),
    ]),
    { approved: true }
  );
});

test("an exact blocked label cannot bypass policy by omitting taxonomy metadata", () => {
  assert.deepEqual(
    evaluateChildSafeImagePolicy([
      {
        Name: "Explicit Nudity",
        ParentName: "",
        Confidence: 95,
      },
    ]),
    { approved: false }
  );
});

test("confidence below 70 passes and confidence exactly 70 rejects", () => {
  assert.deepEqual(
    evaluateChildSafeImagePolicy([
      blockedLabel("Gambling", { Confidence: 69.99 }),
    ]),
    { approved: true }
  );
  assert.deepEqual(
    evaluateChildSafeImagePolicy([
      blockedLabel("Gambling", { Confidence: 70 }),
    ]),
    { approved: false }
  );
});

test("invalid signatures are rejected before the AWS adapter is called", async () => {
  const { service, calls } = createService([]);

  await assert.rejects(
    service.moderateBytes(Buffer.from("not an image"), "image/jpeg"),
    {
      code: IMAGE_MODERATION_CODES.invalid,
      statusCode: 400,
    }
  );
  assert.equal(calls.length, 0);
});

test("unsupported formats and oversized images use stable 400 codes", async () => {
  const { service } = createService([]);

  await assert.rejects(
    service.moderateBytes(JPEG_BYTES, "image/webp"),
    { code: IMAGE_MODERATION_CODES.unsupported, statusCode: 400 }
  );

  const tinyLimitService = createImageModerationService({
    detectLabels: async () => [],
    maxBytes: 3,
    getConfiguration: () => ({ minConfidence: 50, rejectConfidence: 70 }),
  });
  await assert.rejects(
    tinyLimitService.moderateBytes(JPEG_BYTES, "image/jpeg"),
    { code: IMAGE_MODERATION_CODES.tooLarge, statusCode: 400 }
  );
});

test("AWS failures are converted to a safe 503 without provider details", async () => {
  const providerError = new Error("secret provider response");
  const { service } = createService(providerError);

  await assert.rejects(
    service.moderateBytes(JPEG_BYTES, "image/jpeg"),
    (error) =>
      error instanceof ImageModerationError &&
      error.code === IMAGE_MODERATION_CODES.unavailable &&
      error.statusCode === 503 &&
      !error.message.includes("secret provider response")
  );
});

test("the Rekognition adapter sends image bytes through DetectModerationLabelsCommand", async () => {
  const sent = [];
  const adapter = createRekognitionAdapter(
    () => ({
      async send(command, options) {
        sent.push({ command, options });
        return { ModerationLabels: [blockedLabel("Gambling")] };
      },
    }),
    { timeoutMs: 1000 }
  );

  const labels = await adapter.detectModerationLabels(JPEG_BYTES, {
    minConfidence: 50,
  });

  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].command.input, {
    Image: { Bytes: JPEG_BYTES },
    MinConfidence: 50,
  });
  assert.equal(sent[0].options.abortSignal.aborted, false);
  assert.equal(labels[0].Name, "Gambling");
});
