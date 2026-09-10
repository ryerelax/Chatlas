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
    "photos.0": { $exists: false },
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
  const repository = {
    async appendPhotoToDatedVisit({
      userId,
      attractionId,
      visitDateKey,
      photo,
      submissionKey,
    }) {
      const input = { userId, attractionId, visitDateKey };
      const capacityFilter = {
        ...createDatedVisitCapacityFilter(input),
        ...(submissionKey
          ? { "photos.submissionKey": { $ne: submissionKey } }
          : {}),
      };
      const persistedPhoto = submissionKey ? { ...photo, submissionKey } : photo;
      const update = {
        $setOnInsert: input,
        $push: { photos: persistedPhoto },
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
          ...input,
          "photos.0": { $exists: true },
        }).lean();

        if (fullVisit) {
          return null;
        }

        if (submissionKey) {
          const replayedVisit = await repository.findDatedVisitBySubmissionKey({
            ...input,
            submissionKey,
          });
          if (replayedVisit) return null;
        }

        throw error;
      }
    },

    async appendPhotosToDatedVisit({ photos, ...input }) {
      if (!Array.isArray(photos) || photos.length !== 1) {
        throw new RangeError("A dated visit write must contain exactly one photo.");
      }

      return repository.appendPhotoToDatedVisit({ ...input, photo: photos[0] });
    },

    async findDatedVisitPhotoCount({ userId, attractionId, visitDateKey }) {
      const visit = await VerifiedVisitModel.findOne({ userId, attractionId, visitDateKey })
        .select("photos._id")
        .lean();
      return Array.isArray(visit?.photos) ? visit.photos.length : 0;
    },

    async findDatedVisitBySubmissionKey({
      userId,
      attractionId,
      submissionKey,
    }) {
      const visit = await VerifiedVisitModel.findOne({
        userId,
        attractionId,
        "photos.submissionKey": submissionKey,
      })
        .select(
          "_id attractionId photos._id photos.photoUrl photos.capturedAt +photos.submissionKey"
        )
        .lean();

      if (!visit) return null;

      return {
        ...visit,
        photos: (visit.photos || []).filter(
          (photo) => photo.submissionKey === submissionKey
        ),
      };
    },

    async findDistinctVerifiedAttractionIds(userId) {
      const attractionIds = await VerifiedVisitModel.distinct("attractionId", {
        userId,
        "photos.0": { $exists: true },
      });
      return [...new Set(attractionIds.map((attractionId) => attractionId.toString()))];
    },

    async findVerifiedAttractionsWithLatestVisitDate(userId) {
      const records = await VerifiedVisitModel.aggregate([
        { $match: { userId, "photos.0": { $exists: true } } },
        {
          $group: {
            _id: "$attractionId",
            latestVisitedDate: { $max: "$visitDateKey" },
            latestVerifiedAt: { $max: "$createdAt" },
          },
        },
      ]);
      return records.flatMap((record) => {
        const attractionId = record?._id?.toString?.();
        return attractionId && typeof record?.latestVisitedDate === "string"
          ? [{
              attractionId,
              latestVisitedDate: record.latestVisitedDate,
              ...(record.latestVerifiedAt
                ? { latestVerifiedAt: record.latestVerifiedAt }
                : {}),
            }]
          : [];
      });
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

    async findOwnedPhotoForDeletion({ userId, visitId, photoId }) {
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
      if (!removedPhoto?.cloudinaryPublicId) {
        return null;
      }

      return { cloudinaryPublicId: removedPhoto.cloudinaryPublicId };
    },

    async removeOwnedPhoto({ userId, visitId, photoId }) {
      return VerifiedVisitModel.findOneAndUpdate(
        { _id: visitId, userId, "photos._id": photoId },
        { $pull: { photos: { _id: photoId } } },
        { new: true }
      ).lean();
    },

    async deleteVisitWhenEmpty(visitId) {
      await VerifiedVisitModel.deleteOne({ _id: visitId, photos: { $size: 0 } });
    },
  };

  return repository;
}

const verifiedVisitRepository = createVerifiedVisitRepository(VerifiedVisit);

export async function appendPhotoToDatedVisit(input) {
  return verifiedVisitRepository.appendPhotoToDatedVisit(input);
}

export async function appendPhotosToDatedVisit(input) {
  return verifiedVisitRepository.appendPhotosToDatedVisit(input);
}

export async function findDatedVisitPhotoCount(input) {
  return verifiedVisitRepository.findDatedVisitPhotoCount(input);
}

export async function findDatedVisitBySubmissionKey(input) {
  return verifiedVisitRepository.findDatedVisitBySubmissionKey(input);
}

export async function findDistinctVerifiedAttractionIds(userId) {
  return verifiedVisitRepository.findDistinctVerifiedAttractionIds(userId);
}

export async function findVerifiedAttractionsWithLatestVisitDate(userId) {
  return verifiedVisitRepository.findVerifiedAttractionsWithLatestVisitDate(userId);
}

export async function findPublicVerifiedPhotos(attractionId, viewerId) {
  return verifiedVisitRepository.findPublicVerifiedPhotos(attractionId, viewerId);
}

export async function findOwnedPhotoForDeletion(input) {
  return verifiedVisitRepository.findOwnedPhotoForDeletion(input);
}

export async function removeOwnedPhoto(input) {
  return verifiedVisitRepository.removeOwnedPhoto(input);
}

export async function deleteVisitWhenEmpty(visitId) {
  await verifiedVisitRepository.deleteVisitWhenEmpty(visitId);
}
