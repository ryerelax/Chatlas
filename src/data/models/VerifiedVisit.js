import mongoose from "mongoose";

const verifiedPhotoSchema = new mongoose.Schema({
  photoUrl: { type: String, required: true, trim: true },
  cloudinaryPublicId: { type: String, required: true, trim: true, select: false },
  capturedAt: { type: Date, required: true },
  latitude: { type: Number, required: true, select: false },
  longitude: { type: Number, required: true, select: false },
  accuracyMeters: { type: Number, required: true, select: false },
  distanceMeters: { type: Number, required: true, select: false },
});

const verifiedVisitSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    attractionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attraction",
      required: true,
      index: true,
    },
    visitDateKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    photos: {
      type: [verifiedPhotoSchema],
      validate: [
        (photos) => photos.length <= 3,
        "A dated visit can contain at most 3 photos.",
      ],
    },
  },
  { timestamps: true, collection: "verifiedVisits" }
);

verifiedVisitSchema.index(
  { userId: 1, attractionId: 1, visitDateKey: 1 },
  { unique: true }
);

const VerifiedVisit =
  mongoose.models.VerifiedVisit ||
  mongoose.model("VerifiedVisit", verifiedVisitSchema);

export default VerifiedVisit;
