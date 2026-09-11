export const CLIENT_IMAGE_TYPES = Object.freeze(["image/jpeg", "image/png"]);

const ERROR_KEY_BY_CODE = Object.freeze({
  IMAGE_UNSAFE: "imageSafetyRejected",
  IMAGE_MODERATION_UNAVAILABLE: "imageSafetyUnavailable",
  IMAGE_INVALID: "imageInvalid",
  IMAGE_TOO_LARGE: "imageTooLarge",
  IMAGE_FORMAT_UNSUPPORTED: "imageInvalid",
});

export function getImageUploadErrorKey(code) {
  return ERROR_KEY_BY_CODE[code] || "";
}
