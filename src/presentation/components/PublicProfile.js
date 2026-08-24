/* eslint-disable @next/next/no-img-element */
"use client";

import { useLanguage } from "@/presentation/contexts/LanguageContext";

function getInitials(name) {
  if (!name) {
    return "?";
  }

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function PublicProfile({ profile }) {
  const { t } = useLanguage();
  const initials = getInitials(profile.name);

  return (
    <article className="overflow-hidden rounded-[18px] border border-[#D8E1E7] bg-white">
      <section className="bg-[#006C56] px-6 py-8 text-white sm:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#CDF5E5]">
          {t("publicProfile")}
        </p>

        <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
          {profile.profilePicture ? (
            <>
              {/* TODO: Replace this img element with next/image after the final Google or Cloudinary image domains are confirmed. */}
              <img
                src={profile.profilePicture}
                alt={`${profile.name}'s profile picture`}
                className="h-24 w-24 rounded-full border-4 border-white object-cover"
              />
            </>
          ) : (
            <div
              className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-[#CDF5E5] text-2xl font-bold text-[#004638]"
              aria-label={`${profile.name}'s default profile avatar`}
            >
              {initials}
            </div>
          )}

          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-[34px]">
              {profile.name}
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#E6F7F0] sm:text-base">
              {t("publicProfile")}
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 py-7 sm:px-8">
        <h2 className="text-xl font-semibold text-[#10213B]">{t("about")}</h2>

        {profile.publicSummary ? (
          <p className="mt-3 max-w-3xl leading-7 text-[#405066]">
            {profile.publicSummary}
          </p>
        ) : (
          <div className="mt-4 rounded-[14px] bg-[#F1F6F4] px-5 py-6">
            <p className="font-medium text-[#10213B]">{t("noPublicBio")}</p>
            <p className="mt-1 text-sm leading-6 text-[#65748A]">
              {t("noPublicBio")}
            </p>
          </div>
        )}
      </section>

      <section className="border-t border-[#E8EDF1] px-6 py-7 sm:px-8">
        <h2 className="text-xl font-semibold text-[#10213B]">
          {t("travelActivity")}
        </h2>

        <div className="mt-4 rounded-[18px] bg-[#F1F6F4] px-5 py-7">
          <p className="font-medium text-[#10213B]">
            {t("travelActivityComingSoon")}
          </p>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#65748A]">
            {t("travelActivityComingSoon")}
          </p>

          {/* TODO: Integrate the selected user's public reviews when PB36 is implemented. */}
          {/* TODO: Integrate the selected user's public exploration map when PB37 is implemented. */}
          {/* TODO: Add exploration progress comparison after PB38 is implemented. */}
        </div>
      </section>
    </article>
  );
}