"use client";

/* eslint-disable @next/next/no-img-element -- Public profile avatars can come from user-configured hosts outside the attraction image allowlist. */

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  buildVerifiedPhotoDeleteUrl,
  formatMalaysiaDisplayDate,
  getVerifiedPhotoDeleteActionState,
  getVerifiedPhotoDeleteResponseDecision,
  getVerifiedPhotoLoadFailureDecision,
  normaliseVerifiedPhotosPayload,
  removeConfirmedVerifiedPhoto,
  VERIFIED_PHOTO_DELETE_ERROR,
  VERIFIED_PHOTOS_LOAD_ERROR,
} from "@/presentation/lib/verifiedVisitorPhotosPresentation";

function createRequestController() {
  let currentController = null;

  return {
    replace() {
      currentController?.abort();
      currentController = new AbortController();
      return currentController;
    },
    abort() {
      currentController?.abort();
      currentController = null;
    },
  };
}

export default function VerifiedVisitorPhotos({ attractionId }) {
  const [photos, setPhotos] = useState([]);
  const [status, setStatus] = useState("loading");
  const [deletingPhotoId, setDeletingPhotoId] = useState("");
  const [deleteErrorPhotoId, setDeleteErrorPhotoId] = useState("");
  const [authenticationRequired, setAuthenticationRequired] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [requestKind, setRequestKind] = useState("initial");
  const [refreshPending, setRefreshPending] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [deleteRequestController] = useState(createRequestController);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPhotos() {
      try {
        const response = await fetch(
          `/api/attractions/${encodeURIComponent(attractionId)}/verified-photos`,
          { cache: "no-store", signal: controller.signal }
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(VERIFIED_PHOTOS_LOAD_ERROR);

        const safePhotos = normaliseVerifiedPhotosPayload(payload);
        if (controller.signal.aborted) return;
        setPhotos(safePhotos);
        setStatus("success");
        setDeleteErrorPhotoId("");
        setAuthenticationRequired(false);
        setRefreshPending(false);
        setRefreshError(false);
      } catch (error) {
        if (error?.name === "AbortError" || controller.signal.aborted) return;
        const decision = getVerifiedPhotoLoadFailureDecision(requestKind);
        if (!decision.preservePhotos) setPhotos([]);
        setStatus(decision.status);
        setRefreshPending(false);
        setRefreshError(decision.showRefreshError);
      }
    }

    if (attractionId) loadPhotos();
    return () => controller.abort();
  }, [attractionId, refreshVersion, requestKind]);

  useEffect(() => () => deleteRequestController.abort(), [deleteRequestController]);

  function requestInitialLoad() {
    setStatus("loading");
    setRequestKind("initial");
    setRefreshError(false);
    setRefreshVersion((version) => version + 1);
  }

  function requestCanonicalRefresh() {
    setRequestKind("refresh");
    setRefreshPending(true);
    setRefreshError(false);
    setRefreshVersion((version) => version + 1);
  }

  async function deletePhoto(photo) {
    const confirmed = window.confirm(
      "Delete this verified visitor photo? This action cannot be undone."
    );
    if (!confirmed || deletingPhotoId) return;

    const controller = deleteRequestController.replace();
    setDeletingPhotoId(photo.photoId);
    setDeleteErrorPhotoId("");

    try {
      const response = await fetch(buildVerifiedPhotoDeleteUrl(photo), {
        method: "DELETE",
        signal: controller.signal,
      });
      const decision = getVerifiedPhotoDeleteResponseDecision(response, {
        aborted: controller.signal.aborted,
      });
      if (decision.type === "cancelled") return;
      if (decision.type === "authentication-required") {
        setAuthenticationRequired(true);
        return;
      }
      if (decision.type === "retryable-error") {
        throw new Error(VERIFIED_PHOTO_DELETE_ERROR);
      }
      if (controller.signal.aborted) return;
      setPhotos((currentPhotos) => (
        removeConfirmedVerifiedPhoto(currentPhotos, photo.photoId)
      ));
      requestCanonicalRefresh();
    } catch (error) {
      if (error?.name === "AbortError" || controller.signal.aborted) return;
      setDeleteErrorPhotoId(photo.photoId);
    } finally {
      if (!controller.signal.aborted) setDeletingPhotoId("");
    }
  }

  let content;
  if (status === "loading") {
    content = <LoadingState />;
  } else if (status === "error") {
    content = <ErrorState onRetry={requestInitialLoad} />;
  } else if (photos.length === 0) {
    content = (
      <div className="rounded-[14px] border border-dashed border-attraction-border-strong bg-attraction-surface-soft px-5 py-8 text-center">
        <p className="text-sm font-medium text-attraction-muted">
          No verified visitor photos yet.
        </p>
      </div>
    );
  } else {
    content = (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {photos.map((photo) => (
          <PhotoCard
            key={photo.photoId}
            photo={photo}
            isDeleting={deletingPhotoId === photo.photoId}
            deleteActionState={getVerifiedPhotoDeleteActionState(photo, {
              authenticationRequired,
              deletionPending: Boolean(deletingPhotoId) || refreshPending,
            })}
            deleteFailed={deleteErrorPhotoId === photo.photoId}
            onDelete={deletePhoto}
          />
        ))}
      </div>
    );
  }

  return (
    <section
      aria-labelledby="verified-visitor-photos-heading"
      className="mt-8 rounded-[18px] border border-attraction-border bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="mb-5 flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-attraction-primary-soft text-lg font-bold text-attraction-primary"
        >
          ✓
        </span>
        <div>
          <h2
            id="verified-visitor-photos-heading"
            className="text-xl font-bold text-attraction-ink"
          >
            Verified Visitor Photos
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-attraction-muted">
            Public on-site photos shared by travellers who verified their visit.
          </p>
        </div>
      </div>
      {authenticationRequired && (
        <AuthenticationRequiredState onReload={requestCanonicalRefresh} />
      )}
      {(refreshPending || refreshError) && (
        <RefreshState
          isPending={refreshPending}
          onRetry={requestCanonicalRefresh}
        />
      )}
      {content}
    </section>
  );
}

function AuthenticationRequiredState({ onReload }) {
  return (
    <div
      role="status"
      className="mb-4 rounded-[14px] border border-attraction-border bg-attraction-surface-soft p-4"
    >
      <p className="text-sm font-semibold text-attraction-ink">
        Sign in to manage your verified visitor photos.
      </p>
      <p className="mt-1 text-sm leading-relaxed text-attraction-muted">
        Your photos remain public, but deletion requires a signed-in owner session.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center rounded-[10px] bg-attraction-primary px-4 text-sm font-semibold text-white transition hover:bg-attraction-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-attraction-primary focus-visible:ring-offset-2"
        >
          Sign in
        </Link>
        <button
          type="button"
          onClick={onReload}
          className="min-h-11 rounded-[10px] border border-attraction-border-strong bg-white px-4 text-sm font-semibold text-attraction-primary-dark transition hover:bg-attraction-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-attraction-primary focus-visible:ring-offset-2"
        >
          Reload photos
        </button>
      </div>
    </div>
  );
}

function RefreshState({ isPending, onRetry }) {
  if (isPending) {
    return (
      <p
        role="status"
        aria-live="polite"
        className="mb-4 rounded-[10px] bg-attraction-primary-soft px-4 py-3 text-sm font-medium text-attraction-primary-dark"
      >
        Refreshing verified visitor photos...
      </p>
    );
  }

  return (
    <div
      role="alert"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-attraction-border bg-attraction-surface-soft px-4 py-3"
    >
      <p className="text-sm font-medium text-attraction-ink">
        The latest verified visitor photos could not be loaded. The current photos are preserved below.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-11 shrink-0 rounded-[10px] border border-attraction-border-strong bg-white px-4 text-sm font-semibold text-attraction-primary-dark transition hover:bg-attraction-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-attraction-primary focus-visible:ring-offset-2"
      >
        Retry refresh
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <div role="status" aria-live="polite">
      <p className="mb-3 text-sm font-medium text-attraction-muted">
        Loading verified visitor photos...
      </p>
      <div aria-hidden="true" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[0, 1].map((index) => (
          <div
            key={index}
            className="overflow-hidden rounded-[14px] border border-attraction-border bg-attraction-surface-soft"
          >
            <div className="aspect-[4/3] animate-pulse bg-attraction-primary-soft motion-reduce:animate-none" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-2/3 animate-pulse rounded bg-attraction-primary-soft-strong motion-reduce:animate-none" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-attraction-primary-soft motion-reduce:animate-none" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div
      role="alert"
      className="rounded-[14px] border border-attraction-border bg-attraction-surface-soft px-5 py-6 text-center"
    >
      <p className="text-sm font-semibold text-attraction-ink">
        {VERIFIED_PHOTOS_LOAD_ERROR}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 min-h-11 rounded-[10px] border border-attraction-border-strong bg-white px-5 text-sm font-semibold text-attraction-primary-dark transition hover:bg-attraction-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-attraction-primary focus-visible:ring-offset-2"
      >
        Retry
      </button>
    </div>
  );
}

function PhotoCard({ photo, isDeleting, deleteActionState, deleteFailed, onDelete }) {
  const displayDate = formatMalaysiaDisplayDate(photo.capturedDate);
  const displayName = photo.user.displayName || "Chatlas user";
  const initial = displayName.trim().charAt(0).toUpperCase() || "C";
  const deleteErrorId = `delete-error-${photo.photoId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  return (
    <article className="overflow-hidden rounded-[14px] border border-attraction-border bg-white">
      <div className="relative aspect-[4/3] overflow-hidden bg-attraction-surface-soft">
        <Image
          src={photo.photoUrl}
          alt={`Verified visit photo shared by ${displayName} on ${displayDate}`}
          fill
          sizes="(min-width: 640px) 320px, calc(100vw - 64px)"
          className="object-cover"
        />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-attraction-primary-dark px-3 py-1.5 text-xs font-bold text-white shadow-sm">
          <span aria-hidden="true">✓</span>
          Verified Visit
        </span>
      </div>

      <div className="p-4">
        <div className="flex min-w-0 items-center gap-3">
          {photo.user.avatarUrl ? (
            <img
              src={photo.user.avatarUrl}
              alt=""
              className="h-10 w-10 shrink-0 rounded-full border border-attraction-border object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-attraction-primary-soft font-bold text-attraction-primary-dark"
            >
              {initial}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-attraction-ink">
              {displayName}
            </p>
            <p className="mt-0.5 text-xs text-attraction-muted">{displayDate}</p>
          </div>
        </div>

        {deleteActionState !== "hidden" && (
          <div className="mt-4 border-t border-attraction-divider pt-3">
            {deleteFailed && (
              <p
                id={deleteErrorId}
                role="alert"
                className="mb-2 text-sm text-attraction-error"
              >
                {VERIFIED_PHOTO_DELETE_ERROR}
              </p>
            )}
            <button
              type="button"
              onClick={() => onDelete(photo)}
              disabled={deleteActionState === "disabled"}
              aria-label={`Delete verified visit photo shared on ${displayDate}`}
              aria-describedby={deleteFailed ? deleteErrorId : undefined}
              className="min-h-11 w-full rounded-[10px] border border-attraction-border-strong bg-white px-4 text-sm font-semibold text-attraction-error transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-attraction-primary focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
            >
              {isDeleting ? "Deleting photo..." : deleteFailed ? "Try delete again" : "Delete photo"}
            </button>
            {isDeleting && (
              <span role="status" aria-live="polite" className="sr-only">
                Deleting verified visitor photo
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
