import AttractionList from "@/presentation/components/AttractionList";
import HomeHero from "@/presentation/components/HomeHero";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <HomeHero />
      <div className="mx-auto max-w-7xl px-6 py-10">
        <AttractionList />
      </div>
    </main>
  );
}