import {
  createDevelopmentVisitedAttractionCollection,
  normaliseVisitedAttractionIds,
  selectDevelopmentPreviewVisitedAttractionIds,
  VISITED_DATA_STATUS,
} from "@/business/services/explorationMapService";

const AUTH_REQUIRED_MESSAGE = "Sign in to view your verified visits.";
const LOAD_ERROR_MESSAGE = "Verified visits could not be loaded.";
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

export const VISITED_ATTRACTIONS_SORT = Object.freeze({
  MOST_RECENT: "most-recent",
  OLDEST: "oldest",
  NAME_ASC: "name-asc",
});
export const VISITED_ATTRACTIONS_PER_PAGE = 10;

const VISITED_ATTRACTIONS_COPY = Object.freeze({
  en: Object.freeze({
    sortBy: "Sort by",
    mostRecent: "Most recently verified",
    oldest: "Oldest verified",
    nameAsc: "Name A–Z",
  }),
  zh: Object.freeze({
    sortBy: "排序方式",
    mostRecent: "最近验证",
    oldest: "最早验证",
    nameAsc: "名称 A–Z",
  }),
  ms: Object.freeze({
    sortBy: "Susun mengikut",
    mostRecent: "Paling baru disahkan",
    oldest: "Paling awal disahkan",
    nameAsc: "Nama A–Z",
  }),
});

const VERIFICATION_COPY = Object.freeze({
  en: Object.freeze({
    label: "Last verified",
    timeUnavailable: "Time unavailable",
    dateUnavailable: "Date unavailable",
    locale: "en-MY",
    dateTimeOptions: Object.freeze({
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
  }),
  zh: Object.freeze({
    label: "最后验证",
    timeUnavailable: "时间不可用",
    dateUnavailable: "日期不可用",
    locale: "zh-CN",
    dateTimeOptions: Object.freeze({
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }),
  }),
  ms: Object.freeze({
    label: "Terakhir disahkan",
    timeUnavailable: "Masa tidak tersedia",
    dateUnavailable: "Tarikh tidak tersedia",
    locale: "ms-MY",
    dateTimeOptions: Object.freeze({
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }),
  }),
});

function resolveVisitedLanguage(language) {
  return Object.hasOwn(VISITED_ATTRACTIONS_COPY, language) ? language : "en";
}

export function getVisitedAttractionsCopy(language = "en") {
  return VISITED_ATTRACTIONS_COPY[resolveVisitedLanguage(language)];
}

function compareNames(first, second, locale) {
  const firstName = typeof first?.name === "string" ? first.name : "";
  const secondName = typeof second?.name === "string" ? second.name : "";
  const result = new Intl.Collator(locale || undefined, { sensitivity: "base", numeric: true })
    .compare(firstName, secondName);
  return result || String(first?.id || "").localeCompare(String(second?.id || ""));
}

function getVerifiedTimestamp(attraction) {
  const timestamp = typeof attraction?.latestVerifiedAt === "string"
    ? Date.parse(attraction.latestVerifiedAt)
    : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function createVisitedVerificationPresentation(
  attraction,
  language = "en"
) {
  const resolvedLanguage = resolveVisitedLanguage(language);
  const copy = VERIFICATION_COPY[resolvedLanguage];
  const timestamp = getVerifiedTimestamp(attraction);
  const hasTimestamp = timestamp !== null;
  let value =
    typeof attraction?.latestVisitedDate === "string" &&
    attraction.latestVisitedDate.trim()
      ? attraction.latestVisitedDate
      : copy.dateUnavailable;

  if (hasTimestamp) {
    value = new Intl.DateTimeFormat(copy.locale, {
      ...copy.dateTimeOptions,
      timeZone: "Asia/Kuala_Lumpur",
    }).format(timestamp);
    if (resolvedLanguage === "en") {
      value = value.replace(/\b(am|pm)\b/i, (period) => period.toUpperCase());
    }
  }

  return {
    label: copy.label,
    value,
    timeUnavailable: !hasTimestamp,
    timeUnavailableLabel: copy.timeUnavailable,
  };
}

export function sortVisitedAttractions(attractions, sort = VISITED_ATTRACTIONS_SORT.MOST_RECENT, locale) {
  const source = Array.isArray(attractions) ? [...attractions] : [];
  return source.sort((first, second) => {
    if (sort === VISITED_ATTRACTIONS_SORT.NAME_ASC) return compareNames(first, second, locale);
    const firstDate = getVerifiedTimestamp(first);
    const secondDate = getVerifiedTimestamp(second);
    if (firstDate === null && secondDate === null) return compareNames(first, second, locale);
    if (firstDate === null) return 1;
    if (secondDate === null) return -1;
    if (firstDate !== secondDate) {
      return sort === VISITED_ATTRACTIONS_SORT.OLDEST ? firstDate - secondDate : secondDate - firstDate;
    }
    return compareNames(first, second, locale);
  });
}

export function paginateVisitedAttractions(attractions, requestedPage = 1) {
  const source = Array.isArray(attractions) ? attractions : [];
  const totalPages = Math.max(1, Math.ceil(source.length / VISITED_ATTRACTIONS_PER_PAGE));
  const candidate = Number.isFinite(Number(requestedPage)) ? Math.trunc(Number(requestedPage)) : 1;
  const page = Math.min(totalPages, Math.max(1, candidate));
  const startIndex = (page - 1) * VISITED_ATTRACTIONS_PER_PAGE;
  return { items: source.slice(startIndex, startIndex + VISITED_ATTRACTIONS_PER_PAGE), page, totalPages, startIndex };
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

export function createVisitedDataReloadRevision({
  sessionStatus,
  sessionUserId,
  requestRevision = 0,
  developmentPreviewActive = false,
} = {}) {
  if (developmentPreviewActive) {
    return JSON.stringify(["development-preview", requestRevision]);
  }

  const identity =
    sessionStatus === "authenticated" && typeof sessionUserId === "string"
      ? sessionUserId.trim()
      : "";

  return JSON.stringify([sessionStatus, identity, requestRevision]);
}

export function canLoadVisitedAttractions({
  isPreviewQueryReady,
  developmentPreviewActive,
  developmentPreviewReady,
  sessionStatus,
} = {}) {
  if (!isPreviewQueryReady) return false;

  if (developmentPreviewActive) {
    return developmentPreviewReady === true;
  }

  return sessionStatus !== "loading";
}

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
 * Loads the attraction IDs verified as visited by the signed-in user.
 *
 * The adapter keeps private visited-data access separate from the public map UI.
 * User identity is intentionally not accepted here because the route resolves
 * it from the server-side session.
 *
 * @param {{
 *   signal?: AbortSignal,
 *   fetchImpl?: typeof fetch,
 *   developmentPreview?: boolean,
 *   developmentPreviewStatus?: "success" | "loading",
 *   previewAttractionIds?: unknown[],
 * }} options
 * @returns {Promise<{
 *   status: "success" | "auth-required" | "error",
 *   data: string[],
 *   message: string,
 * }>}
 */
export async function loadVisitedAttractionIds({
  signal,
  fetchImpl = globalThis.fetch,
  developmentPreview = false,
  developmentPreviewStatus = VISITED_DATA_STATUS.SUCCESS,
  previewAttractionIds = [],
} = {}) {
  if (
    process.env.NODE_ENV === "development" &&
    developmentPreview === true
  ) {
    const isLoadingPreview =
      developmentPreviewStatus === VISITED_DATA_STATUS.LOADING;

    return {
      status: isLoadingPreview
        ? VISITED_DATA_STATUS.LOADING
        : VISITED_DATA_STATUS.SUCCESS,
      data: isLoadingPreview
        ? []
        : normaliseVisitedAttractionIds(previewAttractionIds),
      message: isLoadingPreview
        ? DEVELOPMENT_LOADING_PREVIEW_MESSAGE
        : DEVELOPMENT_PREVIEW_MESSAGE,
    };
  }

  let response;
  try {
    response = await fetchImpl("/api/exploration-map/verified-visits", {
      signal,
      cache: "no-store",
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    throw new Error(LOAD_ERROR_MESSAGE);
  }

  if (response?.status === 401) {
    return {
      status: VISITED_DATA_STATUS.AUTH_REQUIRED,
      data: [],
      message: AUTH_REQUIRED_MESSAGE,
    };
  }

  let result;
  try {
    result = await response?.json();
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    throw new Error(LOAD_ERROR_MESSAGE);
  }

  if (
    !response?.ok ||
    result?.success === false ||
    !Array.isArray(result?.data)
  ) {
    throw new Error(LOAD_ERROR_MESSAGE);
  }

  return {
    status: VISITED_DATA_STATUS.SUCCESS,
    data: normaliseVisitedAttractionIds(result.data),
    latestVisitedDateByAttractionId: Array.isArray(result.visitedAttractions)
      ? Object.fromEntries(result.visitedAttractions.flatMap((item) => (
          typeof item?.attractionId === "string" && typeof item?.latestVisitedDate === "string"
            ? [[item.attractionId, item.latestVisitedDate]]
            : []
        )))
      : {},
    latestVerifiedAtByAttractionId: Array.isArray(result.visitedAttractions)
      ? Object.fromEntries(result.visitedAttractions.flatMap((item) => (
          typeof item?.attractionId === "string" && typeof item?.latestVerifiedAt === "string"
            ? [[item.attractionId, item.latestVerifiedAt]]
            : []
        )))
      : {},
    message: "",
  };
}

export function createDevelopmentVisitedPreviewAdapter({
  supportedAttractions = [],
  mode = "visited",
  fetchImpl = globalThis.fetch,
  loadVisitedAttractionIdsImpl = loadVisitedAttractionIds,
} = {}) {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const resolvedMode = DEVELOPMENT_VISITED_PREVIEW_MODES.has(mode)
    ? mode
    : "visited";
  const initialAttractionIds =
    resolvedMode === "visited"
      ? selectDevelopmentPreviewVisitedAttractionIds(
          supportedAttractions
        )
      : [];
  const visitedAttractionCollection =
    createDevelopmentVisitedAttractionCollection(
      supportedAttractions,
      initialAttractionIds
    );

  function createResult(signal) {
    return loadVisitedAttractionIdsImpl({
      signal,
      fetchImpl,
      developmentPreview: true,
      developmentPreviewStatus:
        resolvedMode === "loading"
          ? VISITED_DATA_STATUS.LOADING
          : VISITED_DATA_STATUS.SUCCESS,
      previewAttractionIds: visitedAttractionCollection.getAttractionIds(),
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

      visitedAttractionCollection.add();
      return createResult(signal);
    },
    remove({ signal } = {}) {
      if (resolvedMode !== "visited") {
        return createResult(signal);
      }

      visitedAttractionCollection.remove();
      return createResult(signal);
    },
    reset({ signal } = {}) {
      if (resolvedMode !== "visited") {
        return createResult(signal);
      }

      visitedAttractionCollection.reset();
      return createResult(signal);
    },
  });
}
