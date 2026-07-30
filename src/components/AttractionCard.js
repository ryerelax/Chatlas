import Link from "next/link";

export default function AttractionCard({ attraction }) {
  return (
    <>
      {/* TODO: Refine the card colors, spacing, and visual style based on the final Chatlas branding. */}
      <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
        {/* TODO: Replace this placeholder with the attraction image or a custom Chatlas visual. */}
        <div className="flex h-44 items-center justify-center bg-gray-100">
          <span className="text-5xl">📍</span>
        </div>

        <div className="p-5">
          <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            {attraction.category || "Uncategorized"}
          </span>

          <h2 className="mt-3 text-xl font-bold text-gray-900">
            {attraction.name}
          </h2>

          <p className="mt-2 line-clamp-2 text-sm text-gray-600">
            {attraction.address}
          </p>

          <div className="mt-4">
            <span className="font-semibold text-amber-500">
              ★ {attraction.rating || 0}
            </span>

            <span className="ml-2 text-sm text-gray-500">
              ({attraction.totalReviews || 0} reviews)
            </span>
          </div>

          <Link
            href={`/attractions/${attraction._id}`}
            className="mt-5 block w-full rounded-lg bg-emerald-600 px-4 py-2 text-center font-semibold text-white transition hover:bg-emerald-700"
          >
            View Details
          </Link>
        </div>
      </article>
    </>
  );
}