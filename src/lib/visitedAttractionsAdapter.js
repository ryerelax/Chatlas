import {
  normaliseReviewedAttractionIds,
  selectDevelopmentPreviewReviewedAttractionIds,
  VISITED_DATA_STATUS,
} from "./explorationMap.js";

const INTEGRATION_PENDING_MESSAGE =
  "Visited attractions are unavailable until Authentication and Review integration is complete.";
const DEVELOPMENT_PREVIEW_MESSAGE =
  "Development preview \u2014 mock visited data";
const DEVELOPMENT_LOADING_PREVIEW_MESSAGE =
  "Development preview \u2014 visited data loading";
const DEVELOPMENT_VISITED_PREVIEW_MODES = new Set([
  "visited",
  "empty",
  "loading",
]);
const DEVELOPMENT_MAP_PREVIEW_MODES = new Set([
  "loading",
  "unavailable",
]);

export function getDevelopmentVisitedPreviewMode(
  queryString,
  runtimeEnvironment
) {
  if (
    runtimeEnvironment !== "development" ||
    typeof queryString !== "string"
  ) {
    return null;
  }

  const queryValue = new URLSearchParams(queryString).get(
    "previewVisited"
  );
  const mode = queryValue === "1" ? "visited" : queryValue;

  return DEVELOPMENT_VISITED_PREVIEW_MODES.has(mode) ? mode : null;
}

export function getDevelopmentMapPreviewMode(
  queryString,
  runtimeEnvironment
) {
  if (
    runtimeEnvironment !== "development" ||
    typeof queryString !== "string"
  ) {
    return null;
  }

  const mode = new URLSearchParams(queryString).get("previewMap");

  return DEVELOPMENT_MAP_PREVIEW_MODES.has(mode) ? mode : null;
}

export function isDevelopmentVisitedPreviewEnabled(
  queryString,
  runtimeEnvironment
) {
  return (
    getDevelopmentVisitedPreviewMode(
      queryString,
      runtimeEnvironment
    ) === "visited"
  );
}

/**
 * Loads the attraction IDs reviewed by the signed-in user.
 *
 * The adapter keeps visited-data access separate from the map UI so its
 * implementation can later be replaced without changing map or list logic.
 * Callers may pass an AbortSignal even though the pending implementation does
 * not perform a request yet. User identity is intentionally not accepted here.
 *
 * @param {{
 *   signal?: AbortSignal,
 *   developmentPreview?: boolean,
 *   previewAttractionIds?: unknown[],
 * }} options
 * @returns {Promise<{
 *   status: "success" | "unavailable",
 *   data: string[],
 *   message: string,
 * }>}
 */
export async function loadVisitedAttractionIds({
  signal,
  developmentPreview = false,
  previewAttractionIds = [],
} = {}) {
  void signal;

  if (
    process.env.NODE_ENV === "development" &&
    developmentPreview === true
  ) {
    return {
      status: VISITED_DATA_STATUS.SUCCESS,
      data: normaliseReviewedAttractionIds(previewAttractionIds),
      message: DEVELOPMENT_PREVIEW_MESSAGE,
    };
  }

  // TODO: Connect this adapter only after the integration contract provides:
  // - a server-side authentication helper;
  // - the canonical internal user ID used by review records;
  // - the Review service for querying the signed-in user's reviews;
  // - the valid review statuses that count an attraction as visited;
  // - the review deletion rules that remove an attraction from visited data; and
  // - an authenticated private /api/exploration-map/visited-attractions endpoint;
  // - the refresh/cache-invalidation contract after review create, edit, or delete.
  return {
    status: VISITED_DATA_STATUS.UNAVAILABLE,
    data: [],
    message: INTEGRATION_PENDING_MESSAGE,
  };
}

export function createDevelopmentVisitedPreviewAdapter({
  supportedAttractions = [],
  mode = "visited",
} = {}) {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const resolvedMode = DEVELOPMENT_VISITED_PREVIEW_MODES.has(mode)
    ? mode
    : "visited";
  const supportedAttractionIds = normaliseReviewedAttractionIds(
    Array.isArray(supportedAttractions)
      ? supportedAttractions.map((attraction) => attraction?.id)
      : []
  );
  const initialAttractionIds =
    resolvedMode === "visited"
      ? selectDevelopmentPreviewReviewedAttractionIds(
          supportedAttractions
        )
      : [];
  let currentAttractionIds = [...initialAttractionIds];

  function createResult(signal) {
    if (resolvedMode === "loading") {
      return Promise.resolve({
        status: VISITED_DATA_STATUS.LOADING,
        data: [],
        message: DEVELOPMENT_LOADING_PREVIEW_MESSAGE,
      });
    }

    return loadVisitedAttractionIds({
      signal,
      developmentPreview: true,
      previewAttractionIds: currentAttractionIds,
    });
  }

  return Object.freeze({
    load({ signal } = {}) {
      return createResult(signal);
    },
    add({ signal } = {}) {
      if (resolvedMode !== "visited") {
        return createResult(signal);
      }

      const reviewedIdSet = new Set(currentAttractionIds);
      const nextAttractionId = supportedAttractionIds.find(
        (attractionId) => !reviewedIdSet.has(attractionId)
      );

      if (nextAttractionId) {
        currentAttractionIds = normaliseReviewedAttractionIds([
          ...currentAttractionIds,
          nextAttractionId,
        ]);
      }

      return createResult(signal);
    },
    remove({ signal } = {}) {
      if (resolvedMode !== "visited") {
        return createResult(signal);
      }

      currentAttractionIds = currentAttractionIds.slice(0, -1);
      return createResult(signal);
    },
    reset({ signal } = {}) {
      if (resolvedMode !== "visited") {
        return createResult(signal);
      }

      currentAttractionIds = [...initialAttractionIds];
      return createResult(signal);
    },
  });
}
