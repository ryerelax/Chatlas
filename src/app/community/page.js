import CommunityReviewFeed from "@/presentation/components/reviews/CommunityReviewFeed";

export const metadata = {
  title: "Community reviews | Chatlas",
  description:
    "Discover reviews and photos shared by travellers exploring Melaka.",
};

export default function CommunityPage() {
  return (
    <main className="min-h-screen bg-attraction-surface-soft">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <header className="mb-7 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-attraction-primary-dark">
            Review &amp; Community
          </p>
          <h1
            id="community-feed-heading"
            className="mt-2 text-3xl font-bold tracking-tight text-attraction-ink sm:text-4xl"
          >
            Community reviews
          </h1>
          <p className="mt-3 text-base leading-relaxed text-attraction-body sm:text-lg">
            See what travellers are sharing about attractions across Melaka.
          </p>
        </header>

        <CommunityReviewFeed />
      </div>
    </main>
  );
}
