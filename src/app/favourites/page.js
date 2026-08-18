"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useSession } from "next-auth/react";

export default function FavouritesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [favourites, setFavourites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [toast, setToast] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?redirect=/favourites");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      loadFavourites();
    }
  }, [session]);

  const loadFavourites = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/collection/favourites");
      const data = await response.json();

      if (data.success) {
        setFavourites(data.data || []);
      } else {
        setError(data.message || "Failed to load favourites");
      }
    } catch (err) {
      setError("Unable to load favourites. Please try again.");
      console.error("Error loading favourites:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async (attractionId, attractionName) => {
    setIsRemoving(true);
    setRemoveTarget(null);

    try {
      const response = await fetch(`/api/collection/favourites?attractionId=${attractionId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        setFavourites(favourites.filter((item) => item.attractionId._id !== attractionId));
        showToast(`Removed "${attractionName || 'attraction'}" from favourites!`, "success");
      } else {
        showToast(data.message || "Failed to remove from favourites", "error");
      }
    } catch (err) {
      console.error("Error removing from favourites:", err);
      showToast("Unable to remove from favourites. Please try again.", "error");
    } finally {
      setIsRemoving(false);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-gray-500">Loading your favourites...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen p-4">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={loadFavourites}
          className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9FB]">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
          <div className={`flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg border transition-all duration-300 animate-in slide-in-from-top-5 ${
            toast.type === "success" 
              ? "bg-[#E8F7EF] border-[#16845B] text-[#004638]" 
              : "bg-[#FDECEC] border-[#C2413B] text-[#7A1A1A]"
          }`}>
            {toast.type === "success" ? (
              <div className="w-8 h-8 rounded-full bg-[#16845B]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#16845B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#C2413B]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#C2413B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
            <span className="text-base font-medium flex-1">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="text-[#65748A] hover:text-[#10213B] transition-colors flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.55)" }}>
          <div className="bg-white w-full max-w-md rounded-[18px] p-6 shadow-2xl">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 border border-red-200">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-[#10213B] text-center">
              Remove from favourites?
            </h3>
            <p className="text-[#65748A] text-center mt-2">
              Are you sure you want to remove <span className="font-semibold text-[#10213B]">"{removeTarget.name}"</span> from your favourites?
            </p>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setRemoveTarget(null)}
                className="flex-1 px-5 py-2.5 border border-[#BBC8D0] text-[#004638] font-semibold rounded-lg hover:bg-[#F1F6F4] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemove(removeTarget.id, removeTarget.name)}
                disabled={isRemoving}
                className="flex-1 px-5 py-2.5 bg-[#C2413B] text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isRemoving ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-[#006C56] text-white py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => router.push("/")}
            className="text-white/80 hover:text-white mb-4 flex items-center gap-2"
          >
            ← Back to Explore
          </button>
          <h1 className="text-3xl md:text-4xl font-bold">My Favourites</h1>
          <p className="text-white/80 mt-2">
            {favourites.length === 0
              ? "Start exploring attractions to add to your favourites!"
              : `Showing ${favourites.length} favourite(s)`}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 py-8">
        {favourites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <svg
              className="w-24 h-24 text-gray-300 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <polygon
                points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                strokeWidth={1}
                strokeLinejoin="round"
              />
            </svg>
            <h3 className="text-xl font-semibold text-gray-800">
              No favourites yet
            </h3>
            <p className="text-gray-500 mt-2 max-w-md">
              Start exploring attractions and save the ones you love!
            </p>
            <button
              onClick={() => router.push("/")}
              className="mt-6 px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
            >
              Explore Attractions
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favourites.map((item) => (
              <div
                key={item._id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="relative h-48 w-full bg-green-100">
                  {item.attractionId?.photos && item.attractionId.photos.length > 0 ? (
                    <Image
                      src={item.attractionId.photos[0]}
                      alt={item.attractionId.name || "Attraction"}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-green-600/50">
                      <span>No photo</span>
                    </div>
                  )}
                  <div className="absolute top-3 right-3 bg-white rounded-full p-1.5 shadow-md">
                    <svg className="w-5 h-5" fill="#FFAB00" stroke="#FFAB00" viewBox="0 0 24 24">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-lg text-gray-900 truncate">
                    {item.attractionId?.name || "Unknown attraction"}
                  </h3>
                  <p className="text-sm text-gray-500 truncate">
                    {item.attractionId?.category || "Uncategorized"}
                  </p>
                  <p className="text-sm text-gray-400 truncate mt-1">
                    {item.attractionId?.address || "No address"}
                  </p>
                  {item.attractionId?.rating && (
                    <div className="flex items-center gap-1 mt-2">
                      <span className="text-amber-500">★</span>
                      <span className="text-sm font-medium">
                        {item.attractionId.rating.toFixed(1)}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setRemoveTarget({
                        id: item.attractionId._id,
                        name: item.attractionId?.name || "this attraction"
                      });
                    }}
                    className="mt-3 w-full py-2 text-sm text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Remove from Favourites
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}