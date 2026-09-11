import { evaluateChildSafeImagePolicy } from "@/business/services/childSafeImagePolicy";
import { detectModerationLabels } from "@/infrastructure/external/rekognition";

export const IMAGE_MODERATION_CODES = Object.freeze({
  unsafe: "IMAGE_UNSAFE",
  unavailable: "IMAGE_MODERATION_UNAVAILABLE",
  invalid: "IMAGE_INVALID",
  tooLarge: "IMAGE_TOO_LARGE",
  unsupported: "IMAGE_FORMAT_UNSUPPORTED",
});

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const SUPPORTED_IMAGE_TYPES = Object.freeze(["image/jpeg", "image/png"]);

const PUBLIC_MESSAGES = Object.freeze({
  [IMAGE_MODERATION_CODES.unsafe]:
    "This photo may contain sensitive content. Please choose another photo.",
  [IMAGE_MODERATION_CODES.unavailable]:
    "Photo safety checking is temporarily unavailable. Please try again later.",
  [IMAGE_MODERATION_CODES.invalid]: "Please choose a valid image.",
  [IMAGE_MODERATION_CODES.tooLarge]:
    "This image is too large. Maximum size is 5 MB.",
  [IMAGE_MODERATION_CODES.unsupported]:
    "Unsupported image format. Please choose a JPEG or PNG image.",
});

const STATUS_BY_CODE = Object.freeze({
  [IMAGE_MODERATION_CODES.unsafe]: 422,
  [IMAGE_MODERATION_CODES.unavailable]: 503,
  [IMAGE_MODERATION_CODES.invalid]: 400,
  [IMAGE_MODERATION_CODES.tooLarge]: 400,
  [IMAGE_MODERATION_CODES.unsupported]: 400,
});

export class ImageModerationError extends Error {
  constructor(code) {
    super(
      PUBLIC_MESSAGES[code] ||
        PUBLIC_MESSAGES[IMAGE_MODERATION_CODES.invalid]
    );
    this.name = "ImageModerationError";
    this.code = code;
    this.statusCode = STATUS_BY_CODE[code] || 400;
  }
}

function readConfidence(name, fallback) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === "") return fallback;

  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new ImageModerationError(IMAGE_MODERATION_CODES.unavailable);
  }

  return value;
}

function getPolicyConfiguration() {
  const minConfidence = readConfidence(
    "IMAGE_MODERATION_MIN_CONFIDENCE",
    50
  );
  const rejectConfidence = readConfidence(
    "IMAGE_MODERATION_REJECT_CONFIDENCE",
    70
  );

  if (minConfidence > rejectConfidence) {
    throw new ImageModerationError(IMAGE_MODERATION_CODES.unavailable);
  }

  return { minConfidence, rejectConfidence };
}

function detectImageMimeType(buffer) {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (
    buffer.length >= pngSignature.length &&
    pngSignature.every((byte, index) => buffer[index] === byte)
  ) {
    return "image/png";
  }

  return "";
}

export function validateImageBytes(
  imageBytes,
  declaredMimeType,
  { maxBytes = MAX_IMAGE_BYTES } = {}
) {
  const mimeType = String(declaredMimeType || "").trim().toLowerCase();
  if (!SUPPORTED_IMAGE_TYPES.includes(mimeType)) {
    throw new ImageModerationError(IMAGE_MODERATION_CODES.unsupported);
  }

  const buffer = Buffer.isBuffer(imageBytes)
    ? imageBytes
    : imageBytes instanceof Uint8Array
      ? Buffer.from(imageBytes)
      : null;

  if (!buffer || buffer.length === 0) {
    throw new ImageModerationError(IMAGE_MODERATION_CODES.invalid);
  }

  if (buffer.length > maxBytes) {
    throw new ImageModerationError(IMAGE_MODERATION_CODES.tooLarge);
  }

  const detectedMimeType = detectImageMimeType(buffer);
  if (!detectedMimeType || detectedMimeType !== mimeType) {
    throw new ImageModerationError(IMAGE_MODERATION_CODES.invalid);
  }

  return { buffer, mimeType: detectedMimeType };
}

function decodeDataUri(dataUri) {
  if (typeof dataUri !== "string") {
    throw new ImageModerationError(IMAGE_MODERATION_CODES.invalid);
  }

  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUri);
  if (!match || match[2].length % 4 !== 0) {
    throw new ImageModerationError(IMAGE_MODERATION_CODES.invalid);
  }

  const buffer = Buffer.from(match[2], "base64");
  if (
    buffer.toString("base64").replace(/=+$/, "") !==
    match[2].replace(/=+$/, "")
  ) {
    throw new ImageModerationError(IMAGE_MODERATION_CODES.invalid);
  }

  return { buffer, declaredMimeType: match[1] };
}

export function createImageModerationService({
  detectLabels,
  evaluatePolicy = evaluateChildSafeImagePolicy,
  maxBytes = MAX_IMAGE_BYTES,
  getConfiguration = getPolicyConfiguration,
}) {
  async function moderateBytes(imageBytes, declaredMimeType) {
    const image = validateImageBytes(imageBytes, declaredMimeType, { maxBytes });
    const { minConfidence, rejectConfidence } = getConfiguration();

    let labels;
    try {
      labels = await detectLabels(image.buffer, { minConfidence });
    } catch {
      throw new ImageModerationError(IMAGE_MODERATION_CODES.unavailable);
    }

    const result = evaluatePolicy(labels, { rejectConfidence });
    if (!result.approved) {
      throw new ImageModerationError(IMAGE_MODERATION_CODES.unsafe);
    }

    return image;
  }

  async function moderateUploadedFile(file) {
    if (
      !file ||
      typeof file.arrayBuffer !== "function" ||
      !Number.isFinite(file.size) ||
      file.size <= 0
    ) {
      throw new ImageModerationError(IMAGE_MODERATION_CODES.invalid);
    }

    if (file.size > maxBytes) {
      throw new ImageModerationError(IMAGE_MODERATION_CODES.tooLarge);
    }

    let bytes;
    try {
      bytes = Buffer.from(await file.arrayBuffer());
    } catch {
      throw new ImageModerationError(IMAGE_MODERATION_CODES.invalid);
    }

    return moderateBytes(bytes, file.type);
  }

  async function moderateUploadedFiles(files) {
    const approved = [];
    for (const file of files) {
      approved.push(await moderateUploadedFile(file));
    }
    return approved;
  }

  async function moderateDataUri(dataUri) {
    const { buffer, declaredMimeType } = decodeDataUri(dataUri);
    return moderateBytes(buffer, declaredMimeType);
  }

  return {
    moderateBytes,
    moderateUploadedFile,
    moderateUploadedFiles,
    moderateDataUri,
  };
}

const imageModerationService = createImageModerationService({
  detectLabels: detectModerationLabels,
});

export async function moderateImageBytes(imageBytes, declaredMimeType) {
  return imageModerationService.moderateBytes(imageBytes, declaredMimeType);
}

export async function moderateUploadedImageFile(file) {
  return imageModerationService.moderateUploadedFile(file);
}

export async function moderateUploadedImageFiles(files) {
  return imageModerationService.moderateUploadedFiles(files);
}

export async function moderateImageDataUri(dataUri) {
  return imageModerationService.moderateDataUri(dataUri);
}
