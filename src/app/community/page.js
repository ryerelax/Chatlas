"use client";

import CommunityReviewFeed from "@/presentation/components/reviews/CommunityReviewFeed";
import { useLanguage } from "@/presentation/contexts/LanguageContext";

export default function CommunityPage() {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen bg-attraction-surface-soft">
      <section className="bg-[#0F5A43] text-white">
        <div className="mx-auto max-w-[1120px] px-4 py-14 md:px-6 md:py-16 lg:px-[38px]">
          <header className="max-w-3xl">
            <p className="mb-4 font-semibold text-white/85">
              {t("communityHeroEyebrow")}
            </p>
            <h1
              id="community-feed-heading"
              className="max-w-3xl text-3xl font-bold leading-tight text-white md:text-5xl"
            >
              {t("communityHeroTitle")}
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-white/80">
              {t("communityHeroDescription")}
            </p>
          </header>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <CommunityReviewFeed />
      </div>
    </main>
  );
}
