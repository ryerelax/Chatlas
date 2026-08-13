"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ProfileAvatar from "@/presentation/components/ProfileAvatar";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }

    if (status !== "authenticated") return;

    let cancelled = false;

    async function loadUserData() {
      try {
        const response = await fetch("/api/user");
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Unable to load your profile.");
        }

        if (!cancelled) setUserData(result.data);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadUserData();
    return () => {
      cancelled = true;
    };
  }, [status, router]);

  if (status === "loading" || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-attraction-page-bg">
        <p className="text-attraction-primary">Loading your profile...</p>
      </main>
    );
  }

  if (!session) return null;

  const displayName =
    userData?.displayName || session.user.displayName || session.user.name || "User";
  const profilePicture = userData?.profilePicture || session.user.image || "";
  const bio = userData?.bio || session.user.bio || "";
  const location = userData?.location || session.user.location || "";
  const joinedAt = userData?.joinedAt
    ? new Intl.DateTimeFormat("en-GB", {
        month: "long",
        year: "numeric",
      }).format(new Date(userData.joinedAt))
    : "date unavailable";

  // TODO: Replace unavailable personal activity totals when the Review &
  // Community and Exploration Map modules expose their data services.
  const stats = [
    { label: "Places visited", value: "—" },
    { label: "Reviews written", value: "—" },
    { label: "Photos uploaded", value: "—" },
    { label: "Saved places", value: "—" },
  ];

  return (
    <main className="min-h-screen bg-attraction-page-bg px-4 py-10">
      <div className="mx-auto max-w-4xl">
        {error && (
          <div className="mb-6 rounded-[10px] bg-[#FDECEC] px-4 py-3 text-sm text-[#C2413B]" role="alert">
            {error}
          </div>
        )}

        <section className="rounded-[18px] border border-attraction-border bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
            <ProfileAvatar name={displayName} src={profilePicture} size="large" />
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-attraction-ink">{displayName}</h1>
              <p className="text-attraction-muted">{userData?.email || session.user.email}</p>
              {location && <p className="mt-1 text-sm text-attraction-muted">{location}</p>}
              <p className="mt-1 text-sm text-attraction-muted">Member since {joinedAt}</p>
              {bio && <p className="mt-3 leading-relaxed text-attraction-body">{bio}</p>}
            </div>
            <Link
              href="/profile/edit"
              className="inline-flex min-h-11 items-center rounded-[10px] border border-attraction-primary px-5 text-sm font-semibold text-attraction-primary transition hover:bg-attraction-primary hover:text-white"
            >
              Edit profile
            </Link>
          </div>
        </section>

        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-[14px] border border-attraction-border bg-white p-4 text-center">
              <p className="text-2xl font-bold text-attraction-primary">{stat.value}</p>
              <p className="mt-1 text-sm text-attraction-muted">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <Link
            href="/profiles"
            className="inline-flex min-h-11 items-center rounded-[10px] border border-attraction-border-strong bg-white px-5 text-sm font-semibold text-attraction-primary-dark transition hover:bg-attraction-primary-soft"
          >
            Browse traveller profiles
          </Link>
        </div>

        <section className="mt-6 rounded-[18px] border border-attraction-border bg-white p-6 md:p-8">
          <h2 className="text-xl font-bold text-attraction-ink">Recent reviews</h2>
          <p className="mt-3 text-attraction-muted">You haven&apos;t written any reviews yet.</p>
        </section>
      </div>
    </main>
  );
}
