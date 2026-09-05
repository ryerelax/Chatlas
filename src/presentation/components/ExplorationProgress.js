"use client";

import Link from "next/link";
import {
  createExplorationRank,
  EXPLORER_RANK,
} from "@/business/services/explorationRankService";
import { VISITED_DATA_STATUS } from "@/business/services/explorationMapService";
import { useLanguage } from "@/presentation/contexts/LanguageContext";
import { getVisitedAuthenticationPresentation } from "@/presentation/lib/explorationMapPresentation";
import { createExplorationRankPresentation } from "@/presentation/lib/explorationRankPresentation";

const RANK_BADGE_CLASSES = Object.freeze({
  [EXPLORER_RANK.NEW]: "border-[#BBC8D0] bg-[#F1F4F6] text-[#405066]",
  [EXPLORER_RANK.BRONZE]: "border-[#D9B38C] bg-[#FFF3E6] text-[#714000]",
  [EXPLORER_RANK.SILVER]: "border-[#BCC8D3] bg-[#F4F7FA] text-[#354A5F]",
  [EXPLORER_RANK.GOLD]: "border-[#E3BF5B] bg-[#FFF8D9] text-[#6B4A00]",
  [EXPLORER_RANK.MASTER]: "border-[#87CFB4] bg-[#E6F7F0] text-[#004638]",
});

function ProgressState({ status, t }) {
  const isError = status === VISITED_DATA_STATUS.ERROR;
  const authenticationPresentation =
    getVisitedAuthenticationPresentation(status);
  const message = authenticationPresentation
    ? t("signInViewProgress")
    : status === VISITED_DATA_STATUS.LOADING
      ? t("progressLoading")
      : isError
        ? t("progressLoadFailed")
        : t("progressUnavailable");

  return (
    <div
      className={`rounded-2xl border px-5 py-8 text-center ${
        isError
          ? "border-[#F0C8C5] bg-[#FFF9F8]"
          : "border-[#D8E1E7] bg-white"
      }`}
      role={isError ? "alert" : "status"}
    >
      <span
        className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold ${
          isError
            ? "bg-[#FBE9E8] text-[#A43D36]"
            : "bg-[#E6F7F0] text-[#006C56]"
        }`}
        aria-hidden="true"
      >
        {isError ? "!" : status === VISITED_DATA_STATUS.LOADING ? "…" : "i"}
      </span>
      <p className="mt-3 font-semibold text-[#10213B]">{message}</p>
      {authenticationPresentation && (
      <>
        <p className="mt-1 text-sm text-[#65748A]">
          {t("signInViewProgressHint")}
        </p>
        <Link
          href={authenticationPresentation.signInHref}
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[#006C56] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#005E4B] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#006C56]"
        >
          {t("signIn")}
        </Link>
      </>
    )}
    </div>
  );
}

export default function ExplorationProgress({ progress }) {
  const { lang, t } = useLanguage();
  const status = progress?.status;
  const isSuccess = status === VISITED_DATA_STATUS.SUCCESS;
  const totalCount = Number.isInteger(progress?.totalCount)
    ? Math.max(0, progress.totalCount)
    : 0;
  const visitedCount = Number.isInteger(progress?.visitedCount)
    ? Math.min(Math.max(0, progress.visitedCount), totalCount)
    : 0;
  const rawPercentage = Number.isFinite(progress?.percentage)
    ? Math.min(Math.max(0, progress.percentage), 100)
    : 0;
  const percentage = Math.round(rawPercentage * 10) / 10;
  const percentageLabel = `${percentage}%`;
  const rank = createExplorationRank(progress);
  const rankPresentation = createExplorationRankPresentation(rank, lang);

  return (
    <section
      className="rounded-2xl border border-[#D8E1E7] bg-[#F8FBFA] p-4 shadow-sm sm:p-5"
      aria-labelledby="exploration-progress-heading"
      aria-busy={status === VISITED_DATA_STATUS.LOADING}
    >
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#006C56]">
          {t("personalExploration")}
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <h3
            id="exploration-progress-heading"
            className="text-lg font-bold text-[#10213B]"
          >
            {t("explorationProgress")}
          </h3>
          {rankPresentation && (
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${RANK_BADGE_CLASSES[rank.id]}`}
              role="status"
              aria-live="polite"
              aria-atomic="true"
              aria-label={rankPresentation.rankAriaLabel}
            >
              {rankPresentation.rankLabel}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm leading-6 text-[#65748A]">
          {t("progressHint")}
        </p>
      </div>

      {!isSuccess && <ProgressState status={status} t={t} />}

      {isSuccess && totalCount === 0 && (
        <div
          className="rounded-2xl border border-[#D8E1E7] bg-white px-5 py-8 text-center"
          role="status"
        >
          <p className="font-semibold text-[#10213B]">
            {t("noSupportedAttractions")}
          </p>
          <p className="mt-1 text-sm text-[#65748A]">
            {t("progressWhenAvailable")}
          </p>
        </div>
      )}

      {isSuccess && totalCount > 0 && (
        <div className="rounded-2xl border border-[#CFE4DB] bg-white p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="text-sm font-semibold text-[#405066]">
              {t("ofAttractionsVisited", {
                visited: visitedCount,
                total: totalCount,
              })}
            </p>
            <p className="text-3xl font-bold tracking-tight text-[#004638]">
              {percentageLabel}
            </p>
          </div>

          <div
            className="mt-5 h-3 overflow-hidden rounded-full bg-[#DCE8E3]"
            role="progressbar"
            aria-label={t("explorationProgress")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentage}
            aria-valuetext={`${t("ofAttractionsVisited", {
              visited: visitedCount,
              total: totalCount,
            })}, ${percentageLabel}${
              rankPresentation ? `, ${rankPresentation.rankAriaLabel}` : ""
            }`}
            aria-describedby={
              rankPresentation ? "exploration-rank-message" : undefined
            }
          >
            <div
              className="h-full rounded-full bg-[#006C56] transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${percentage}%` }}
            />
          </div>

          {rankPresentation && (
            <p
              id="exploration-rank-message"
              className={`mt-4 text-sm font-semibold leading-6 ${
                rank.isComplete ? "text-[#004638]" : "text-[#405066]"
              }`}
            >
              {rankPresentation.message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}