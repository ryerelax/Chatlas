// Review-count-weighted combined rating: Google's rating and Chatlas's own
// review average, weighted by how many reviews back each one. When there are
// zero Chatlas reviews, this reduces exactly to googleRating (the
// chatlasAvgRating * 0 term vanishes and the denominator is just
// googleReviewCount). When both counts are zero, there's nothing to weight,
// so it falls back to googleRating as-is (matches the existing "0" display
// for attractions with no rating data at all).
export function computeCombinedRating({
  googleRating = 0,
  googleReviewCount = 0,
  chatlasAvgRating = 0,
  chatlasReviewCount = 0,
} = {}) {
  const totalReviewCount = googleReviewCount + chatlasReviewCount;

  if (totalReviewCount === 0) {
    return googleRating;
  }

  return (
    (googleRating * googleReviewCount + chatlasAvgRating * chatlasReviewCount) /
    totalReviewCount
  );
}
