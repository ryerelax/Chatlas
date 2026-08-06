import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* TODO: Replace this temporary wordmark with the final Chatlas logo and brand icon. */}
        <Link
          href="/"
          className="flex items-center gap-3"
          aria-label="Chatlas home"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-xl text-white">
            📍
          </div>

          <div>
            <p className="text-xl font-bold tracking-tight text-gray-900">
              Chatlas
            </p>

            <p className="text-xs text-gray-500">
              Discover Melaka
            </p>
          </div>
        </Link>

        {/* Desktop navigation */}
        <nav
          className="hidden items-center gap-2 md:flex"
          aria-label="Main navigation"
        >
          <Link
            href="/"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-emerald-50 hover:text-emerald-700"
          >
            Home
          </Link>

          <Link
            href="/#attractions"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-emerald-50 hover:text-emerald-700"
          >
            Attractions
          </Link>

          <Link
            href="/exploration-map"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-emerald-50 hover:text-emerald-700"
          >
            Map
          </Link>

          {/* TODO: Enable this navigation item after the social profile and community modules are created. */}
          <span
            className="cursor-not-allowed rounded-lg px-4 py-2 text-sm font-semibold text-gray-400"
            title="Coming later"
            aria-disabled="true"
          >
            Community
          </span>
        </nav>

        <div className="hidden md:block">
          {/* TODO: Integrate Google Identity Services and replace this disabled button with the real sign-in flow. */}
          {/* TODO: Replace this button with a user avatar menu after authentication is implemented. */}
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-lg bg-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-500"
            title="Google Sign In will be added later"
          >
            Sign in with Google
          </button>
        </div>

        {/* Mobile navigation */}
        <details className="relative md:hidden">
          <summary className="cursor-pointer list-none rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700">
            Menu
          </summary>

          {/* TODO: Replace this native details menu with a personalized animated mobile drawer later. */}
          <nav
            className="absolute right-0 mt-3 w-56 rounded-xl border border-gray-200 bg-white p-3 shadow-lg"
            aria-label="Mobile navigation"
          >
            <Link
              href="/"
              className="block rounded-lg px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700"
            >
              Home
            </Link>

            <Link
              href="/#attractions"
              className="block rounded-lg px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700"
            >
              Attractions
            </Link>

            <Link
              href="/exploration-map"
              className="block rounded-lg px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700"
            >
              Map
            </Link>

            <span
              className="block cursor-not-allowed rounded-lg px-4 py-3 text-sm font-semibold text-gray-400"
              aria-disabled="true"
            >
              Community
            </span>

            <div className="my-2 border-t border-gray-200" />

            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-lg bg-gray-100 px-4 py-3 text-left text-sm font-semibold text-gray-400"
            >
              Sign in with Google
            </button>
          </nav>
        </details>
      </div>
    </header>
  );
}
