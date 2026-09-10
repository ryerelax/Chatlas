"use client";

import { useLanguage } from "@/presentation/contexts/LanguageContext";

export default function HomeHero() {
  const { t } = useLanguage();

  return (
    <section className="bg-[#0F5A43]">
      <div className="mx-auto max-w-7xl px-6 py-14 md:py-16">
        <p className="mb-4 font-semibold text-white/85">{t("heroEyebrow")}</p>
        <h1 className="max-w-3xl text-3xl font-bold leading-tight text-white md:text-5xl">
          {t("heroTitle")}
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed text-white/80">
          {t("heroSubtitle")}
        </p>
      </div>
    </section>
  );
}