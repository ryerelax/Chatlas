import { uploadProfileImageData } from "@/infrastructure/external/cloudinary";

const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

export class ProfileImageValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProfileImageValidationError";
  }
}

export async function uploadProfileImage(file, userId) {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new ProfileImageValidationError("No image file was provided.");
  }

  if (!VALID_IMAGE_TYPES.includes(file.type)) {
    throw new ProfileImageValidationError(
      "Unsupported file format. Please upload JPG, PNG, or WEBP."
    );
  }

  if (file.size > MAX_PROFILE_IMAGE_BYTES) {
    throw new ProfileImageValidationError(
      "File is too large. Maximum size is 5MB."
    );
  }

  const bytes = await file.arrayBuffer();
  const imageData = `data:${file.type};base64,${Buffer.from(bytes).toString(
    "base64"
  )}`;

  const result = await uploadProfileImageData(imageData, userId);

  // Always return a consistent shape for API routes
  return {
    url: result.url,
    publicId: result.publicId,
  };
}