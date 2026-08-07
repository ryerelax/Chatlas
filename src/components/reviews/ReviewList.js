import ReviewCard from "./ReviewCard";

const dummyReviews = [
  {
    id: 1,
    userName: "Sarah Chen",
    rating: 5,
    reviewText:
      "Absolutely stunning botanical garden! The orchid pavilion alone is worth the trip.",
    createdAt: "12 Jul 2025",
  },
  {
    id: 2,
    userName: "Amir Rashid",
    rating: 4,
    reviewText:
      "Great place to spend a quiet afternoon. The scenery is beautiful and relaxing.",
    createdAt: "8 Jul 2025",
  },
];

export default function ReviewList() {
  return (
    <div className="space-y-6">
      {dummyReviews.map((review) => (
        <ReviewCard
          key={review.id}
          review={review}
        />
      ))}
    </div>
  );
}