import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },

    profilePicture: {
      type: String,
      default: "",
      trim: true,
    },

    publicSummary: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    isProfilePublic: {
      type: Boolean,
      default: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // TODO: Add authentication-provider fields when Google Identity integration is implemented.

    // TODO: Add profile customisation fields only after the team confirms
    // which information should be public and which information should remain private.

    // TODO: Add exploration summary references when PB37-PB39 are implemented.
  },
  {
    timestamps: true,
    collection: "users",
  }
);

const User =
  mongoose.models.User || mongoose.model("User", userSchema);

export default User;