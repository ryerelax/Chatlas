import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    // 来自 Google（只读）
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    googleId: { type: String, required: true, unique: true },
    profilePicture: { type: String, default: "" },

    // Chatlas 用户自定义字段
    displayName: { type: String, default: "" },
    location: { type: String, default: "" },
    bio: { type: String, default: "" },

    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

UserSchema.index({ displayName: 1 });

export default mongoose.models.User || mongoose.model("User", UserSchema);