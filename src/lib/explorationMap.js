export const MELAKA_MAP_CENTRE = Object.freeze({
  lat: 2.1896,
  lng: 102.2501,
});

export const VISITED_DATA_STATUS = Object.freeze({
  LOADING: "loading",
  SUCCESS: "success",
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

const VISITED_DATA_STATUS_VALUES = new Set(
  Object.values(VISITED_DATA_STATUS)
);
const ATTRACTION_DATA_STATUS_VALUES = new Set(
  Object.values(ATTRACTION_DATA_STATUS)
);
const MAP_STATUS_VALUES = new Set(Object.values(MAP_STATUS));

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

export function normaliseReviewedAttractionIds(reviewedAttractionIds) {
  if (!Array.isArray(reviewedAttractionIds)) {
    return [];
  }

  return [
    ...new Set(
      reviewedAttractionIds
        .map(normaliseAttractionId)
        .filter((attractionId) => attractionId !== null)
    ),
  ];
}

export function selectDevelopmentPreviewReviewedAttractionIds(
  supportedAttractions,
  limit = 3
) {
  if (!Array.isArray(supportedAttractions)) {
    return [];
  }

  const resolvedLimit = Number.isFinite(limit)
    ? Math.max(0, Math.trunc(limit))
    : 3;
  const supportedAttractionIds = [
    ...new Set(
      supportedAttractions
        .map((attraction) => normaliseAttractionId(attraction?.id))
        .filter((attractionId) => attractionId !== null)
    ),
  ];
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

function normaliseCoordinate(value, minimum, maximum) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const coordinate = Number(value);

  if (!Number.isFinite(coordinate)) {
    return null;
  }

  if (coordinate < minimum || coordinate > maximum) {
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

    return [
      {
        id,
        name: attraction.name?.trim() || "Unnamed attraction",
        address: attraction.address?.trim() || "Address unavailable",
        category: attraction.category?.trim() || "Attraction",
        latitude,
        longitude,
        rating: Number.isFinite(rating) ? rating : 0,
      },
    ];
  });
}

export function createExplorationMapViewModel(
  supportedAttractions,
  reviewedAttractionIds,
  visitedDataStatus = VISITED_DATA_STATUS.UNAVAILABLE
) {
  const requestedStatus = VISITED_DATA_STATUS_VALUES.has(visitedDataStatus)
    ? visitedDataStatus
    : VISITED_DATA_STATUS.UNAVAILABLE;
  const resolvedStatus =
    requestedStatus === VISITED_DATA_STATUS.SUCCESS &&
    !Array.isArray(reviewedAttractionIds)
      ? VISITED_DATA_STATUS.UNAVAILABLE
      : requestedStatus;
  const hasVisitedData = resolvedStatus === VISITED_DATA_STATUS.SUCCESS;
  const reviewedIdSet = new Set(
    hasVisitedData
      ? normaliseReviewedAttractionIds(reviewedAttractionIds)
      : []
  );
  const attractions = Array.isArray(supportedAttractions)
    ? supportedAttractions.flatMap((attraction) => {
        const id = normaliseAttractionId(attraction?.id);

        if (!id) {
          return [];
        }

        return [
          {
            ...attraction,
            id,
            isVisited: hasVisitedData ? reviewedIdSet.has(id) : null,
          },
        ];
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
    visitedAttractionIds: visitedAttractions.map(
      (attraction) => attraction.id
    ),
    visitedDataStatus: resolvedStatus,
    progress,
  };
}

export function createExplorationPageState({
  supportedAttractions,
  reviewedAttractionIds,
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
    reviewedAttractionIds,
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
    return {
      status,
      visitedCount: null,
      totalCount,
      percentage: null,
      percentageLabel: null,
    };
  }

  const rawVisitedCount = Array.isArray(visitedAttractions)
    ? visitedAttractions.length
    : 0;
  const visitedCount = Math.min(Math.max(rawVisitedCount, 0), totalCount);
  const percentage =
    totalCount === 0
      ? 0
      : Math.min(
          100,
          Math.max(0, Math.round((visitedCount / totalCount) * 1000) / 10)
        );

  return {
    status,
    visitedCount,
    totalCount,
    percentage,
    percentageLabel: `${percentage}%`,
  };
}

export function getMapMarkerPresentation(attraction, index) {
  const markerNumber = Number.isInteger(index) && index >= 0 ? index + 1 : 1;
  const attractionName = attraction?.name?.trim() || "Unnamed attraction";

  if (attraction?.isVisited === true) {
    return {
      title: `${markerNumber}. ${attractionName} - Visited`,
      background: "#006C56",
      borderColor: "#004638",
      glyphColor: "#FFFFFF",
      glyphText: "\u2713",
      scale: 1.15,
      zIndex: 10000 + markerNumber,
    };
  }

  return {
    title: `${markerNumber}. ${attractionName}`,
    background: "#E3EAE7",
    borderColor: "#65748A",
    glyphColor: "#10213B",
    glyphText: String(markerNumber),
    scale: 1.05,
    zIndex: markerNumber,
  };
}

export function getAttractionDetailsHref(attractionId) {
  return `/attractions/${encodeURIComponent(attractionId)}`;
}
