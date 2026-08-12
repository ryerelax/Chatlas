import Link from "next/link";

export const metadata = {
  title: "You're offline — Chatlas",
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-16">
      <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <span className="text-4xl">📡</span>

        <h1 className="mt-4 text-xl font-bold text-gray-900">
          You&apos;re offline
        </h1>

        <p className="mt-3 text-gray-600">
          This page hasn&apos;t been viewed yet, so it isn&apos;t available offline.
          Attractions and searches you&apos;ve already opened will still work.
        </p>

        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white transition hover:bg-emerald-700"
        >
          Back to Attractions
        </Link>
      </div>
    </main>
  );
}
