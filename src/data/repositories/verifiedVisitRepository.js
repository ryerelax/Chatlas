import VerifiedVisit from "@/data/models/VerifiedVisit";

const PUBLIC_VERIFIED_VISIT_FIELDS =
  "_id userId visitDateKey photos._id photos.photoUrl photos.capturedAt createdAt";
const PRIVATE_REMOVAL_FIELDS =
  "+photos.cloudinaryPublicId +photos.latitude +photos.longitude +photos.accuracyMeters +photos.distanceMeters";

export function createVerifiedVisitRepository(VerifiedVisitModel) {
  return {
    async appendPhotoToDatedVisit({ userId, attractionId, visitDateKey, photo }) {
      try {
        return await VerifiedVisitModel.findOneAndUpdate(
          {
            userId,
            attractionId,
            visitDateKey,
            "photos.2": { $exists: false },
          },
          {
            $setOnInsert: { userId, attractionId, visitDateKey },
            $push: { photos: photo },
          },
          { upsert: true, new: true, runValidators: true }
        ).lean();
      } catch (error) {
        if (error?.code === 11000) {
          return null;
        }

        throw error;
      }
    },

    async findDistinctVerifiedAttractionIds(userId) {
      const attractionIds = await VerifiedVisitModel.distinct("attractionId", { userId });
      return [...new Set(attractionIds.map((attractionId) => attractionId.toString()))];
    },

    findPublicVerifiedPhotos(attractionId) {
      return VerifiedVisitModel.find({ attractionId })
        .select(PUBLIC_VERIFIED_VISIT_FIELDS)
        .populate({
          path: "userId",
          select: "displayName name profilePicture -_id",
        })
        .sort({ visitDateKey: -1, createdAt: -1, _id: -1 })
        .lean();
    },

    async removeOwnedPhoto({ userId, visitId, photoId }) {
      const ownershipFilter = { _id: visitId, userId, "photos._id": photoId };
      const existingVisit = await VerifiedVisitModel.findOne(ownershipFilter)
        .select(PRIVATE_REMOVAL_FIELDS)
        .lean();

      if (!existingVisit) {
        return null;
      }

      const removedPhoto = existingVisit.photos.find(
        (photo) => photo._id.toString() === photoId.toString()
      );
      const visit = await VerifiedVisitModel.findOneAndUpdate(
        ownershipFilter,
        { $pull: { photos: { _id: photoId } } },
        { new: true }
      ).lean();

      if (!visit || !removedPhoto) {
        return null;
      }

      return { visit, removedPhoto };
    },

    async deleteVisitWhenEmpty(visitId) {
      await VerifiedVisitModel.deleteOne({ _id: visitId, photos: { $size: 0 } });
    },
  };
}

const verifiedVisitRepository = createVerifiedVisitRepository(VerifiedVisit);

export async function appendPhotoToDatedVisit(input) {
  return verifiedVisitRepository.appendPhotoToDatedVisit(input);
}

export async function findDistinctVerifiedAttractionIds(userId) {
  return verifiedVisitRepository.findDistinctVerifiedAttractionIds(userId);
}

export async function findPublicVerifiedPhotos(attractionId) {
  return verifiedVisitRepository.findPublicVerifiedPhotos(attractionId);
}

export async function removeOwnedPhoto(input) {
  return verifiedVisitRepository.removeOwnedPhoto(input);
}

export async function deleteVisitWhenEmpty(visitId) {
  await verifiedVisitRepository.deleteVisitWhenEmpty(visitId);
}
