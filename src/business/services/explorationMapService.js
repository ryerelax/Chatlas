export const VISITED_DATA_STATUS = Object.freeze({
  LOADING: "loading",
  SUCCESS: "success",
  AUTH_REQUIRED: "auth-required",
  UNAVAILABLE: "unavailable",
  ERROR: "error",
});

export const ATTRACTION_DATA_STATUS = Object.freeze({
  LOADING: "loading",
  SUCCESS: "success",
  ERROR: "error",
});

export const MAP_STATUS = Object.freeze({
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  UNAVAILABLE: "unavailable",
});

export const MAP_VISIT_FILTER = Object.freeze({
  ALL: "all",
  VISITED: "visited",
  UNVISITED: "unvisited",
});

const VISITED_DATA_STATUS_VALUES = new Set(
  Object.values(VISITED_DATA_STATUS)
);
const ATTRACTION_DATA_STATUS_VALUES = new Set(
  Object.values(ATTRACTION_DATA_STATUS)
);
const MAP_STATUS_VALUES = new Set(Object.values(MAP_STATUS));
const MAP_VISIT_FILTER_VALUES = new Set(Object.values(MAP_VISIT_FILTER));

function normaliseMapVisitFilter(value) {
  return MAP_VISIT_FILTER_VALUES.has(value) ? value : MAP_VISIT_FILTER.ALL;
}

export function getNextExplorationMapFilter(current, requested) {
  const next = normaliseMapVisitFilter(requested);
  return next === MAP_VISIT_FILTER.ALL || normaliseMapVisitFilter(current) === next
    ? MAP_VISIT_FILTER.ALL
    : next;
}

export function createVisibleAttractions(attractions, filter = MAP_VISIT_FILTER.ALL) {
  if (!Array.isArray(attractions)) return [];
  const resolvedFilter = normaliseMapVisitFilter(filter);
  if (resolvedFilter === MAP_VISIT_FILTER.ALL) return attractions;
  const isVisited = resolvedFilter === MAP_VISIT_FILTER.VISITED;
  return attractions.filter((attraction) => attraction?.isVisited === isVisited);
}

export function getExplorationMapFilterCountLabel(count, filter = MAP_VISIT_FILTER.ALL) {
  const amount = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  const noun = amount === 1 ? "attraction" : "attractions";
  const resolvedFilter = normaliseMapVisitFilter(filter);
  if (resolvedFilter === MAP_VISIT_FILTER.VISITED) return `${amount} visited ${noun}`;
  if (resolvedFilter === MAP_VISIT_FILTER.UNVISITED) return `${amount} not visited ${noun}`;
  return `${amount} ${noun}`;
}

export function normaliseAttractionId(value) {
  if (value === null || value === undefined) {
    return null;
  }

  try {
    const id = value.toString().trim();

    if (!id || id === "[object Object]") {
      return null;
    }

    return id;
  } catch {
    return null;
  }
}

export function normaliseVisitedAttractionIds(visitedAttractionIds) {
  if (!Array.isArray(visitedAttractionIds)) {
    return [];
  }

  return [
    ...new Set(
      visitedAttractionIds
        .map(normaliseAttractionId)
        .filter((attractionId) => attractionId !== null)
    ),
  ];
}

export function selectDevelopmentPreviewVisitedAttractionIds(
  supportedAttractions,
  limit = 3
) {
  if (!Array.isArray(supportedAttractions)) {
    return [];
  }

  const resolvedLimit = Number.isFinite(limit)
    ? Math.max(0, Math.trunc(limit))
    : 3;
  const supportedAttractionIds = normaliseVisitedAttractionIds(
    supportedAttractions.map((attraction) => attraction?.id)
  );
  const selectedCount = Math.min(resolvedLimit, supportedAttractionIds.length);

  if (selectedCount === 0) {
    return [];
  }

  if (selectedCount === 1) {
    return [supportedAttractionIds[0]];
  }

  return Array.from({ length: selectedCount }, (_, selectionIndex) => {
    const attractionIndex = Math.round(
      (selectionIndex * (supportedAttractionIds.length - 1)) /
        (selectedCount - 1)
    );

    return supportedAttractionIds[attractionIndex];
  });
}

export function createDevelopmentVisitedAttractionCollection(
  supportedAttractions = [],
  initialAttractionIds = []
) {
  const supportedAttractionIds = normaliseVisitedAttractionIds(
    Array.isArray(supportedAttractions)
      ? supportedAttractions.map((attraction) => attraction?.id)
      : []
  );
  const supportedAttractionIdSet = new Set(supportedAttractionIds);
  const initialIds = normaliseVisitedAttractionIds(initialAttractionIds).filter(
    (attractionId) => supportedAttractionIdSet.has(attractionId)
  );
  let currentAttractionIds = [...initialIds];

  return Object.freeze({
    getAttractionIds() {
      return [...currentAttractionIds];
    },
    add() {
      const visitedIdSet = new Set(currentAttractionIds);
      const nextAttractionId = supportedAttractionIds.find(
        (attractionId) => !visitedIdSet.has(attractionId)
      );

      if (nextAttractionId) {
        currentAttractionIds = [...currentAttractionIds, nextAttractionId];
      }

      return [...currentAttractionIds];
    },
    remove() {
      currentAttractionIds = currentAttractionIds.slice(0, -1);
      return [...currentAttractionIds];
    },
    reset() {
      currentAttractionIds = [...initialIds];
      return [...currentAttractionIds];
    },
  });
}

function normaliseCoordinate(value, minimum, maximum) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const coordinate = Number(value);

  if (!Number.isFinite(coordinate) || coordinate < minimum || coordinate > maximum) {
    return null;
  }

  return coordinate;
}

export function normaliseMapAttractions(attractions) {
  if (!Array.isArray(attractions)) {
    return [];
  }

  return attractions.flatMap((attraction) => {
    const id = normaliseAttractionId(attraction?._id);
    const latitude = normaliseCoordinate(attraction?.latitude, -90, 90);
    const longitude = normaliseCoordinate(attraction?.longitude, -180, 180);

    if (!id || latitude === null || longitude === null) {
      return [];
    }

    const rating = Number(attraction.rating);
    const verificationRadiusMeters = Number(attraction.verificationRadiusMeters);
    const hasVerificationRadius = Number.isInteger(verificationRadiusMeters)
      && verificationRadiusMeters >= 30
      && verificationRadiusMeters <= 150;

    return [{
      id,
      name: attraction.name?.trim() || "Unnamed attraction",
      address: attraction.address?.trim() || "Address unavailable",
      category: attraction.category?.trim() || "Attraction",
      latitude,
      longitude,
      rating: Number.isFinite(rating) ? rating : 0,
      ...(hasVerificationRadius ? { verificationRadiusMeters } : {}),
    }];
  });
}

export function createExplorationMapViewModel(
  supportedAttractions,
  visitedAttractionIds,
  visitedDataStatus = VISITED_DATA_STATUS.UNAVAILABLE
) {
  const requestedStatus = VISITED_DATA_STATUS_VALUES.has(visitedDataStatus)
    ? visitedDataStatus
    : VISITED_DATA_STATUS.UNAVAILABLE;
  const resolvedStatus =
    requestedStatus === VISITED_DATA_STATUS.SUCCESS &&
    !Array.isArray(visitedAttractionIds)
      ? VISITED_DATA_STATUS.UNAVAILABLE
      : requestedStatus;
  const hasVisitedData = resolvedStatus === VISITED_DATA_STATUS.SUCCESS;
  const visitedIdSet = new Set(
    hasVisitedData ? normaliseVisitedAttractionIds(visitedAttractionIds) : []
  );
  const attractions = Array.isArray(supportedAttractions)
    ? supportedAttractions.flatMap((attraction) => {
        const id = normaliseAttractionId(attraction?.id);

        return id
          ? [{ ...attraction, id, isVisited: hasVisitedData ? visitedIdSet.has(id) : null }]
          : [];
      })
    : [];
  const visitedAttractions = hasVisitedData
    ? attractions.filter((attraction) => attraction.isVisited)
    : [];
  const progress = createExplorationProgressSummary(
    attractions,
    visitedAttractions,
    resolvedStatus
  );

  return {
    attractions,
    visitedAttractions,
    visitedAttractionIds: visitedAttractions.map((attraction) => attraction.id),
    visitedDataStatus: resolvedStatus,
    progress,
  };
}

export function createExplorationPageState({
  supportedAttractions,
  visitedAttractionIds,
  attractionDataStatus = ATTRACTION_DATA_STATUS.LOADING,
  visitedDataStatus = VISITED_DATA_STATUS.UNAVAILABLE,
  mapStatus = MAP_STATUS.IDLE,
} = {}) {
  const resolvedAttractionDataStatus =
    ATTRACTION_DATA_STATUS_VALUES.has(attractionDataStatus)
      ? attractionDataStatus
      : ATTRACTION_DATA_STATUS.ERROR;
  const resolvedMapStatus = MAP_STATUS_VALUES.has(mapStatus)
    ? mapStatus
    : MAP_STATUS.UNAVAILABLE;
  const hasAttractionData =
    resolvedAttractionDataStatus === ATTRACTION_DATA_STATUS.SUCCESS;
  const effectiveVisitedDataStatus = hasAttractionData
    ? visitedDataStatus
    : resolvedAttractionDataStatus === ATTRACTION_DATA_STATUS.LOADING
      ? VISITED_DATA_STATUS.LOADING
      : VISITED_DATA_STATUS.ERROR;
  const viewModel = createExplorationMapViewModel(
    hasAttractionData ? supportedAttractions : [],
    visitedAttractionIds,
    effectiveVisitedDataStatus
  );

  return {
    attractionDataStatus: resolvedAttractionDataStatus,
    mapStatus: resolvedMapStatus,
    viewModel,
    isAttractionsLoading:
      resolvedAttractionDataStatus === ATTRACTION_DATA_STATUS.LOADING,
    isAttractionsError:
      resolvedAttractionDataStatus === ATTRACTION_DATA_STATUS.ERROR,
    isMapLoading:
      hasAttractionData &&
      [MAP_STATUS.IDLE, MAP_STATUS.LOADING].includes(resolvedMapStatus),
    isMapUnavailable:
      hasAttractionData && resolvedMapStatus === MAP_STATUS.UNAVAILABLE,
    isNoVisit:
      hasAttractionData &&
      viewModel.visitedDataStatus === VISITED_DATA_STATUS.SUCCESS &&
      viewModel.visitedAttractions.length === 0,
  };
}

const PUBLIC_PAGE_PATHS = new Set([
  "/",
  "/offline",
  "/sw.js",
  "/manifest.webmanifest",
  "/exploration-map",
  "/exploration-map/",
  "/profiles",
  "/community",
  "/community/",
]);

export function isPublicPagePathname(pathname) {
  if (typeof pathname !== "string") {
    return false;
  }

  return (
    PUBLIC_PAGE_PATHS.has(pathname) ||
    pathname.startsWith("/attractions/") ||
    pathname.startsWith("/profiles/")
  );
}

export function createExplorationProgressSummary(
  supportedAttractions,
  visitedAttractions,
  visitedDataStatus = VISITED_DATA_STATUS.UNAVAILABLE
) {
  const status = VISITED_DATA_STATUS_VALUES.has(visitedDataStatus)
    ? visitedDataStatus
    : VISITED_DATA_STATUS.UNAVAILABLE;
  const totalCount = Array.isArray(supportedAttractions)
    ? supportedAttractions.length
    : 0;

  if (status !== VISITED_DATA_STATUS.SUCCESS) {
    return { status, visitedCount: null, totalCount, percentage: null, percentageLabel: null };
  }

  const rawVisitedCount = Array.isArray(visitedAttractions)
    ? visitedAttractions.length
    : 0;
  const visitedCount = Math.min(Math.max(rawVisitedCount, 0), totalCount);
  const percentage = totalCount === 0
    ? 0
    : Math.min(100, Math.max(0, Math.round((visitedCount / totalCount) * 1000) / 10));

  return {
    status,
    visitedCount,
    totalCount,
    percentage,
    percentageLabel: `${percentage}%`,
  };
}
