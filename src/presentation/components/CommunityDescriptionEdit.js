"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { isMelakaBasedUser } from "@/business/services/locationGate";
import { useLanguage } from "@/presentation/contexts/LanguageContext";

const MAX_DESCRIPTION_LENGTH = 2000;

// Wiki-style "About this attraction" editor — any Melaka-based logged-in
// user can edit any existing attraction's description, direct and
// published immediately, no approval queue. Separate from the Reviews
// module; doesn't touch or depend on its components/schema.
export default function CommunityDescriptionEdit({
  attractionId,
  description,
  descriptionSource,
  descriptionLastEditedBy,
  onDescriptionUpdated,
}) {
  const { data: session } = useSession();
  const { t } = useLanguage();
  const isEligible = isMelakaBasedUser(session);

  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(description || "");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const hasDescription = description && description.trim().length > 0;

  // The moment a community edit sets descriptionLastEditedBy, this stops
  // rendering on its own - no separate "clear the caption" logic needed.
  const showWikidataCaption =
    descriptionSource === "wikidata" && !descriptionLastEditedBy;

  function handleStartEditing() {
    setDraftText(description || "");
    setError("");
    setIsEditing(true);
  }

  function handleCancel() {
    setDraftText(description || "");
    setError("");
    setIsEditing(false);
  }

  async function handleSave() {
    if (draftText.length > MAX_DESCRIPTION_LENGTH) {
      setError(t("errorGeneric"));
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const response = await fetch(
        `/api/attractions/${attractionId}/description`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: draftText }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || t("errorGeneric"));
      }

      onDescriptionUpdated?.({
        description: result.data.description,
        descriptionSource: result.data.descriptionSource,
        descriptionLastEditedBy: result.data.descriptionLastEditedBy,
      });
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update attraction description:", err);
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mt-7 rounded-[18px] border border-attraction-border bg-white p-6">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-attraction-ink">
          {t("aboutAttraction")}
        </h2>

        {!isEditing && isEligible && (
          <button
            type="button"
            onClick={handleStartEditing}
            className="shrink-0 text-sm font-semibold text-attraction-primary hover:text-attraction-primary-hover"
          >
            {t("edit")}
          </button>
        )}

        {!isEditing && !isEligible && (
          <span
            title={t("melakaOnlyFeature")}
            className="shrink-0 cursor-not-allowed text-sm font-semibold text-attraction-muted opacity-70"
          >
            {t("edit")}
          </span>
        )}
      </div>

      {isEditing ? (
        <div>
          <textarea
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            rows={5}
            maxLength={MAX_DESCRIPTION_LENGTH}
            placeholder={t("descriptionPlaceholder")}
            className="w-full rounded-lg border border-attraction-border px-4 py-3 text-base leading-relaxed text-attraction-body outline-none focus:border-attraction-primary"
          />
          <p className="mt-1 text-right text-xs text-attraction-muted">
            {draftText.length} / {MAX_DESCRIPTION_LENGTH}
          </p>

          {error && (
            <p className="mb-2 text-sm text-attraction-error">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-[10px] bg-attraction-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-attraction-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? t("saving") : t("save")}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="rounded-[10px] border border-attraction-border-strong bg-white px-4 py-2 text-sm font-semibold text-attraction-body transition hover:bg-attraction-surface-soft"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <p
          className={
            hasDescription
              ? "text-base leading-relaxed text-attraction-body"
              : "text-base italic leading-relaxed text-attraction-muted"
          }
        >
          {hasDescription ? description : t("noDescription")}
        </p>
      )}

      {!isEditing && showWikidataCaption && (
        <p className="mt-2 text-xs text-attraction-muted">
          {t("sourceWikipedia")}
        </p>
      )}
    </div>
  );
}