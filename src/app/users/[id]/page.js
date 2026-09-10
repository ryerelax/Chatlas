"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PublicProfile from "@/presentation/components/PublicProfile";
import { useLanguage } from "@/presentation/contexts/LanguageContext";

export default function PublicUserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useLanguage();
  const userId = params?.id;

  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!userId) return;

    const controller = new AbortController();

    async function loadPublicProfile() {
      try {
        setStatus("loading");
        setErrorMessage("");

        const response = await fetch(`/api/users/${userId}`, {
          method: "GET",
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });

        const result = await response.json();

        if (response.status === 404) {
          setProfile(null);
          setStatus("not_found");
          return;
        }

        if (!response.ok || !result.success) {
          throw new Error(result.message || t("errorGeneric"));
        }

        setProfile(result.data);
        setStatus("success");
      } catch (error) {
        if (error.name === "AbortError") return;
        setProfile(null);
        setErrorMessage(error.message || t("errorGeneric"));
        setStatus("error");
      }
    }

    loadPublicProfile();
    return () => controller.abort();
  }, [userId, t]);

  if (!userId || status === "not_found") {
    return (
      <main className="min-h-screen bg-[#F7F9FB]">
        <div className="mx-auto flex max-w-[1120px] justify-center px-4 py-16 sm:px-6 lg:px-10">
          <section className="w-full max-w-2xl rounded-[18px] border border-[#D8E1E7] bg-white px-6 py-12 text-center">
            <h1 className="mt-5 text-2xl font-bold text-[#10213B]">
              {t("notFound")}
            </h1>
            <p className="mx-auto mt-3 max-w-md leading-7 text-[#405066]">
              {t("errorGeneric")}
            </p>
            <button
              type="button"
              onClick={() => router.back()}
              className="mt-7 min-h-11 rounded-[10px] border border-[#BBC8D0] bg-white px-5 py-3 font-semibold text-[#004638] hover:bg-[#F1F6F4]"
            >
              {t("back")}
            </button>
          </section>
        </div>
      </main>
    );
  }

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-[#F7F9FB]">
        <div className="mx-auto max-w-[1120px] px-4 py-10">
          <p className="mt-4 text-center text-sm text-[#65748A]">
            {t("loading")}
          </p>
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="min-h-screen bg-[#F7F9FB]">
        <div className="mx-auto flex max-w-[1120px] justify-center px-4 py-16">
          <section className="w-full max-w-2xl rounded-[18px] border border-[#D8E1E7] bg-white px-6 py-12 text-center">
            <h1 className="mt-5 text-2xl font-bold text-[#10213B]">
              {t("errorGeneric")}
            </h1>
            <p className="mx-auto mt-3 max-w-md leading-7 text-[#405066]">
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-7 min-h-11 rounded-[10px] bg-[#006C56] px-5 py-3 font-semibold text-white hover:bg-[#005E4B]"
            >
              {t("reset")}
            </button>
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