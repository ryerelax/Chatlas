import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    /** The ID of the attraction being reviewed */
    attractionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attraction",
      required: true,
      index: true,
    },

    /** The ID of the user who wrote the review */
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

    /** The avatar URL of the user who wrote the review */
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

    /** The text of the review */
    reviewText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  {
    /** Automatically add createdAt and updatedAt fields example: 'Posted on 7 August 2026'*/
    timestamps: true,
    collection: "reviews",
  }
);

const Review =
  mongoose.models.Review || mongoose.model("Review", reviewSchema);

export default Review;