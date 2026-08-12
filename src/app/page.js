import AttractionList from "@/components/AttractionList";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <section className="bg-[#0F5A43]">
        <div className="mx-auto max-w-7xl px-6 py-14 md:py-16">
          <p className="mb-4 font-semibold text-white/85">
            Explore Melaka with the community
          </p>

          <h1 className="max-w-3xl text-3xl font-bold leading-tight text-white md:text-5xl">
            Discover attractions and record your travel journey
          </h1>

          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-white/80">
            Browse popular and lesser-known attractions, read traveller
            experiences and start exploring Melaka.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <AttractionList />
      </div>
    </main>
  );
}