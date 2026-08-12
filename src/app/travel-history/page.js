"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// Mock data for testing (replace with API call later)
const MOCK_ACTIVITIES = [
  {
    id: "1",
    type: "visited",
    attractionName: "A Famosa",
    attractionCategory: "Historical",
    date: "15 June 2026",
  },
  {
    id: "2",
    type: "reviewed",
    attractionName: "A Famosa",
    attractionCategory: "Historical",
    date: "15 June 2026",
    rating: 4.5,
    reviewExcerpt: "One of the oldest surviving European architectural remains in Asia.",
  },
  {
    id: "3",
    type: "visited",
    attractionName: "Jonker Street Night Market",
    attractionCategory: "Entertainment",
    date: "14 June 2026",
  },
  {
    id: "4",
    type: "reviewed",
    attractionName: "Jonker Street Night Market",
    attractionCategory: "Entertainment",
    date: "14 June 2026",
    rating: 4.2,
    reviewExcerpt: "A vibrant mix of food, culture, and shopping.",
  },
  {
    id: "5",
    type: "photo",
    attractionName: "Jonker Street Night Market",
    attractionCategory: "Entertainment",
    date: "14 June 2026",
    photoUrl: "",
  },
  {
    id: "6",
    type: "visited",
    attractionName: "Melaka Straits Mosque",
    attractionCategory: "Religious",
    date: "13 June 2026",
  },
  {
    id: "7",
    type: "reviewed",
    attractionName: "Melaka Straits Mosque",
    attractionCategory: "Religious",
    date: "13 June 2026",
    rating: 4.7,
    reviewExcerpt: "Beautiful golden dome mosque on the edge of the Melaka Strait.",
  },
];

const STATS = [
  { label: "Attractions visited", value: "6" },
  { label: "Reviews written", value: "12" },
  { label: "Photos uploaded", value: "8" },
  { label: "Total activities", value: "26" },
];

const ACTIVITY_BADGES = {
  visited: { label: "Visited", bg: "#E6F7F0", color: "#004638" },
  reviewed: { label: "Reviewed", bg: "#EAF3FA", color: "#1D4ED8" },
  photo: { label: "Photo", bg: "#F3F0FF", color: "#5B21B6" },
};

const FILTER_OPTIONS = [
  { key: "All", label: "All activities" },
  { key: "Visited", label: "Visited" },
  { key: "Reviews", label: "Reviews" },
  { key: "Photos", label: "Photos" },
];

export default function TravelHistoryPage() {
  const router = useRouter();
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [sortNewest, setSortNewest] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setActivities(MOCK_ACTIVITIES);
      setIsLoading(false);
    }, 500);
  }, []);

  const filtered = activities.filter((a) => {
    if (filter === "Visited") return a.type === "visited";
    if (filter === "Reviews") return a.type === "reviewed";
    if (filter === "Photos") return a.type === "photo";
    return true;
  });

  const sorted = sortNewest ? filtered : [...filtered].reverse();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-[#65748A]">Loading your travel history...</p>
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
          <h1 className="text-3xl md:text-4xl font-bold">My Travel History</h1>
          <p className="text-white/80 mt-2">Explore your journey across Melaka</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1200px] mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {STATS.map((stat) => (
            <div key={stat.label} className="bg-white border border-[#D8E1E7] rounded-[14px] p-5">
              <p className="text-[#10213B] font-bold text-3xl tracking-tight">{stat.value}</p>
              <p className="text-[#65748A] text-sm mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
          <div className="flex items-center gap-2 flex-wrap">
            {FILTER_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === key
                    ? "bg-[#006C56] text-white"
                    : "bg-white border border-[#D8E1E7] text-[#10213B] hover:border-[#006C56]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            value={sortNewest ? "newest" : "oldest"}
            onChange={(e) => setSortNewest(e.target.value === "newest")}
            className="border border-[#D8E1E7] text-[#10213B] bg-white rounded-lg px-3 py-1.5 text-sm outline-none cursor-pointer"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>

        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg className="w-16 h-16 text-[#98A2B3] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <h3 className="text-xl font-semibold text-[#10213B]">No travel history yet</h3>
            <p className="text-[#65748A] mt-2">You haven't explored any attractions yet. Start your journey today!</p>
            <button
              onClick={() => router.push("/")}
              className="mt-6 px-6 py-2 bg-[#FFAB00] text-[#142033] font-semibold rounded-lg hover:bg-[#E89B00] transition-colors"
            >
              Explore Attractions
            </button>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <h3 className="text-xl font-semibold text-[#10213B]">No activities</h3>
            <p className="text-[#65748A] mt-2">No activities match the selected filter.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((activity) => {
              const badge = ACTIVITY_BADGES[activity.type] || ACTIVITY_BADGES.visited;
              return (
                <div
                  key={activity.id}
                  className="bg-white border border-[#D8E1E7] flex items-start gap-4 p-4 rounded-[14px] hover:shadow-lg transition-shadow cursor-pointer"
                >
                  <div
                    className="w-10 h-10 flex items-center justify-center flex-shrink-0 rounded-lg"
                    style={{ background: badge.bg, color: badge.color }}
                  >
                    {activity.type === "visited" && (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                    {activity.type === "reviewed" && (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    )}
                    {activity.type === "photo" && (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: badge.bg, color: badge.color }}
                      >
                        {badge.label}
                      </span>
                      <span className="px-2 py-0.5 bg-[#E6F7F0] text-[#004638] text-xs rounded-full border border-[#A7D7C5]">
                        {activity.attractionCategory}
                      </span>
                    </div>
                    <p className="font-semibold text-[#10213B]">{activity.attractionName}</p>
                    {activity.type === "reviewed" && activity.rating !== undefined && (
                      <div className="flex items-center gap-0.5 mt-1">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className={i < activity.rating ? "text-[#FFAB00]" : "text-[#D8E1E7]"}>
                            ★
                          </span>
                        ))}
                      </div>
                    )}
                    {activity.type === "reviewed" && activity.reviewExcerpt && (
                      <p className="text-[#65748A] text-sm truncate mt-1">{activity.reviewExcerpt}</p>
                    )}
                  </div>
                  <span className="text-[#65748A] text-sm flex-shrink-0">{activity.date}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}