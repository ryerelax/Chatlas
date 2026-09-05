"use client";

import Link from "next/link";
import { useLanguage } from "@/presentation/contexts/LanguageContext";

export default function OfflinePage() {
  const { t } = useLanguage();

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-16">
      <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <span className="text-4xl">📡</span>

        <h1 className="mt-4 text-xl font-bold text-gray-900">
          {t("errorGeneric")}
        </h1>

        <p className="mt-3 text-gray-600">{t("errorGeneric")}</p>

        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white transition hover:bg-emerald-700"
        >
          {t("browseAttractions")}
        </Link>
      </div>
    </main>
  );
}