import mongoose from "mongoose";

const verifiedPhotoSchema = new mongoose.Schema({
  photoUrl: { type: String, required: true, trim: true },
  cloudinaryPublicId: { type: String, required: true, trim: true, select: false },
  capturedAt: { type: Date, required: true },
  latitude: { type: Number, required: true, select: false },
  longitude: { type: Number, required: true, select: false },
  accuracyMeters: { type: Number, required: true, select: false },
  distanceMeters: { type: Number, required: true, select: false },
  submissionKey: { type: String, trim: true, select: false },
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
    photos: [verifiedPhotoSchema],
  },
  { timestamps: true, collection: "verifiedVisits" }
);

verifiedVisitSchema.index(
  { userId: 1, attractionId: 1, visitDateKey: 1 },
  { unique: true }
);
verifiedVisitSchema.index(
  { userId: 1, attractionId: 1, "photos.submissionKey": 1 },
  {
    unique: true,
    partialFilterExpression: {
      "photos.submissionKey": { $exists: true },
    },
  }
);

const VerifiedVisit =
  mongoose.models.VerifiedVisit ||
  mongoose.model("VerifiedVisit", verifiedVisitSchema);

export default VerifiedVisit;
