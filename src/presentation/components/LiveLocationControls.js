"use client";

import { useLanguage } from "@/presentation/contexts/LanguageContext";
import {
  LIVE_LOCATION_STATUS,
  getLiveLocationCopy,
} from "@/presentation/lib/liveLocationPresentation";

const PRIMARY_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-[#1769E0] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0F57BD] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#1769E0] disabled:cursor-not-allowed disabled:bg-[#A8B7CA]";
const SECONDARY_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-[#8EA2BC] bg-white px-4 py-2.5 text-sm font-bold text-[#25496F] transition hover:bg-[#EDF5FF] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#1769E0] disabled:cursor-not-allowed disabled:border-[#CAD3DE] disabled:text-[#8A98A8]";

export default function LiveLocationControls({
  status,
  errorKey,
  hasPosition,
  canStart,
  onStart,
  onRecenter,
  onStop,
}) {
  const { lang } = useLanguage();
  const copy = getLiveLocationCopy(lang);
  const isRequesting = status === LIVE_LOCATION_STATUS.REQUESTING;
  const isTracking = status === LIVE_LOCATION_STATUS.TRACKING;
  const isError = status === LIVE_LOCATION_STATUS.ERROR;
  const isActive = isRequesting || isTracking;

  return (
    <section
      className="mb-5 rounded-2xl border border-[#B8CEE8] bg-[linear-gradient(135deg,#F8FBFF_0%,#EDF5FF_100%)] p-4 shadow-sm sm:p-5"
      aria-label={copy.controlsLabel}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div
            className="flex items-center gap-2 text-sm font-bold text-[#25496F]"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span
              className={`h-3 w-3 shrink-0 rounded-full border-2 border-white shadow-[0_0_0_2px_#1769E0] ${
                isTracking ? "bg-[#1769E0]" : "bg-white"
              }`}
              aria-hidden="true"
            />
            <span>
              {isRequesting
                ? copy.requesting
                : isTracking
                  ? copy.tracking
                  : copy.show}
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52677E]">
            {copy.privacy}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2" role="group" aria-label={copy.actionsLabel}>
          {!isActive && (
            <button
              type="button"
              onClick={onStart}
              disabled={!canStart}
              className={PRIMARY_BUTTON_CLASS}
            >
              {isError ? copy.retry : copy.show}
            </button>
          )}
          {isActive && (
            <>
              <button
                type="button"
                onClick={onRecenter}
                disabled={!hasPosition}
                className={SECONDARY_BUTTON_CLASS}
              >
                {copy.recenter}
              </button>
              <button
                type="button"
                onClick={onStop}
                className={SECONDARY_BUTTON_CLASS}
              >
                {copy.stop}
              </button>
            </>
          )}
        </div>
      </div>

      {isError && errorKey && (
        <p
          className="mt-3 rounded-xl border border-[#F0C8C5] bg-[#FFF7F6] px-3 py-2 text-sm font-semibold leading-6 text-[#8A302B]"
          role="alert"
          aria-live="assertive"
        >
          {copy.errors[errorKey] || copy.errors.positionUnavailable}
        </p>
      )}
    </section>
  );
}
