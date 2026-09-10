export default function ExplorationMapPageLoading() {
  return (
    <main className="min-h-screen bg-[#F7F9FB]" aria-busy="true">
      <div className="h-64 animate-pulse bg-[#006C56]" />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-9">
        <div className="mb-6 h-8 w-64 animate-pulse rounded bg-[#E8EDF1]" />
        <div className="min-h-80 animate-pulse rounded-3xl bg-[#E6F7F0] lg:min-h-136" />
      </div>
    </main>
  );
}
