"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [userData, setUserData] = useState(null);
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
            setUserData(result.data);
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
  }, [status, router]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F9FB]">
        <div className="text-[#006C56]">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  // 使用 displayName（如果存在），否则用 name
  const displayName = userData?.displayName || session.user.displayName || session.user.name || "User";
  const email = userData?.email || session.user.email;
  const profilePicture = userData?.profilePicture || session.user.image;
  const bio = userData?.bio || session.user.bio || "";
  const location = userData?.location || session.user.location || "";

  // 模拟统计数据（后续从数据库统计）
  const stats = {
    placesVisited: 0,
    reviewsWritten: 0,
    photosUploaded: 0,
    savedPlaces: 0,
  };

  return (
    <div className="min-h-screen bg-[#F7F9FB] py-10 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Avatar */}
            <img
              src={profilePicture || "/default-avatar.png"}
              alt="Profile"
              className="w-24 h-24 rounded-full border-4 border-[#006C56] object-cover"
            />

            {/* User Info */}
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-[#10213B]">{displayName}</h1>
              <p className="text-[#65748A]">{email}</p>
              {location && (
                <p className="text-sm text-[#65748A]">📍 {location}</p>
              )}
              <p className="text-sm text-[#65748A]">
                Member since {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </p>
              {bio && (
                <p className="mt-2 text-[#405066]">{bio}</p>
              )}
            </div>

            {/* Edit Button */}
            <Link
              href="/profile/edit"
              className="px-6 py-2 border border-[#006C56] text-[#006C56] rounded-lg hover:bg-[#006C56] hover:text-white transition"
            >
              ✏️ Edit Profile
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-4 text-center">
            <p className="text-2xl font-bold text-[#006C56]">{stats.placesVisited}</p>
            <p className="text-sm text-[#65748A]">Places visited</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 text-center">
            <p className="text-2xl font-bold text-[#006C56]">{stats.reviewsWritten}</p>
            <p className="text-sm text-[#65748A]">Reviews written</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 text-center">
            <p className="text-2xl font-bold text-[#006C56]">{stats.photosUploaded}</p>
            <p className="text-sm text-[#65748A]">Photos uploaded</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 text-center">
            <p className="text-2xl font-bold text-[#006C56]">{stats.savedPlaces}</p>
            <p className="text-sm text-[#65748A]">Saved places</p>
          </div>
        </div>

        {/* Recent Reviews - 占位 */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-xl font-bold text-[#10213B] mb-4">Recent Reviews</h2>
          <p className="text-[#65748A]">You haven&apos;t written any reviews yet.</p>
        </div>
      </div>
    </div>
  );
}
