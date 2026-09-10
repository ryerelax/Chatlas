"use client";

import ExplorationMap from "@/presentation/components/ExplorationMap";
import { useLanguage } from "@/presentation/contexts/LanguageContext";

export default function ExplorationMapPage() {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen bg-[#F7F9FB]">
      <section className="bg-[#0F5A43] text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-9">
          <p className="mb-4 font-semibold text-white/85">
            {t("mapHeroEyebrow")}
          </p>
          <h1 className="max-w-3xl text-3xl font-bold leading-tight text-white md:text-5xl">
            {t("mapHeroTitle")}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-white/80">
            {t("mapHeroDescription")}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-9 lg:py-12">
        <ExplorationMap />
      </div>
    </main>
  );
}
