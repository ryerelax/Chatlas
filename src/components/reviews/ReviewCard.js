export default function ReviewCard({ review }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

      {/* Header */}
      <div className="flex items-start justify-between">

        {/* User */}
        <div className="flex items-center gap-4">

          {/* Avatar */}
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 text-xl font-semibold text-white">
            SC
          </div>

          {/* Name & Rating */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Sarah Chen
            </h3>

            <div className="mt-1 text-lg tracking-wide text-amber-500">
              ★★★★★
            </div>
          </div>

        </div>

        {/* Date */}
        <p className="text-sm text-gray-500">
          12 Jul 2025
        </p>

      </div>

      {/* Review */}
      <p className="mt-5 leading-8 text-gray-700">
        Absolutely stunning botanical garden! The orchid pavilion alone is
        worth the trip. The walking paths are well-maintained and the plant
        labelling is excellent for nature enthusiasts.
      </p>

      {/* Photos */}
      <div className="mt-6 flex gap-4">

        <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-gray-200 text-sm text-gray-500">
          Photo
        </div>

        <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-gray-200 text-sm text-gray-500">
          Photo
        </div>

        <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-gray-200 text-sm text-gray-500">
          Photo
        </div>

      </div>

    </div>
  );
}