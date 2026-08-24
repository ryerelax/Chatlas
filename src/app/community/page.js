"use client";

import CommunityReviewFeed from "@/presentation/components/reviews/CommunityReviewFeed";
import { useLanguage } from "@/presentation/contexts/LanguageContext";

export default function CommunityPage() {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen bg-attraction-surface-soft">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <header className="mb-7 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-attraction-primary-dark">
            {t("community")}
          </p>
          <h1
            id="community-feed-heading"
            className="mt-2 text-3xl font-bold tracking-tight text-attraction-ink sm:text-4xl"
          >
            {t("communityTitle")}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-attraction-body sm:text-lg">
            {t("latestReviews")}
          </p>
        </header>

        <CommunityReviewFeed />
      </div>
    </main>
  );
}