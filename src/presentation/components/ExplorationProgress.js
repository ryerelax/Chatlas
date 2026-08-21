import Link from "next/link";
import { VISITED_DATA_STATUS } from "@/business/services/explorationMapService";
import { getVisitedAuthenticationPresentation } from "@/presentation/lib/explorationMapPresentation";

function ProgressState({ status }) {
  const isError = status === VISITED_DATA_STATUS.ERROR;
  const authenticationPresentation =
    getVisitedAuthenticationPresentation(status);
  const message =
    authenticationPresentation
      ? "Sign in to view exploration progress"
      : status === VISITED_DATA_STATUS.LOADING
      ? "Loading exploration progress..."
      : isError
        ? "Unable to load exploration progress"
        : "Exploration progress unavailable";

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
            {authenticationPresentation.message}
          </p>
          <Link
            href={authenticationPresentation.signInHref}
            className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[#006C56] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#005E4B] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#006C56]"
          >
            {authenticationPresentation.signInLabel}
          </Link>
        </>
      )}
    </div>
  );
}

export default function ExplorationProgress({ progress }) {
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

  return (
    <section
      className="rounded-2xl border border-[#D8E1E7] bg-[#F8FBFA] p-4 shadow-sm sm:p-5"
      aria-labelledby="exploration-progress-heading"
      aria-busy={status === VISITED_DATA_STATUS.LOADING}
    >
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#006C56]">
          Personal exploration
        </p>
        <h3
          id="exploration-progress-heading"
          className="mt-1 text-lg font-bold text-[#10213B]"
        >
          Exploration progress
        </h3>
        <p className="mt-1 text-sm leading-6 text-[#65748A]">
          Your verified visits across supported Melaka attractions.
        </p>
      </div>

      {!isSuccess && <ProgressState status={status} />}

      {isSuccess && totalCount === 0 && (
        <div className="rounded-2xl border border-[#D8E1E7] bg-white px-5 py-8 text-center" role="status">
          <p className="font-semibold text-[#10213B]">
            No supported attractions available
          </p>
          <p className="mt-1 text-sm text-[#65748A]">
            Progress will appear when supported attractions are available.
          </p>
        </div>
      )}

      {isSuccess && totalCount > 0 && (
        <div className="rounded-2xl border border-[#CFE4DB] bg-white p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="text-sm font-semibold text-[#405066]">
              {visitedCount} of {totalCount} attractions visited
            </p>
            <p className="text-3xl font-bold tracking-tight text-[#004638]">
              {percentageLabel}
            </p>
          </div>

          <div
            className="mt-5 h-3 overflow-hidden rounded-full bg-[#DCE8E3]"
            role="progressbar"
            aria-label="Exploration progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentage}
            aria-valuetext={`${visitedCount} of ${totalCount} attractions visited, ${percentageLabel}`}
          >
            <div
              className="h-full rounded-full bg-[#006C56] transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
