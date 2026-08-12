import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    // 来自 Google（只读）
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    googleId: { type: String, required: true, unique: true },
    profilePicture: { type: String, default: "" },

    // Chatlas 用户自定义字段
    displayName: { type: String, default: "" },     // ← 新增：Chatlas 显示名
    location: { type: String, default: "" },        // ← 已有
    bio: { type: String, default: "" },             // ← 已有

    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
