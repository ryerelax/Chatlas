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
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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

    photos: {
      type: [
        {
          _id: false,
          url: {
            type: String,
            required: true,
            trim: true,
          },
          publicId: {
            type: String,
            required: true,
            trim: true,
          },
        },
      ],
      default: [],
      validate: {
        validator: (photos) => photos.length <= 3,
        message: "A review can include up to 3 photos.",
      },
    },
  },
  {
    timestamps: true,
    collection: "reviews",
  }
);

const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);
export default Review;
