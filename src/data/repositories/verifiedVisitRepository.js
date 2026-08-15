import VerifiedVisit from "@/data/models/VerifiedVisit";

const PUBLIC_VERIFIED_VISIT_FIELDS =
  "_id userId visitDateKey photos._id photos.photoUrl photos.capturedAt createdAt";
const PRIVATE_REMOVAL_FIELDS =
  "+photos.cloudinaryPublicId +photos.latitude +photos.longitude +photos.accuracyMeters +photos.distanceMeters";
const DATED_VISIT_GROUP_KEYS = ["userId", "attractionId", "visitDateKey"];

function hasExactDatedVisitGroupKeys(value) {
  const keys = Object.keys(value || {});
  return (
    keys.length === DATED_VISIT_GROUP_KEYS.length &&
    DATED_VISIT_GROUP_KEYS.every((key) => Object.hasOwn(value, key))
  );
}

function identifiersMatch(left, right) {
  return left?.toString() === right?.toString();
}

function isTargetDatedVisitDuplicate(error, input) {
  return (
    error?.code === 11000 &&
    hasExactDatedVisitGroupKeys(error.keyPattern) &&
    hasExactDatedVisitGroupKeys(error.keyValue) &&
    DATED_VISIT_GROUP_KEYS.every((key) => identifiersMatch(error.keyValue[key], input[key]))
  );
}

function createDatedVisitCapacityFilter({ userId, attractionId, visitDateKey }) {
  return {
    userId,
    attractionId,
    visitDateKey,
    "photos.2": { $exists: false },
  };
}

function toPublicVerifiedVisit(visit, viewerId) {
  const owner = visit.userId;

  return {
    _id: visit._id,
    visitDateKey: visit.visitDateKey,
    createdAt: visit.createdAt,
    user: owner
      ? {
          displayName: owner.displayName,
          name: owner.name,
          profilePicture: owner.profilePicture,
        }
      : null,
    photos: visit.photos.map((photo) => ({
      _id: photo._id,
      photoUrl: photo.photoUrl,
      capturedAt: photo.capturedAt,
    })),
    canDelete: Boolean(viewerId && owner?._id && identifiersMatch(owner._id, viewerId)),
  };
}

export function createVerifiedVisitRepository(VerifiedVisitModel) {
  return {
    async appendPhotoToDatedVisit({ userId, attractionId, visitDateKey, photo }) {
      const input = { userId, attractionId, visitDateKey };
      const capacityFilter = createDatedVisitCapacityFilter(input);
      const update = {
        $setOnInsert: input,
        $push: { photos: photo },
      };

      try {
        return await VerifiedVisitModel.findOneAndUpdate(
          capacityFilter,
          update,
          { upsert: true, new: true, runValidators: true }
        ).lean();
      } catch (error) {
        if (!isTargetDatedVisitDuplicate(error, input)) {
          throw error;
        }

        const retriedVisit = await VerifiedVisitModel.findOneAndUpdate(
          capacityFilter,
          update,
          { upsert: false, new: true, runValidators: true }
        ).lean();

        if (retriedVisit) {
          return retriedVisit;
        }

        const fullVisit = await VerifiedVisitModel.findOne({
          userId,
          attractionId,
          visitDateKey,
          "photos.2": { $exists: true },
        }).lean();

        if (fullVisit) {
          return null;
        }

        throw error;
      }
    },

    async findDistinctVerifiedAttractionIds(userId) {
      const attractionIds = await VerifiedVisitModel.distinct("attractionId", { userId });
      return [...new Set(attractionIds.map((attractionId) => attractionId.toString()))];
    },

    async findPublicVerifiedPhotos(attractionId, viewerId) {
      const visits = await VerifiedVisitModel.find({ attractionId })
        .select(PUBLIC_VERIFIED_VISIT_FIELDS)
        .populate({
          path: "userId",
          select: "_id displayName name profilePicture",
        })
        .sort({ visitDateKey: -1, createdAt: -1, _id: -1 })
        .lean();

      return visits.map((visit) => toPublicVerifiedVisit(visit, viewerId));
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

export async function findPublicVerifiedPhotos(attractionId, viewerId) {
  return verifiedVisitRepository.findPublicVerifiedPhotos(attractionId, viewerId);
}

export async function removeOwnedPhoto(input) {
  return verifiedVisitRepository.removeOwnedPhoto(input);
}

export async function deleteVisitWhenEmpty(visitId) {
  await verifiedVisitRepository.deleteVisitWhenEmpty(visitId);
}
