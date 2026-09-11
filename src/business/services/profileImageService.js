import { randomUUID } from "node:crypto";
import { moderateUploadedImageFile } from "@/business/services/imageModerationService";
import {
  findUserForProfileImage,
  updateUserProfileImage,
} from "@/data/repositories/userRepository";
import { findOwnedReviewPhotoByPublicId } from "@/data/repositories/myPhotosRepository";
import {
  deleteImageByPublicId,
  uploadProfileImageFromBuffer,
} from "@/infrastructure/external/cloudinary";

export class ProfileImageServiceError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "ProfileImageServiceError";
    this.statusCode = statusCode;
  }
}

// Retained for compatibility with callers that imported the previous type.
export class ProfileImageValidationError extends ProfileImageServiceError {
  constructor(message) {
    super(message, 400);
    this.name = "ProfileImageValidationError";
  }
}

export function createProfileImageService({
  findUser,
  findOwnedReviewPhoto,
  updateProfileImage,
  moderateFile,
  uploadImage,
  deleteImage,
  createUuid,
}) {
  async function replaceProfileImage(file, identity) {
    const user = await findUser(identity);
    if (!user?._id) {
      throw new ProfileImageServiceError("User not found.", 404);
    }

    const approvedImage = await moderateFile(file);
    let uploaded;

    try {
      uploaded = await uploadImage(
        approvedImage.buffer,
        approvedImage.mimeType,
        { publicId: `user-${user._id}-${createUuid()}` }
      );
    } catch {
      throw new ProfileImageServiceError(
        "Unable to save the profile image.",
        500
      );
    }

    try {
      const updatedUser = await updateProfileImage(user._id, uploaded);
      if (!updatedUser) {
        throw new ProfileImageServiceError("User not found.", 404);
      }
    } catch (error) {
      await Promise.allSettled([deleteImage(uploaded.publicId)]);
      if (error instanceof ProfileImageServiceError) throw error;
      throw new ProfileImageServiceError(
        "Unable to save the profile image.",
        500
      );
    }

    if (
      user.profilePicturePublicId &&
      user.profilePicturePublicId !== uploaded.publicId
    ) {
      await Promise.allSettled([deleteImage(user.profilePicturePublicId)]);
    }

    return uploaded;
  }

  async function clearProfileImage(identity) {
    const user = await findUser(identity);
    if (!user?._id) {
      throw new ProfileImageServiceError("User not found.", 404);
    }

    const updatedUser = await updateProfileImage(user._id, {
      url: "",
      publicId: "",
    });
    if (!updatedUser) {
      throw new ProfileImageServiceError("User not found.", 404);
    }

    if (user.profilePicturePublicId) {
      await Promise.allSettled([deleteImage(user.profilePicturePublicId)]);
    }

    return { url: "", publicId: "" };
  }

  async function useOwnedReviewPhotoAsProfileImage(publicId, identity) {
    const normalizedPublicId =
      typeof publicId === "string" ? publicId.trim() : "";
    if (!normalizedPublicId) {
      throw new ProfileImageServiceError("A valid photo is required.", 400);
    }

    const user = await findUser(identity);
    if (!user?._id) {
      throw new ProfileImageServiceError("User not found.", 404);
    }

    const photo = await findOwnedReviewPhoto({
      userId: user._id,
      publicId: normalizedPublicId,
    });
    if (!photo?.url || photo.publicId !== normalizedPublicId) {
      throw new ProfileImageServiceError("Photo not found.", 404);
    }

    const updatedUser = await updateProfileImage(user._id, {
      url: photo.url,
      // A Review owns this asset. The avatar workflow must never delete it.
      publicId: "",
    });
    if (!updatedUser) {
      throw new ProfileImageServiceError("User not found.", 404);
    }

    if (
      user.profilePicturePublicId &&
      user.profilePicturePublicId !== photo.publicId
    ) {
      await Promise.allSettled([deleteImage(user.profilePicturePublicId)]);
    }

    return photo;
  }

  return {
    replaceProfileImage,
    clearProfileImage,
    useOwnedReviewPhotoAsProfileImage,
  };
}

const profileImageService = createProfileImageService({
  findUser: findUserForProfileImage,
  findOwnedReviewPhoto: findOwnedReviewPhotoByPublicId,
  updateProfileImage: updateUserProfileImage,
  moderateFile: moderateUploadedImageFile,
  uploadImage: uploadProfileImageFromBuffer,
  deleteImage: deleteImageByPublicId,
  createUuid: randomUUID,
});

export async function uploadProfileImage(file, identity) {
  return profileImageService.replaceProfileImage(file, identity);
}

export async function clearProfileImage(identity) {
  return profileImageService.clearProfileImage(identity);
}

export async function setOwnedReviewPhotoAsProfileImage(publicId, identity) {
  return profileImageService.useOwnedReviewPhotoAsProfileImage(
    publicId,
    identity
  );
}
