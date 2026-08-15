"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const CATEGORIES = ["All", "Museum", "Religious", "Historical", "Nature", "Entertainment", "Gallery"];

// Mock data for testing (replace with API call later)
const MOCK_FAVOURITES = [
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

export default function FavouritesPage() {
  const router = useRouter();
  const [favourites, setFavourites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  useEffect(() => {
    // TODO: Replace with actual API call
    setTimeout(() => {
      setFavourites(MOCK_FAVOURITES);
      setIsLoading(false);
    }, 500);
  }, []);

  const filtered = favourites.filter((item) => {
    const matchCat = category === "All" || item.attractionId.category === category;
    const matchSearch =
      item.attractionId.name.toLowerCase().includes(search.toLowerCase()) ||
      item.attractionId.address.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleRemove = (attractionId) => {
    setFavourites(favourites.filter((item) => item.attractionId._id !== attractionId));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-[#65748A]">Loading your favourites...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9FB]">
      {/* Hero */}
      <div className="bg-[#006C56] text-white py-12 px-4">
        <div className="max-w-[1200px] mx-auto">
          <button
            onClick={() => router.push("/collection")}
            className="text-white/80 hover:text-white mb-4 flex items-center gap-2 transition-colors"
          >
            ← Back to Collection
          </button>
          <h1 className="text-3xl md:text-4xl font-bold">My Favourites</h1>
          <p className="text-white/80 mt-2">
            {filtered.length === 0
              ? "Start exploring attractions to add to your favourites!"
              : `Showing ${filtered.length} favourite${filtered.length !== 1 ? "s" : ""}`}
          </p>
          {/* Search */}
          <div className="mt-4 flex items-center bg-white rounded-lg overflow-hidden max-w-md">
            <div className="pl-4 text-[#98A2B3]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search your favourites…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 text-[#10213B] outline-none bg-transparent"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1200px] mx-auto px-4 py-8">
        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                category === cat
                  ? "bg-[#006C56] text-white"
                  : "bg-white border border-[#D8E1E7] text-[#10213B] hover:border-[#006C56]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {favourites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg className="w-16 h-16 text-[#98A2B3] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" strokeWidth={1.5} />
            </svg>
            <h3 className="text-xl font-semibold text-[#10213B]">No favourites yet</h3>
            <p className="text-[#65748A] mt-2">You haven't added any attractions to your favourites yet.</p>
            <button
              onClick={() => router.push("/")}
              className="mt-6 px-6 py-2 bg-[#FFAB00] text-[#142033] font-semibold rounded-lg hover:bg-[#E89B00] transition-colors"
            >
              Explore Attractions
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg className="w-16 h-16 text-[#98A2B3] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="text-xl font-semibold text-[#10213B]">No matches found</h3>
            <p className="text-[#65748A] mt-2">No favourites match your search or filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((item) => (
              <div key={item._id} className="bg-white rounded-lg shadow-md overflow-hidden border border-[#D8E1E7]">
                <div className="relative h-48 w-full bg-[#CDF5E5]">
                  {item.attractionId.photos && item.attractionId.photos.length > 0 ? (
                    <Image
                      src={item.attractionId.photos[0]}
                      alt={item.attractionId.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-[#006C56]/50">
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
                  <h3 className="font-semibold text-[#10213B] text-lg truncate">{item.attractionId.name}</h3>
                  <p className="text-[#65748A] text-sm">{item.attractionId.category}</p>
                  <p className="text-[#98A2B3] text-sm truncate mt-1">{item.attractionId.address}</p>
                  {item.attractionId.rating && (
                    <div className="flex items-center gap-1 mt-2">
                      <span className="text-[#FFAB00]">★</span>
                      <span className="text-sm font-medium text-[#10213B]">{item.attractionId.rating.toFixed(1)}</span>
                    </div>
                  )}
                  <button
                    onClick={() => handleRemove(item.attractionId._id)}
                    className="mt-3 w-full py-2 text-sm text-[#C2413B] border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
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