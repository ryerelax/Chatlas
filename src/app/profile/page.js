"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    placesVisited: 0,
    reviewsWritten: 0,
    photosUploaded: 0,
    savedPlaces: 0,
    wishlistCount: 0,
    favouritesCount: 0,
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated") {
      fetchUserData();
      fetchStats();
    }
  }, [status, router]);

  const fetchUserData = async () => {
    try {
      const response = await fetch("/api/user");
      const result = await response.json();
      if (result.success) {
        setUserData(result.data);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const wishlistRes = await fetch("/api/collection/wishlist");
      const wishlistData = await wishlistRes.json();
      const wishlistItems = wishlistData?.data || [];

      const favouritesRes = await fetch("/api/collection/favourites");
      const favouritesData = await favouritesRes.json();
      const favouritesItems = favouritesData?.data || [];

      const wishlistIds = new Set(wishlistItems.map(item => item.attractionId?._id || item.attractionId));
      const favouritesIds = new Set(favouritesItems.map(item => item.attractionId?._id || item.attractionId));
      const allSavedIds = new Set([...wishlistIds, ...favouritesIds]);

      setStats({
        placesVisited: 0,
        reviewsWritten: 0,
        photosUploaded: 0,
        savedPlaces: allSavedIds.size,
        wishlistCount: wishlistItems.length,
        favouritesCount: favouritesItems.length,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

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

  const displayName = userData?.displayName || session.user.displayName || session.user.name || "User";
  const email = userData?.email || session.user.email;
  const profilePicture = userData?.profilePicture || session.user.image;
  const bio = userData?.bio || session.user.bio || "";
  const location = userData?.location || session.user.location || "";

  return (
    <div className="min-h-screen bg-[#F7F9FB] py-10 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <img
              src={profilePicture || "/default-avatar.png"}
              alt="Profile"
              className="w-24 h-24 rounded-full border-4 border-[#006C56] object-cover"
            />
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

        {/* Collection Hub Cards */}
        <div className="bg-white rounded-xl shadow-sm border border-[#D8E1E7] p-6 mb-6">
          <div className="flex items-center gap-2 mb-5">
            <svg className="w-5 h-5 text-[#006C56]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h2 className="text-lg font-bold text-[#10213B]">Your Collection</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Wishlist Card */}
            <Link
              href="/wishlist"
              className="group relative bg-gradient-to-br from-[#FEF2F2] to-white border-2 border-[#FEF2F2] rounded-xl p-5 text-center hover:border-[#C2413B] hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
            >
              <div className="w-14 h-14 mx-auto rounded-full bg-[#C2413B] flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform duration-300">
                <svg className="w-7 h-7" fill="white" stroke="white" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <p className="font-bold text-[#10213B] text-base mt-3">Wishlist</p>
              <p className="text-[#65748A] text-sm">{stats.wishlistCount || 0} items saved</p>
              <div className="mt-3 text-[#C2413B] text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                View →
              </div>
            </Link>

            {/* Favourites Card */}
            <Link
              href="/favourites"
              className="group relative bg-gradient-to-br from-[#FFF3D6] to-white border-2 border-[#FFF3D6] rounded-xl p-5 text-center hover:border-[#FFAB00] hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
            >
              <div className="w-14 h-14 mx-auto rounded-full bg-[#FFAB00] flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform duration-300">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="font-bold text-[#10213B] text-base mt-3">Favourites</p>
              <p className="text-[#65748A] text-sm">{stats.favouritesCount || 0} items saved</p>
              <div className="mt-3 text-[#FFAB00] text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                View →
              </div>
            </Link>

            {/* Reviews Card */}
            <Link
              href="/reviews"
              className="group relative bg-gradient-to-br from-[#EAF3FA] to-white border-2 border-[#EAF3FA] rounded-xl p-5 text-center hover:border-[#2F6DA1] hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
            >
              <div className="w-14 h-14 mx-auto rounded-full bg-[#2F6DA1] flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform duration-300">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <p className="font-bold text-[#10213B] text-base mt-3">My Reviews</p>
              <p className="text-[#65748A] text-sm">0 reviews written</p>
              <div className="mt-3 text-[#2F6DA1] text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                View →
              </div>
            </Link>

            {/* Photos Card */}
            <Link
              href="/photos"
              className="group relative bg-gradient-to-br from-[#F3F0FF] to-white border-2 border-[#F3F0FF] rounded-xl p-5 text-center hover:border-[#7C3AED] hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
            >
              <div className="w-14 h-14 mx-auto rounded-full bg-[#7C3AED] flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform duration-300">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="font-bold text-[#10213B] text-base mt-3">My Photos</p>
              <p className="text-[#65748A] text-sm">0 photos uploaded</p>
              <div className="mt-3 text-[#7C3AED] text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                View →
              </div>
            </Link>

            {/* Travel History Card */}
            <Link
              href="/travel-history"
              className="group relative bg-gradient-to-br from-[#E8F7EF] to-white border-2 border-[#E8F7EF] rounded-xl p-5 text-center hover:border-[#16845B] hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
            >
              <div className="w-14 h-14 mx-auto rounded-full bg-[#16845B] flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform duration-300">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="font-bold text-[#10213B] text-base mt-3">Travel History</p>
              <p className="text-[#65748A] text-sm">0 attractions</p>
              <div className="mt-3 text-[#16845B] text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                View →
              </div>
            </Link>
          </div>
        </div>

        {/* Recent Reviews */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-xl font-bold text-[#10213B] mb-4">Recent Reviews</h2>
          <p className="text-[#65748A]">You haven't written any reviews yet.</p>
        </div>
      </div>
    </div>
  );
}