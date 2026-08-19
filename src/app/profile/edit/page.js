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

  useEffect(() => {
    let cancelled = false;

    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated") {
      async function fetchUserData() {
        try {
          const response = await fetch("/api/user");
          const result = await response.json();

          if (!cancelled && result.success) {
            const data = result.data;
            setDisplayName(data.displayName || data.name || "");
            setBio(data.bio || "");
            setLocation(data.location || "");
            setProfilePicture(
              data.profilePicture || session?.user?.image || ""
            );
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      }

      fetchUserData();
    }

    return () => {
      cancelled = true;
    };
  }, [status, router, session]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setMessage({
          type: "error",
          text: "File is too large. Maximum size is 5MB.",
        });
        return;
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setMessage({
          type: "error",
          text: "Unsupported file format. Please upload JPG, PNG, or WEBP.",
        });
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

      if (imageFile) {
        const uploadFormData = new FormData();
        uploadFormData.append("file", imageFile);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: uploadFormData,
        });

        const uploadResult = await uploadRes.json();

        if (!uploadResult.success) {
          throw new Error(uploadResult.message);
        }
        profilePictureUrl = uploadResult.data.url;
      }

      const updateData = {
        displayName,
        bio,
        location,
      };

      if (profilePictureUrl) {
        updateData.profilePicture = profilePictureUrl;
      }

      const response = await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      const result = await response.json();

      if (!result.success) throw new Error(result.message);

      const newImageUrl =
        profilePictureUrl ||
        result.data.profilePicture ||
        session?.user?.image;

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

      if (newImageUrl) {
        setProfilePicture(newImageUrl);
      }

      setMessage({ type: "success", text: "Profile updated successfully!" });

      setTimeout(() => {
        router.push("/profile");
      }, 1500);
    } catch (error) {
      console.error("Error:", error);
      setMessage({
        type: "error",
        text: error.message || "Failed to update profile.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F9FB]">
        <div className="text-[#006C56]">Loading...</div>
      </div>
    );
  }

  const avatarSrc =
    imagePreview ||
    profilePicture ||
    session?.user?.image ||
    "/default-avatar.png";

  return (
    <div className="min-h-screen bg-[#F7F9FB] px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-lg bg-white p-8 shadow-md">
        <h1 className="mb-6 text-2xl font-bold text-black">Edit Profile</h1>

        {message && (
          <div
            className={`mb-4 rounded p-3 text-sm ${
              message.type === "success"
                ? "bg-[#E8F7EF] text-[#16845B]"
                : "bg-[#FDECEC] text-[#C2413B]"
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex flex-col items-center">
            <div className="relative">
              <img
                src={avatarSrc}
                alt="Profile"
                className="h-24 w-24 rounded-full border-4 border-[#006C56] object-cover"
              />
              <label className="absolute bottom-0 right-0 cursor-pointer rounded-full bg-[#006C56] p-1.5 text-white hover:bg-[#005E4B]">
                <svg
                  className="h-4 w-4"
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
            <p className="mt-2 text-xs text-gray-500">
              JPG, PNG or WEBP, max 5MB
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-black">
              Display name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded border border-[#D8E1E7] px-4 py-2 text-black focus:border-[#006C56] focus:outline-none"
              maxLength="50"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              {displayName.length}/50
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-black">
              Email
            </label>
            <input
              type="email"
              value={session?.user?.email || ""}
              disabled
              className="w-full rounded border border-[#D8E1E7] bg-gray-50 px-4 py-2 text-black"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-black">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City or region you explore from"
              className="w-full rounded border border-[#D8E1E7] px-4 py-2 text-black focus:border-[#006C56] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-black">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows="4"
              placeholder="A short introduction shown on your public profile"
              className="w-full rounded border border-[#D8E1E7] px-4 py-2 text-black focus:border-[#006C56] focus:outline-none"
              maxLength="200"
            />
            <p className="mt-1 text-xs text-gray-500">{bio.length}/200</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 rounded bg-[#006C56] px-6 py-2 text-white transition hover:bg-[#005E4B] disabled:opacity-50"
            >
              {isLoading ? "Saving..." : "Save changes"}
            </button>
            <Link
              href="/profile"
              className="rounded border border-gray-300 px-6 py-2 text-center text-black transition hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}