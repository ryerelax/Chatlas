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

    // TODO: Backfill from Google Places API (New) editorialSummary.text. Not all
    // attractions have an editorial summary, so this stays empty for some records.
    description: {
      type: String,
      default: "",
      trim: true,
    },

    state: {
      type: String,
      default: "Melaka",
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