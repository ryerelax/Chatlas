import mongoose from "mongoose";

const reviewCommentSchema = new mongoose.Schema(
  {
    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Review",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    commentText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    collection: "reviewComments",
  }
);

reviewCommentSchema.index({ reviewId: 1, createdAt: -1, _id: -1 });

const ReviewComment =
  mongoose.models.ReviewComment ||
  mongoose.model("ReviewComment", reviewCommentSchema);

export default ReviewComment;
