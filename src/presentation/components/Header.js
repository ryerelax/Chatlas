"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import ProfileAvatar from "@/presentation/components/ProfileAvatar";

export default function Header() {
  const { data: session, status } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const isLoggedIn = status === "authenticated";

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3" aria-label="Chatlas home">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-xl text-white">📍</div>
          <div>
            <p className="text-xl font-bold tracking-tight text-gray-900">Chatlas</p>
            <p className="text-xs text-gray-500">Discover Melaka</p>
          </div>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden items-center gap-2 md:flex" aria-label="Main navigation">
          <Link href="/" className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-emerald-50 hover:text-emerald-700">Home</Link>
          <Link href="/#attractions" className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-emerald-50 hover:text-emerald-700">Attractions</Link>
          <span className="cursor-not-allowed rounded-lg px-4 py-2 text-sm font-semibold text-gray-400" title="Coming later">Map</span>
          <Link href="/profiles" className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-emerald-50 hover:text-emerald-700">Travellers</Link>
        </nav>

        {/* Desktop auth */}
        <div className="hidden md:block">
          {isLoggedIn ? (
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 focus:outline-none"
              >
                <ProfileAvatar
                  name={session.user.displayName || session.user.name || "User"}
                  src={session.user.image || ""}
                  size="small"
                />
                <span className="text-sm text-gray-700 hidden sm:inline">
                  {session.user.displayName || session.user.name?.split(" ")[0] || "User"}
                </span>
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                  <Link
                    href="/profile"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    👤 My Profile
                  </Link>
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      signOut({ redirectTo: "/login" });
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                  >
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition"
            >
              Sign in
            </Link>
          )}
        </div>

        {/* Mobile navigation */}
        <details className="relative md:hidden">
          <summary className="cursor-pointer list-none rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700">Menu</summary>
          <nav className="absolute right-0 mt-3 w-56 rounded-xl border border-gray-200 bg-white p-3 shadow-lg" aria-label="Mobile navigation">
            <Link href="/" className="block rounded-lg px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700">Home</Link>
            <Link href="/#attractions" className="block rounded-lg px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700">Attractions</Link>
            <span className="block cursor-not-allowed rounded-lg px-4 py-3 text-sm font-semibold text-gray-400">Map</span>
            <Link href="/profiles" className="block rounded-lg px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700">Travellers</Link>
            <div className="my-2 border-t border-gray-200" />

            {isLoggedIn ? (
              <>
                <Link href="/profile" className="block rounded-lg px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700">👤 My Profile</Link>
                <button
                  onClick={() => signOut({ redirectTo: "/login" })}
                  className="w-full text-left rounded-lg px-4 py-3 text-sm font-semibold text-red-600 hover:bg-gray-50"
                >
                  🚪 Logout
                </button>
              </>
            ) : (
              <Link href="/login" className="block rounded-lg bg-emerald-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-emerald-700">Sign in</Link>
            )}
          </nav>
        </details>
      </div>
    </header>
  );
}
