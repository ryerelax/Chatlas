// Lightweight declared-metadata checks for Review form inputs. The shared
// image moderation service performs the canonical byte/signature validation.
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png"];
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

export function isValidPhotoType(mimeType) {
  return ALLOWED_PHOTO_TYPES.includes(mimeType);
}

export function isValidPhotoSize(byteLength) {
  return byteLength <= MAX_PHOTO_SIZE_BYTES;
}
