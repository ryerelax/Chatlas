// Shared photo upload constraints, used by both Decision 4's Add Attraction
// submission and the community "Add a photo" contribution.
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

export function isValidPhotoType(mimeType) {
  return ALLOWED_PHOTO_TYPES.includes(mimeType);
}

export function isValidPhotoSize(byteLength) {
  return byteLength <= MAX_PHOTO_SIZE_BYTES;
}
