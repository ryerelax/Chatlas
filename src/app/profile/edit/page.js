"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function EditProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [profilePicture, setProfilePicture] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(true);

  // 从 API 获取用户数据（与 My Profile 保持一致）
  const fetchUserData = async () => {
    try {
      const response = await fetch("/api/user");
      const result = await response.json();
      if (result.success) {
        const data = result.data;
        setDisplayName(data.displayName || data.name || "");
        setBio(data.bio || "");
        setLocation(data.location || "");
        setProfilePicture(data.profilePicture || session?.user?.image || "");
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated") {
      fetchUserData();
    }
  }, [status, router]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: "error", text: "File is too large. Maximum size is 5MB." });
        return;
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setMessage({ type: "error", text: "Unsupported file format. Please upload JPG, PNG, or WEBP." });
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      let profilePictureUrl = null;

      // 如果有新图片，上传到 Cloudinary
      if (imageFile) {
        console.log("🔍 Uploading image to Cloudinary...");
        const uploadFormData = new FormData();
        uploadFormData.append("file", imageFile);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: uploadFormData,
        });

        const uploadResult = await uploadRes.json();
        console.log("🔍 Cloudinary upload result:", uploadResult);

        if (!uploadResult.success) {
          throw new Error(uploadResult.message);
        }
        profilePictureUrl = uploadResult.data.url;
        console.log("✅ Cloudinary upload successful:", profilePictureUrl);
      } else {
        console.log("ℹ️ No image to upload, keeping existing");
      }

      const updateData = {
        displayName,
        bio,
        location,
      };

      // ✅ 如果有新的 Cloudinary URL，添加到更新数据中
      if (profilePictureUrl) {
        updateData.profilePicture = profilePictureUrl;
        console.log("🔍 Adding profilePicture to updateData:", profilePictureUrl);
      }

      console.log("🔍 Final updateData being sent:", updateData);

      const response = await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      const result = await response.json();
      console.log("🔍 Update API response:", result);

      if (!result.success) throw new Error(result.message);

      // ✅ 使用服务器返回的 profilePicture，或使用新上传的 URL
      const newImageUrl = profilePictureUrl || result.data.profilePicture || session.user.image;

      // 更新 session
      await update({
        ...session,
        user: {
          ...session.user,
          displayName: displayName,
          image: newImageUrl,
          bio: bio,
          location: location,
        },
      });

      // 更新本地状态
      if (newImageUrl) {
        setProfilePicture(newImageUrl);
      }

      setMessage({ type: "success", text: "Profile updated successfully!" });

      setTimeout(() => {
        router.push("/profile");
      }, 1500);
    } catch (error) {
      console.error("❌ Error:", error);
      setMessage({ type: "error", text: error.message || "Failed to update profile." });
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F9FB]">
        <div className="text-[#006C56]">Loading...</div>
      </div>
    );
  }

  // 头像来源：预览 → 数据库 → session
  const avatarSrc = imagePreview || profilePicture || session?.user?.image || "/default-avatar.png";

  return (
    <div className="min-h-screen bg-[#F7F9FB] py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-black mb-6">Edit Profile</h1>

        {message && (
          <div
            className={`p-3 rounded mb-4 text-sm ${
              message.type === "success"
                ? "bg-[#E8F7EF] text-[#16845B]"
                : "bg-[#FDECEC] text-[#C2413B]"
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <img
                src={avatarSrc}
                alt="Profile"
                className="w-24 h-24 rounded-full border-4 border-[#006C56] object-cover"
              />
              <label className="absolute bottom-0 right-0 bg-[#006C56] text-white rounded-full p-1.5 cursor-pointer hover:bg-[#005E4B]">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-2">JPG, PNG or WEBP, max 5MB</p>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-black mb-1">Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full border border-[#D8E1E7] rounded px-4 py-2 text-black focus:outline-none focus:border-[#006C56]"
              maxLength="50"
              required
            />
            <p className="text-xs text-gray-500 mt-1">{displayName.length}/50</p>
          </div>

          {/* Email - 只读 */}
          <div>
            <label className="block text-sm font-medium text-black mb-1">Email</label>
            <input
              type="email"
              value={session?.user?.email || ""}
              disabled
              className="w-full border border-[#D8E1E7] rounded px-4 py-2 bg-gray-50 text-black"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-black mb-1">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City or region you explore from"
              className="w-full border border-[#D8E1E7] rounded px-4 py-2 text-black focus:outline-none focus:border-[#006C56]"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-black mb-1">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows="4"
              placeholder="A short introduction shown on your public profile"
              className="w-full border border-[#D8E1E7] rounded px-4 py-2 text-black focus:outline-none focus:border-[#006C56]"
              maxLength="200"
            />
            <p className="text-xs text-gray-500 mt-1">{bio.length}/200</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-[#006C56] text-white px-6 py-2 rounded hover:bg-[#005E4B] transition disabled:opacity-50"
            >
              {isLoading ? "Saving..." : "Save changes"}
            </button>
            <Link
              href="/profile"
              className="px-6 py-2 border border-gray-300 rounded hover:bg-gray-50 transition text-center text-black"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}