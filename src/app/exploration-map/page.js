import ExplorationMap from "@/presentation/components/ExplorationMap";

export const metadata = {
  title: "Personal Exploration Map | Chatlas",
  description: "Explore supported attractions across Melaka on the Chatlas map.",
};

export default function ExplorationMapPage() {
  return (
    <main className="min-h-screen bg-[#F7F9FB]">
      <section className="bg-[#006C56] text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-9">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#CDF5E5]">
            Your journey at a glance
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Personal Exploration Map
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#E6F7F0] sm:text-lg">
            Discover where Chatlas attractions are located across Melaka and open any place to learn more.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-9 lg:py-12">
        <ExplorationMap />
      </div>
    </main>
  );
}
