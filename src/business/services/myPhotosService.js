import {
  countUniqueReviewPhotosByUserId,
  findReviewPhotoByUrl,
  findReviewPhotosByUserId,
} from "@/data/repositories/myPhotosRepository";
import { findUserByIdentity } from "@/data/repositories/userRepository";

export const MY_PHOTOS_PAGE_SIZE = 12;

export class MyPhotosServiceError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = "MyPhotosServiceError";
    this.statusCode = statusCode;
  }
}

function normalizePage(value) {
  const page = Math.trunc(Number(value) || 1);
  return Math.max(1, page);
}

function getId(value) {
  return value?._id?.toString?.() || value?.toString?.() || "";
}

function serializePhoto(photo, profilePicture) {
  if (!photo) return null;

  return {
    id: `${getId(photo.reviewId)}-${Number(photo.photoIndex) || 0}`,
    reviewId: getId(photo.reviewId),
    attractionId: getId(photo.attractionId),
    attractionName: photo.attractionName || "Unknown attraction",
    url: photo.url || "",
    publicId: photo.publicId || "",
    uploadedAt: photo.uploadedAt || null,
    isProfilePicture: Boolean(profilePicture && photo.url === profilePicture),
  };
}

export function createMyPhotosService({
  findUser = findUserByIdentity,
  countPhotos = countUniqueReviewPhotosByUserId,
  findPhotos = findReviewPhotosByUserId,
  findProfilePhoto = findReviewPhotoByUrl,
} = {}) {
  return async function getMyPhotos({ identity = {}, page = 1 } = {}) {
    const user = await findUser(identity);
    if (!user?._id) {
      throw new MyPhotosServiceError("User account not found.", 404);
    }

    const total = await countPhotos(user._id);
    const totalPages = Math.max(1, Math.ceil(total / MY_PHOTOS_PAGE_SIZE));
    const resolvedPage = Math.min(normalizePage(page), totalPages);
    const profilePicture = user.profilePicture || "";
    const [photos, profilePhoto] = await Promise.all([
      findPhotos({
        userId: user._id,
        page: resolvedPage,
        limit: MY_PHOTOS_PAGE_SIZE,
      }),
      profilePicture
        ? findProfilePhoto({ userId: user._id, url: profilePicture })
        : null,
    ]);

    return {
      items: (photos || []).map((photo) =>
        serializePhoto(photo, profilePicture)
      ),
      profilePhoto: serializePhoto(profilePhoto, profilePicture),
      pagination: {
        page: resolvedPage,
        limit: MY_PHOTOS_PAGE_SIZE,
        total,
        totalPages,
      },
    };
  };
}

export const getMyPhotos = createMyPhotosService();
