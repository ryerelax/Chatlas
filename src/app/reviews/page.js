"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// Mock data for testing (replace with API call later)
const MOCK_REVIEWS = [
  {
    id: "1",
    attractionName: "A Famosa",
    attractionCategory: "Historical",
    rating: 4.5,
    date: "15 June 2026",
    text: "A Famosa is one of the oldest surviving European architectural remains in Asia. The fortress was built by the Portuguese in 1511 and later taken over by the Dutch. Today, only the Porta de Santiago gate remains, but it's still a must-visit for history lovers.",
    photos: [],
  },
  {
    id: "2",
    attractionName: "Jonker Street Night Market",
    attractionCategory: "Entertainment",
    rating: 4.2,
    date: "14 June 2026",
    text: "The famous Jonker Street Night Market is a vibrant mix of food, culture, and shopping. The street comes alive on weekend nights with stalls selling everything from local snacks to antiques. The atmosphere is electric and the food is amazing!",
    photos: [],
  },
  {
    id: "3",
    attractionName: "Melaka Straits Mosque",
    attractionCategory: "Religious",
    rating: 4.7,
    date: "13 June 2026",
    text: "Beautiful mosque located on the edge of the Melaka Strait. The golden dome looks stunning during sunset. A peaceful and serene place to visit.",
    photos: [],
  },
];

export default function MyReviewsPage() {
  const router = useRouter();
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingReview, setEditingReview] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    // TODO: Replace with actual API call
    setTimeout(() => {
      setReviews(MOCK_REVIEWS);
      setIsLoading(false);
    }, 500);
  }, []);

  const filtered = reviews.filter(
    (r) =>
      r.attractionName.toLowerCase().includes(search.toLowerCase()) ||
      r.text.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = () => {
    if (!deleteTarget) return;
    setReviews(reviews.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const handleSaveEdit = (updated) => {
    setReviews(reviews.map((r) => (r.id === updated.id ? updated : r)));
    setEditingReview(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-[#65748A]">Loading your reviews...</p>
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
          <h1 className="text-3xl md:text-4xl font-bold">My Reviews</h1>
          <p className="text-white/80 mt-2">
            {filtered.length === 0
              ? "Start exploring and share your experiences!"
              : `Showing ${filtered.length} review${filtered.length !== 1 ? "s" : ""}`}
          </p>
          <div className="mt-4 flex items-center bg-white rounded-lg overflow-hidden max-w-md">
            <div className="pl-4 text-[#98A2B3]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search your reviews…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 text-[#10213B] outline-none bg-transparent"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1200px] mx-auto px-4 py-8">
        {reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg className="w-16 h-16 text-[#98A2B3] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <h3 className="text-xl font-semibold text-[#10213B]">No reviews yet</h3>
            <p className="text-[#65748A] mt-2">You haven't written any reviews yet.</p>
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
            <p className="text-[#65748A] mt-2">No reviews match your search.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((review) => (
              <div key={review.id} className="bg-white border border-[#D8E1E7] rounded-[14px] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-[#10213B]">{review.attractionName}</h3>
                      <span className="px-2 py-0.5 bg-[#E6F7F0] text-[#004638] text-xs rounded-full border border-[#A7D7C5]">
                        {review.attractionCategory}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className={i < review.rating ? "text-[#FFAB00]" : "text-[#D8E1E7]"}>
                            ★
                          </span>
                        ))}
                      </div>
                      <span className="text-[#65748A] text-sm">{review.date}</span>
                    </div>
                    <p className="text-[#405066] text-sm leading-relaxed">{review.text}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setEditingReview(review)}
                      className="w-9 h-9 flex items-center justify-center border border-[#D8E1E7] text-[#65748A] hover:text-[#006C56] hover:border-[#006C56] rounded-full transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeleteTarget(review)}
                      className="w-9 h-9 flex items-center justify-center border border-[#D8E1E7] text-[#65748A] hover:text-[#C2413B] hover:border-[#C2413B] rounded-full transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.55)" }}>
          <div className="bg-white w-full max-w-md rounded-[18px] p-6">
            <h3 className="text-xl font-bold text-[#10213B]">Delete this review?</h3>
            <p className="text-[#65748A] mt-2">Are you sure you want to permanently delete your review of "{deleteTarget.attractionName}"? This action cannot be undone.</p>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-5 py-2.5 border border-[#BBC8D0] text-[#004638] font-semibold rounded-lg hover:bg-[#F1F6F4] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-5 py-2.5 bg-[#C2413B] text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}