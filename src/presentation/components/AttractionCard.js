import Image from "next/image";
import Link from "next/link";

export default function AttractionCard({ attraction }) {
  const coverPhoto = attraction.photos?.[0];
  const combinedRating = attraction.combinedRating ?? attraction.rating ?? 0;
  const chatlasReviewCount = attraction.chatlasReviewCount ?? 0;
  const googleReviewCount = attraction.googleReviewCount ?? attraction.totalReviews ?? 0;

  return (
    // TODO: Refine the card colors, spacing, and visual style based on the final Chatlas branding.
    // NOTE: The whole card is the click target. If an interactive element (e.g. a future
    // favorite/save icon) is added inside, give it its own onClick with event.stopPropagation()
    // so it doesn't also trigger this navigation.
    <Link
      href={`/attractions/${attraction._id}`}
      className="block overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
    >
      {coverPhoto ? (
        <div className="relative h-44 w-full">
          <Image
            src={coverPhoto}
            alt={attraction.name}
            fill
            sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      ) : (
        <div className="flex h-44 items-center justify-center bg-gray-100">
          <span className="text-5xl">📍</span>
        </div>
      )}

      <div className="p-5">
        <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
          {attraction.category || "Uncategorized"}
        </span>

        {attraction.submittedBy && (
          <span className="ml-2 inline-block rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
            Added by a Chatlas user
          </span>
        )}

        <h2 className="mt-3 text-xl font-bold text-gray-900">
          {attraction.name}
        </h2>

        <p className="mt-2 line-clamp-2 text-sm text-gray-600">
          {attraction.address}
        </p>

        <div className="mt-4">
          <span className="font-semibold text-amber-500">
            ★ {combinedRating.toFixed(1)}
          </span>

          <p className="mt-1 text-xs text-gray-500">
            {chatlasReviewCount.toLocaleString()} on Chatlas, {googleReviewCount.toLocaleString()} on Google Maps
          </p>
        </div>
      </div>
    </Link>
  );
}