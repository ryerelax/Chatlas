"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { isMelakaBasedUser } from "@/business/services/locationGate";
import { useLanguage } from "@/presentation/contexts/LanguageContext";

const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

// After unmount, wait this long before dropping draft.
// Language remount cancels the timer → keep expanded on same page.
const CLEAR_AFTER_UNMOUNT_MS = 800;

const LEGACY_EXPANDED_KEY_PREFIX = "chatlas-community-photo-expanded:";

const pendingPhotoByAttraction = new Map();
const clearTimersByAttraction = new Map();

function clearLegacySessionExpanded(attractionId) {
  try {
    sessionStorage.removeItem(
      `${LEGACY_EXPANDED_KEY_PREFIX}${attractionId || "unknown"}`
    );
  } catch {
    // ignore
  }
}

function getPending(attractionId) {
  return pendingPhotoByAttraction.get(attractionId) || null;
}

function setPending(attractionId, data) {
  pendingPhotoByAttraction.set(attractionId, { ...data });
}

function clearPending(attractionId) {
  pendingPhotoByAttraction.delete(attractionId);
}

function cancelScheduledClear(attractionId) {
  const timer = clearTimersByAttraction.get(attractionId);
  if (timer) {
    clearTimeout(timer);
    clearTimersByAttraction.delete(attractionId);
  }
}

function scheduleClear(attractionId) {
  cancelScheduledClear(attractionId);
  const timer = setTimeout(() => {
    clearPending(attractionId);
    clearTimersByAttraction.delete(attractionId);
  }, CLEAR_AFTER_UNMOUNT_MS);
  clearTimersByAttraction.set(attractionId, timer);
}

// Community "Add a photo" contribution — separate from the Reviews module,
// doesn't touch or depend on its components/schema. Any Melaka-based
// logged-in user can add a photo to any existing attraction.
export default function CommunityPhotoUpload({ attractionId, onPhotoAdded }) {
  const { data: session } = useSession();
  const { t } = useLanguage();
  const isEligible = isMelakaBasedUser(session);
  const fileInputRef = useRef(null);

  const [isExpanded, setIsExpanded] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  // Same page (incl. any number of language switches): restore.
  // Leave page long enough / refresh: collapsed.
  useEffect(() => {
    clearLegacySessionExpanded(attractionId);
    cancelScheduledClear(attractionId);

    const pending = getPending(attractionId);
    if (pending?.expanded) {
      setIsExpanded(true);
      if (pending.file && pending.previewUrl) {
        setPhotoFile(pending.file);
        setPreviewUrl(pending.previewUrl);
      }
    }

    return () => {
      scheduleClear(attractionId);
    };
  }, [attractionId]);

  function persistPending(partial) {
    const current = getPending(attractionId) || {};
    setPending(attractionId, {
      expanded: partial.expanded ?? current.expanded ?? false,
      file: partial.file !== undefined ? partial.file : current.file ?? null,
      previewUrl:
        partial.previewUrl !== undefined
          ? partial.previewUrl
          : current.previewUrl ?? "",
    });
  }

  function setExpanded(next) {
    setIsExpanded(next);
    if (!next) {
      clearPending(attractionId);
      cancelScheduledClear(attractionId);
    } else {
      persistPending({
        expanded: true,
        file: photoFile,
        previewUrl,
      });
    }
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    setError("");

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (!file) {
      setPhotoFile(null);
      setPreviewUrl("");
      persistPending({ expanded: true, file: null, previewUrl: "" });
      return;
    }

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setError(t("unsupportedFormat"));
      setPhotoFile(null);
      setPreviewUrl("");
      persistPending({ expanded: true, file: null, previewUrl: "" });
      event.target.value = "";
      return;
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setError(t("fileTooLarge"));
      setPhotoFile(null);
      setPreviewUrl("");
      persistPending({ expanded: true, file: null, previewUrl: "" });
      event.target.value = "";
      return;
    }

    const url = URL.createObjectURL(file);
    setPhotoFile(file);
    setPreviewUrl(url);
    persistPending({ expanded: true, file, previewUrl: url });
  }

  function handleCancel() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPhotoFile(null);
    setPreviewUrl("");
    setError("");
    clearPending(attractionId);
    cancelScheduledClear(attractionId);
    setIsExpanded(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleUpload() {
    if (!photoFile) {
      setError(t("uploadHint"));
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.set("photo", photoFile);

      const response = await fetch(`/api/attractions/${attractionId}/photos`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || t("errorGeneric"));
      }

      onPhotoAdded?.(result.data);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPhotoFile(null);
      setPreviewUrl("");
      clearPending(attractionId);
      cancelScheduledClear(attractionId);
      setIsExpanded(false);
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 4000);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Failed to add community photo:", err);
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  }

  if (!isEligible) {
    return (
      <div className="mt-4 flex items-center gap-2 text-sm text-attraction-muted">
        <button
          type="button"
          disabled
          title={t("melakaOnlyFeature")}
          className="cursor-not-allowed rounded-[10px] border border-attraction-border bg-white px-4 py-2 font-semibold text-attraction-muted opacity-60"
        >
          + {t("addPhoto")}
        </button>
        <span>{t("melakaOnlyFeature")}</span>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {justAdded && (
        <p className="mb-2 text-sm font-semibold text-attraction-primary">
          {t("photoAddedThanks")}
        </p>
      )}

      {!isExpanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="rounded-[10px] border border-attraction-border-strong bg-white px-4 py-2 text-sm font-semibold text-attraction-primary-dark transition hover:bg-attraction-primary-soft"
        >
          + {t("addPhoto")}
        </button>
      ) : (
        <div className="rounded-[14px] border border-attraction-border bg-white p-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />

          {previewUrl ? (
            <div className="mb-3 flex items-center gap-4">
              <img
                src={previewUrl}
                alt="Selected photo preview"
                className="h-20 w-20 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(previewUrl);
                  setPhotoFile(null);
                  setPreviewUrl("");
                  persistPending({
                    expanded: true,
                    file: null,
                    previewUrl: "",
                  });
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                className="text-sm font-semibold text-attraction-error"
              >
                {t("remove")}
              </button>
            </div>
          ) : (
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-[10px] border border-attraction-border-strong bg-attraction-primary-soft px-4 py-2 text-sm font-semibold text-attraction-primary"
              >
                {t("choosePhoto")}
              </button>
              <span className="text-sm text-attraction-muted">
                {t("noFileChosen")}
              </span>
            </div>
          )}

          {error && (
            <p className="mb-3 text-sm text-attraction-error">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleUpload}
              disabled={isUploading || !photoFile}
              className="rounded-[10px] bg-attraction-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-attraction-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploading ? t("saving") : t("addPhoto")}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isUploading}
              className="rounded-[10px] border border-attraction-border-strong bg-white px-4 py-2 text-sm font-semibold text-attraction-body transition hover:bg-attraction-surface-soft"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}