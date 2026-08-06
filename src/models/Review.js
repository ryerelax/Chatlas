import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    attractionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attraction",
      required: true,
      index: true,
    },

    userId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    userName: {
      type: String,
      required: true,
      trim: true,
    },

    userAvatar: {
      type: String,
      default: "",
      trim: true,
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    reviewText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
    collection: "reviews",
  }
);

const Review =
  mongoose.models.Review || mongoose.model("Review", reviewSchema);

export default Review;