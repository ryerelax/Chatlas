import AttractionList from "@/components/AttractionList";
// test
export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* TODO: Replace this simple header with the final Chatlas navigation bar. */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Explore Melaka Attractions
          </h1>

          <p className="mt-2 text-gray-600">
            Discover historical places, museums, nature spots, and local
            attractions around Melaka.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* TODO: Add a personalized hero section or Chatlas introduction banner later. */}
        <AttractionList />
      </div>
    </main>
  );
}