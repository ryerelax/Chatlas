import mongoose from "mongoose";

const wishlistItemSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, "User ID is required"],
      index: true,
    },
    attractionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attraction",
      required: [true, "Attraction ID is required"],
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

// Prevent duplicate wishlist entries
wishlistItemSchema.index({ userId: 1, attractionId: 1 }, { unique: true });

// Compound index for faster queries
wishlistItemSchema.index({ userId: 1, addedAt: -1 });

export default mongoose.models.WishlistItem || mongoose.model("WishlistItem", wishlistItemSchema);