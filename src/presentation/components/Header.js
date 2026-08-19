"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { useLanguage } from "@/presentation/contexts/LanguageContext";

export default function Header() {
  const { data: session, status } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { lang, changeLang, t } = useLanguage();

  const isLoggedIn = status === "authenticated";

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3" aria-label="Chatlas home">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-xl text-white">
            📍
          </div>
          <div>
            <p className="text-xl font-bold tracking-tight text-gray-900">Chatlas</p>
            <p className="text-xs text-gray-500">Discover Melaka</p>
          </div>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden items-center gap-2 md:flex" aria-label="Main navigation">
          <Link
            href="/"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-emerald-50 hover:text-emerald-700"
          >
            {t("home")}
          </Link>
          <Link
            href="/#attractions"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-emerald-50 hover:text-emerald-700"
          >
            {t("attractions")}
          </Link>
          {isLoggedIn && (
            <Link
              href="/attractions/submit"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-emerald-50 hover:text-emerald-700"
            >
              {t("addAttraction")}
            </Link>
          )}
          <Link
            href="/exploration-map"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-emerald-50 hover:text-emerald-700"
          >
            {t("map")}
          </Link>
          <Link
            href="/reviews"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-emerald-50 hover:text-emerald-700"
          >
            {t("community")}
          </Link>
        </nav>

        {/* Desktop auth + language */}
        <div className="hidden items-center gap-3 md:flex">
          {/* Language switcher */}
          <div className="flex overflow-hidden rounded-lg border border-gray-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => changeLang("en")}
              className={`px-2.5 py-1.5 ${
                lang === "en"
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => changeLang("zh")}
              className={`px-2.5 py-1.5 ${
                lang === "zh"
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              中
            </button>
            <button
              type="button"
              onClick={() => changeLang("ms")}
              className={`px-2.5 py-1.5 ${
                lang === "ms"
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              BM
            </button>
          </div>

          {isLoggedIn ? (
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 focus:outline-none"
              >
                <img
                  src={
                    session?.user?.image ||
                    session?.user?.picture ||
                    "/default-avatar.png"
                  }
                  alt={
                    session?.user?.displayName ||
                    session?.user?.name ||
                    "Profile"
                  }
                  className="h-8 w-8 rounded-full border border-gray-300 object-cover"
                  onError={(e) => {
                    e.currentTarget.src = "/default-avatar.png";
                  }}
                />
                <span className="hidden text-sm text-gray-700 sm:inline">
                  {session?.user?.displayName ||
                    session?.user?.name?.split(" ")[0] ||
                    "User"}
                </span>
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 z-10 mt-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg">
                  <Link
                    href="/profile"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    👤 {t("myProfile")}
                  </Link>
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      signOut({ redirectTo: "/login" });
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-50"
                  >
                    🚪 {t("logout")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              {t("signIn")}
            </Link>
          )}
        </div>

        {/* Mobile navigation */}
        <details className="relative md:hidden">
          <summary className="cursor-pointer list-none rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700">
            {t("menu")}
          </summary>
          <nav
            className="absolute right-0 mt-3 w-56 rounded-xl border border-gray-200 bg-white p-3 shadow-lg"
            aria-label="Mobile navigation"
          >
            <div className="mb-2 flex overflow-hidden rounded-lg border border-gray-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => changeLang("en")}
                className={`flex-1 px-2 py-1.5 ${
                  lang === "en" ? "bg-emerald-600 text-white" : "bg-white text-gray-600"
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => changeLang("zh")}
                className={`flex-1 px-2 py-1.5 ${
                  lang === "zh" ? "bg-emerald-600 text-white" : "bg-white text-gray-600"
                }`}
              >
                中
              </button>
              <button
                type="button"
                onClick={() => changeLang("ms")}
                className={`flex-1 px-2 py-1.5 ${
                  lang === "ms" ? "bg-emerald-600 text-white" : "bg-white text-gray-600"
                }`}
              >
                BM
              </button>
            </div>

            <Link
              href="/"
              className="block rounded-lg px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700"
            >
              {t("home")}
            </Link>
            <Link
              href="/#attractions"
              className="block rounded-lg px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700"
            >
              {t("attractions")}
            </Link>
            {isLoggedIn && (
              <Link
                href="/attractions/submit"
                className="block rounded-lg px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700"
              >
                {t("addAttraction")}
              </Link>
            )}
            <Link
              href="/exploration-map"
              className="block rounded-lg px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700"
            >
              {t("map")}
            </Link>
            <Link
              href="/reviews"
              className="block rounded-lg px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700"
            >
              {t("community")}
            </Link>
            <div className="my-2 border-t border-gray-200" />

            {isLoggedIn ? (
              <>
                <Link
                  href="/profile"
                  className="block rounded-lg px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700"
                >
                  👤 {t("myProfile")}
                </Link>
                <button
                  onClick={() => signOut({ redirectTo: "/login" })}
                  className="w-full rounded-lg px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-gray-50"
                >
                  🚪 {t("logout")}
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="block rounded-lg bg-emerald-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-emerald-700"
              >
                {t("signIn")}
              </Link>
            )}
          </nav>
        </details>
      </div>
    </header>
  );
}