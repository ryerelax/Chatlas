import mongoose from "mongoose";

const attractionSchema = new mongoose.Schema(
  {
    googlePlaceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    address: {
      type: String,
      required: true,
      trim: true,
    },

    latitude: {
      type: Number,
      required: true,
    },

    longitude: {
      type: Number,
      required: true,
    },

    types: {
      type: [String],
      default: [],
    },

    rating: {
      type: Number,
      default: 0,
    },

    totalReviews: {
      type: Number,
      default: 0,
    },

    businessStatus: {
      type: String,
      default: "OPERATIONAL",
    },

    googleMapsUrl: {
      type: String,
      default: "",
    },

    source: {
      type: String,
      default: "Google Places API New",
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    // Backfilled from Google Places API (New) editorialSummary.text by
    // scripts/syncAttractionDescriptions.mjs. Not all attractions have an
    // editorial summary, so this stays empty for some records.
    description: {
      type: String,
      default: "",
      trim: true,
    },

    // Stable Cloudinary URLs, populated by scripts/syncAttractionPhotos.js.
    // Not all attractions have Places photos, so this stays empty for some records.
    photos: {
      type: [String],
      default: [],
    },

    // Draft Melaka zone classification for PB09 (see scripts/classifyLocationAreas.js).
    // Not yet confirmed by the team — empty when an address didn't match any zone.
    locationArea: {
      type: String,
      default: "",
      trim: true,
    },

    state: {
      type: String,
      default: "Melaka",
    },

    // Set only for Registered-User-submitted attractions (Decision 4). Denormalized
    // from the submitter's session at submission time — absent entirely on the
    // original seeded records. Not a ref to the User collection by design.
    submittedBy: {
      googleId: { type: String, trim: true },
      email: { type: String, trim: true },
      name: { type: String, trim: true },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "attractions",
  }
);

const Attraction =
  mongoose.models.Attraction ||
  mongoose.model("Attraction", attractionSchema);

export default Attraction;
