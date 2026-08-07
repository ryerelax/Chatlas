"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function WishlistPage() {
  const router = useRouter();
  const [wishlist, setWishlist] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Mock data for testing
  useEffect(() => {
    setTimeout(() => {
      const mockWishlist = [
        {
          _id: "1",
          attractionId: {
            _id: "attraction_001",
            name: "A Famosa",
            category: "Historical",
            address: "Jalan Parameswara, Bandar Hilir, 78000 Melaka",
            rating: 4.5,
            photos: [],
          },
        },
        {
          _id: "2",
          attractionId: {
            _id: "attraction_002",
            name: "Jonker Street Night Market",
            category: "Entertainment",
            address: "Jalan Hang Jebat, 75200 Melaka",
            rating: 4.2,
            photos: [],
          },
        },
        {
          _id: "3",
          attractionId: {
            _id: "attraction_003",
            name: "Melaka Straits Mosque",
            category: "Religious",
            address: "Pulau Melaka, 75000 Melaka",
            rating: 4.7,
            photos: [],
          },
        },
      ];

      setWishlist(mockWishlist);
      setIsLoading(false);
    }, 800);
  }, []);

  const handleRemove = (attractionId) => {
    setWishlist(wishlist.filter((item) => item.attractionId._id !== attractionId));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-gray-500">Loading your wishlist...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-green-800 text-white py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => router.push("/")}
            className="text-white/80 hover:text-white mb-4 flex items-center gap-2 transition-colors"
          >
            ← Back to Explore
          </button>
          <h1 className="text-3xl md:text-4xl font-bold">My Wishlist</h1>
          <p className="text-white/80 mt-2">
            {wishlist.length === 0
              ? "Start exploring attractions to add to your wishlist!"
              : `Showing ${wishlist.length} attraction(s)`}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 py-8">
        {wishlist.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <svg className="w-24 h-24 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-800">Your wishlist is empty</h3>
            <p className="text-gray-500 mt-2 max-w-md">Start exploring attractions and save the ones you want to visit!</p>
            <button onClick={() => router.push("/")} className="mt-6 px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors">
              Explore Attractions
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {wishlist.map((item) => (
              <div key={item._id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative h-48 w-full bg-green-100">
                  {item.attractionId?.photos && item.attractionId.photos.length > 0 ? (
                    <Image src={item.attractionId.photos[0]} alt={item.attractionId.name || "Attraction"} fill className="object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-green-600/50">
                      <span>No photo</span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-lg text-gray-900 truncate">{item.attractionId?.name || "Unknown attraction"}</h3>
                  <p className="text-sm text-gray-500 truncate">{item.attractionId?.category || "Uncategorized"}</p>
                  <p className="text-sm text-gray-400 truncate mt-1">{item.attractionId?.address || "No address"}</p>
                  {item.attractionId?.rating && (
                    <div className="flex items-center gap-1 mt-2">
                      <span className="text-amber-500">★</span>
                      <span className="text-sm font-medium">{item.attractionId.rating.toFixed(1)}</span>
                    </div>
                  )}
                  <button onClick={() => handleRemove(item.attractionId._id)} className="mt-3 w-full py-2 text-sm text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                    Remove from Wishlist
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