"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ProfileAvatar from "@/presentation/components/ProfileAvatar";
import SocialProfileStatus from "@/presentation/components/SocialProfileStatus";

export default function SocialProfileDirectory() {
  const [profiles, setProfiles] = useState([]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ page: String(page) });
    if (appliedSearch) query.set("search", appliedSearch);

    async function loadProfiles() {
      try {
        const response = await fetch(`/api/profiles?${query.toString()}`, {
          signal: controller.signal,
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Unable to load traveller profiles.");
        }

        setProfiles(result.data || []);
        setTotal(result.count || 0);
        setTotalPages(result.pagination?.totalPages || 1);
        setError("");
      } catch (loadError) {
        if (loadError.name !== "AbortError") {
          setError(loadError.message);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    loadProfiles();
    return () => controller.abort();
  }, [appliedSearch, page]);

  function handleSearch(event) {
    event.preventDefault();
    setIsLoading(true);
    setAppliedSearch(search.trim());
    setPage(1);
  }

  function clearSearch() {
    setSearch("");
    setAppliedSearch("");
    setPage(1);
    setIsLoading(true);
  }

  function changePage(nextPage) {
    setIsLoading(true);
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="min-h-screen bg-attraction-page-bg">
      <section className="bg-attraction-primary text-white">
        <div className="mx-auto max-w-[1120px] px-4 py-11 md:px-6 lg:px-[38px] lg:py-14">
          <p className="font-semibold text-white/80">Chatlas community</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
            Meet fellow Melaka travellers
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/80">
            Discover public traveller profiles and learn from the places they explore.
          </p>

          <form
            onSubmit={handleSearch}
            className="mt-7 flex max-w-2xl flex-col gap-2 sm:flex-row"
          >
            <label htmlFor="profile-search" className="sr-only">
              Search travellers by name or location
            </label>
            <input
              id="profile-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or location"
              maxLength={80}
              className="min-h-[50px] w-full rounded-[14px] border border-white/40 bg-white px-4 text-attraction-ink outline-none focus:ring-2 focus:ring-white sm:flex-1"
            />
            <button
              type="submit"
              className="min-h-[50px] rounded-[10px] bg-[#FFAB00] px-6 font-semibold text-[#142033] transition hover:bg-[#E89B00] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-attraction-primary"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-[1120px] px-4 py-10 md:px-6 lg:px-[38px]">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-attraction-ink">Traveller profiles</h2>
            {!isLoading && !error && (
              <p className="mt-1 text-sm text-attraction-muted">
                {total} public profile{total === 1 ? "" : "s"}
                {appliedSearch ? ` matching “${appliedSearch}”` : ""}
              </p>
            )}
          </div>
          {appliedSearch && (
            <button
              type="button"
              onClick={clearSearch}
              className="min-h-11 rounded-[10px] border border-attraction-border-strong bg-white px-4 text-sm font-semibold text-attraction-primary-dark transition hover:bg-attraction-primary-soft focus:outline-none focus:ring-2 focus:ring-attraction-primary"
            >
              Clear search
            </button>
          )}
        </div>

        {isLoading && <DirectorySkeleton />}

        {!isLoading && error && (
          <SocialProfileStatus
            icon="!"
            title="Unable to load traveller profiles"
            message={error}
            tone="error"
          />
        )}

        {!isLoading && !error && profiles.length === 0 && (
          <SocialProfileStatus
            icon="?"
            title="No traveller profiles found"
            message="Try another name or location, or clear the current search."
          />
        )}

        {!isLoading && !error && profiles.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile) => (
              <ProfileCard key={profile.id} profile={profile} />
            ))}
          </div>
        )}

        {!isLoading && !error && totalPages > 1 && (
          <nav
            className="mt-8 flex items-center justify-center gap-3"
            aria-label="Traveller profile pages"
          >
            <button
              type="button"
              onClick={() => changePage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="min-h-11 rounded-[10px] border border-attraction-border-strong bg-white px-4 text-sm font-semibold text-attraction-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-attraction-muted">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => changePage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="min-h-11 rounded-[10px] border border-attraction-border-strong bg-white px-4 text-sm font-semibold text-attraction-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </nav>
        )}
      </section>
    </main>
  );
}

function ProfileCard({ profile }) {
  return (
    <article className="flex h-full flex-col rounded-[14px] border border-attraction-border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-4">
        <ProfileAvatar
          name={profile.displayName}
          src={profile.profilePicture}
          size="medium"
        />
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-attraction-ink">
            {profile.displayName}
          </h3>
          <p className="mt-0.5 truncate text-sm text-attraction-muted">
            {profile.location || "Location not shared"}
          </p>
        </div>
      </div>
      <p className="mt-4 line-clamp-3 flex-1 text-sm leading-relaxed text-attraction-body">
        {profile.bio || "This traveller has not added a public bio yet."}
      </p>
      <Link
        href={`/profiles/${profile.id}`}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[10px] border border-attraction-border-strong text-sm font-semibold text-attraction-primary-dark transition hover:bg-attraction-primary-soft focus:outline-none focus:ring-2 focus:ring-attraction-primary"
      >
        View public profile
      </Link>
    </article>
  );
}

function DirectorySkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading profiles">
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <div
          key={item}
          className="h-52 animate-pulse rounded-[14px] border border-attraction-border bg-white p-5"
        >
          <div className="flex gap-4">
            <div className="h-14 w-14 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2 pt-2">
              <div className="h-4 rounded bg-gray-200" />
              <div className="h-3 w-2/3 rounded bg-gray-100" />
            </div>
          </div>
          <div className="mt-5 h-14 rounded bg-gray-100" />
          <div className="mt-4 h-11 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}
