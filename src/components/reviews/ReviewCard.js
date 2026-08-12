export default function ReviewCard({ review = {} }) {
  const userName = review.userName || "Chatlas traveller";
  const rating = Number(review.rating) || 0;

  return (
    <article className="bg-white py-[18px]">
      <div className="flex items-start gap-3">
        {review.userAvatar ? (
          <img
            src={review.userAvatar}
            alt={`${userName}'s profile`}
            className="h-14 w-14 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-attraction-primary-soft-strong text-base font-semibold text-attraction-primary-dark"
            aria-hidden="true"
          >
            {getInitials(userName)}
          </div>
        )}

        <div className="min-w-0 flex-1 sm:flex sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h3 className="text-base font-semibold leading-snug text-attraction-ink">
              {userName}
            </h3>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex gap-0.5" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg key={star} width="16" height="16" viewBox="0 0 14 14">
                    <path
                      d="M7 1l1.545 3.13L12 4.635l-2.5 2.435.59 3.43L7 8.77l-3.09 1.73.59-3.43L2 4.635l3.455-.505L7 1z"
                      fill={star <= rating ? "#FFAB00" : "#D8E1E7"}
                    />
                  </svg>
                ))}
              </div>
              <span className="sr-only">{rating} out of 5 stars</span>
              <span
                className="text-[13px] font-medium text-attraction-body"
                aria-hidden="true"
              >
                {rating}/5
              </span>
            </div>
          </div>
          <time
            dateTime={review.createdAt}
            className="mt-1 block text-[13px] font-medium text-attraction-muted sm:mt-0 sm:shrink-0"
          >
            {formatReviewDate(review.createdAt)}
          </time>
        </div>
      </div>

      <p className="mt-4 whitespace-pre-wrap break-words text-base leading-relaxed text-attraction-body">
        {review.reviewText}
      </p>
    </article>
  );
}

function getInitials(userName) {
  return userName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((namePart) => namePart[0])
    .join("")
    .toUpperCase();
}

function formatReviewDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
