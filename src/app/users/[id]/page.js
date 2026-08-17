"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PublicProfile from "@/presentation/components/PublicProfile";

export default function PublicUserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params?.id;

  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!userId) {
      return;
    }

    const controller = new AbortController();

    async function loadPublicProfile() {
      try {
        setStatus("loading");
        setErrorMessage("");

        const response = await fetch(`/api/users/${userId}`, {
          method: "GET",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        });

        const result = await response.json();

        if (response.status === 404) {
          setProfile(null);
          setStatus("not_found");
          return;
        }

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || "Unable to load the user profile."
          );
        }

        setProfile(result.data);
        setStatus("success");
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }

        setProfile(null);
        setErrorMessage(
          error.message || "Unable to load the user profile."
        );
        setStatus("error");
      }
    }

    loadPublicProfile();

    return () => {
      controller.abort();
    };
  }, [userId]);

  if (!userId || status === "not_found") {
    return (
      <main className="min-h-screen bg-[#F7F9FB]">
        <div className="mx-auto flex max-w-[1120px] justify-center px-4 py-16 sm:px-6 lg:px-10">
          <section className="w-full max-w-2xl rounded-[18px] border border-[#D8E1E7] bg-white px-6 py-12 text-center">
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E6F7F0] text-2xl font-bold text-[#004638]"
              aria-hidden="true"
            >
              ?
            </div>

            <h1 className="mt-5 text-2xl font-bold text-[#10213B]">
              User profile not found
            </h1>

            <p className="mx-auto mt-3 max-w-md leading-7 text-[#405066]">
              The selected user does not exist, is inactive, or has not made
              their profile public.
            </p>

            <button
              type="button"
              onClick={() => router.back()}
              className="mt-7 min-h-11 rounded-[10px] border border-[#BBC8D0] bg-white px-5 py-3 font-semibold text-[#004638] transition hover:bg-[#F1F6F4] focus:outline-none focus:ring-2 focus:ring-[#006C56] focus:ring-offset-2"
            >
              Go back
            </button>

            {/* TODO: Add a public-user discovery page after the team confirms how users should find other profiles. */}
          </section>
        </div>
      </main>
    );
  }

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-[#F7F9FB]">
        <div className="mx-auto max-w-[1120px] px-4 py-10 sm:px-6 lg:px-10">
          <section
            className="overflow-hidden rounded-[18px] border border-[#D8E1E7] bg-white"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="bg-[#006C56] px-6 py-8 sm:px-8">
              <div className="h-4 w-40 animate-pulse rounded bg-[#61AD9F]" />

              <div className="mt-6 flex items-center gap-5">
                <div className="h-24 w-24 animate-pulse rounded-full bg-[#CDF5E5]" />

                <div className="flex-1">
                  <div className="h-8 max-w-xs animate-pulse rounded bg-[#61AD9F]" />
                  <div className="mt-3 h-4 max-w-lg animate-pulse rounded bg-[#61AD9F]" />
                </div>
              </div>
            </div>

            <div className="space-y-4 px-6 py-8 sm:px-8">
              <div className="h-6 w-48 animate-pulse rounded bg-[#E7ECEF]" />
              <div className="h-4 w-full animate-pulse rounded bg-[#E7ECEF]" />
              <div className="h-4 max-w-2xl animate-pulse rounded bg-[#E7ECEF]" />
            </div>
          </section>

          <p className="mt-4 text-center text-sm text-[#65748A]">
            Loading public profile...
          </p>
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="min-h-screen bg-[#F7F9FB]">
        <div className="mx-auto flex max-w-[1120px] justify-center px-4 py-16 sm:px-6 lg:px-10">
          <section className="w-full max-w-2xl rounded-[18px] border border-[#D8E1E7] bg-white px-6 py-12 text-center">
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FDECEC] text-2xl font-bold text-[#C2413B]"
              aria-hidden="true"
            >
              !
            </div>

            <h1 className="mt-5 text-2xl font-bold text-[#10213B]">
              Unable to load profile
            </h1>

            <p className="mx-auto mt-3 max-w-md leading-7 text-[#405066]">
              {errorMessage}
            </p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-7 min-h-11 rounded-[10px] bg-[#006C56] px-5 py-3 font-semibold text-white transition hover:bg-[#005E4B] focus:outline-none focus:ring-2 focus:ring-[#006C56] focus:ring-offset-2"
            >
              Try again
            </button>

            {/* TODO: Add an offline-specific message when PWA connectivity detection is implemented. */}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F9FB]">
      <div className="mx-auto max-w-[1120px] px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
        <PublicProfile profile={profile} />
      </div>
    </main>
  );
}