import mongoose from "mongoose";

const wishlistItemSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    attractionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attraction",
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.WishlistItem || mongoose.model("WishlistItem", wishlistItemSchema);