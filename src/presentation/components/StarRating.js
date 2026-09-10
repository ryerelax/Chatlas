export default function StarRating({ rating, reviewCount, size = 14 }) {
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5">
        {stars.map((star) => {
          const filled = star <= Math.floor(rating);
          const half = !filled && star === Math.ceil(rating) && rating % 1 >= 0.5;

          return (
            <svg
              key={star}
              width={size}
              height={size}
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
            >
              {half ? (
                <>
                  <defs>
                    <linearGradient id={`star-half-${star}`}>
                      <stop offset="50%" className="text-attraction-rating-star" stopColor="currentColor" />
                      <stop offset="50%" stopColor="#D8E1E7" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M7 1l1.545 3.13L12 4.635l-2.5 2.435.59 3.43L7 8.77l-3.09 1.73.59-3.43L2 4.635l3.455-.505L7 1z"
                    fill={`url(#star-half-${star})`}
                  />
                </>
              ) : (
                <path
                  d="M7 1l1.545 3.13L12 4.635l-2.5 2.435.59 3.43L7 8.77l-3.09 1.73.59-3.43L2 4.635l3.455-.505L7 1z"
                  className={filled ? "text-attraction-rating-star" : ""}
                  fill={filled ? "currentColor" : "#D8E1E7"}
                />
              )}
            </svg>
          );
        })}
      </div>

      <span className="text-[13px] font-semibold leading-none text-attraction-ink">
        {rating.toFixed(1)}
      </span>

      {reviewCount !== undefined && (
        <span className="text-[13px] leading-none text-attraction-muted">
          ({reviewCount.toLocaleString()})
        </span>
      )}
    </div>
  );
}
