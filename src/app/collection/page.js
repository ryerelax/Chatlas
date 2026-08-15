"use client";

import { useRouter } from "next/navigation";

const CARDS = [
  {
    page: "/wishlist",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    label: "Wishlist",
    count: "3 items",
    description: "Attractions you plan to visit",
    accent: "#006C56",
    accentSoft: "#E6F7F0",
  },
  {
    page: "/favourites",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    label: "Favourites",
    count: "5 items",
    description: "Attractions you loved",
    accent: "#FFAB00",
    accentSoft: "#FFF3D6",
  },
  {
    page: "/reviews",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    label: "My Reviews",
    count: "12 reviews",
    description: "Your travel experiences",
    accent: "#2F6DA1",
    accentSoft: "#EAF3FA",
  },
  {
    page: "/photos",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    label: "My Photos",
    count: "8 photos",
    description: "Your uploaded photos",
    accent: "#7C3AED",
    accentSoft: "#F3F0FF",
  },
  {
    page: "/travel-history",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    label: "Travel History",
    count: "6 attractions",
    description: "Your exploration journey",
    accent: "#16845B",
    accentSoft: "#E8F7EF",
  },
];

export default function CollectionHub() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#F7F9FB]">
      {/* Hero */}
      <div className="bg-[#006C56] py-14 px-4">
        <div className="max-w-[760px] mx-auto text-center">
          <p className="text-white/70 font-semibold text-sm uppercase tracking-wide mb-3">
            Your travel records
          </p>
          <h1 className="text-white font-bold text-4xl md:text-5xl tracking-tight">
            My Collection
          </h1>
          <p className="text-white/80 text-lg mt-4">
            Manage your wishlist, favourites, reviews, photos, and travel history
          </p>
        </div>
      </div>

      {/* Collection Cards */}
      <div className="max-w-[1200px] mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-[#10213B] font-bold text-xl">Your Collection</h2>
            <p className="text-[#65748A] text-sm">26 total activities across all categories</p>
          </div>
          <div className="flex items-center gap-2 text-[#65748A] text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Melaka, Malaysia
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
          {CARDS.map((card) => (
            <button
              key={card.label}
              onClick={() => router.push(card.page)}
              className="bg-white border border-[#D8E1E7] text-left transition-all hover:shadow-lg hover:-translate-y-0.5 rounded-[14px] p-6"
            >
              <div
                className="w-12 h-12 flex items-center justify-center mb-4 rounded-xl"
                style={{ background: card.accentSoft, color: card.accent }}
              >
                {card.icon}
              </div>
              <span
                className="inline-block px-2.5 py-0.5 rounded-full font-medium text-xs mb-3"
                style={{ background: card.accentSoft, color: card.accent }}
              >
                {card.count}
              </span>
              <h3 className="text-[#10213B] font-semibold text-base mb-1">{card.label}</h3>
              <p className="text-[#65748A] text-sm leading-snug">{card.description}</p>
              <div
                className="flex items-center gap-1 mt-4 font-medium text-sm transition-all group"
                style={{ color: card.accent }}
              >
                <span>Open</span>
                <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>

        {/* Quick stats */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Attractions visited", value: "6" },
            { label: "Reviews written", value: "12" },
            { label: "Photos uploaded", value: "8" },
            { label: "Total activities", value: "26" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white border border-[#D8E1E7] rounded-[14px] p-5">
              <p className="text-[#10213B] font-bold text-3xl tracking-tight">{stat.value}</p>
              <p className="text-[#65748A] text-sm mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}