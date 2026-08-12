import assert from "node:assert/strict";
import test from "node:test";
import {
  createExplorationMapViewModel,
  createExplorationPageState,
  createExplorationProgressSummary,
  normaliseAttractionId,
  normaliseMapAttractions,
  normaliseReviewedAttractionIds,
  selectDevelopmentPreviewReviewedAttractionIds,
  VISITED_DATA_STATUS,
} from "../src/business/services/explorationMapService.js";
import {
  getAttractionDetailsHref,
  getMapMarkerPresentation,
} from "../src/presentation/lib/explorationMapPresentation.js";
import {
  createDevelopmentVisitedPreviewAdapter,
  getDevelopmentMapPreviewMode,
  getDevelopmentVisitedPreviewMode,
  isDevelopmentVisitedPreviewEnabled,
  loadVisitedAttractionIds,
} from "../src/presentation/lib/visitedAttractionsAdapter.js";

const supportedAttractionFixtures = [
  {
    id: "melaka-1",
    name: "A Famosa",
    address: "Bandar Hilir",
    category: "Historical",
    latitude: 2.1918,
    longitude: 102.2504,
    rating: 4.6,
  },
  {
    id: "melaka-2",
    name: "Melaka River",
    address: "Jalan Kampung Hulu",
    category: "Nature",
    latitude: 2.2017,
    longitude: 102.2496,
    rating: 4.5,
  },
];

const developmentPreviewAttractionFixtures = [
  { ...supportedAttractionFixtures[0], id: "preview-fixture-1" },
  { ...supportedAttractionFixtures[1], id: "preview-fixture-2" },
  { ...supportedAttractionFixtures[0], id: "preview-fixture-3" },
  { ...supportedAttractionFixtures[1], id: "preview-fixture-4" },
  { ...supportedAttractionFixtures[0], id: "preview-fixture-5" },
];

function createProgressAttractionFixtures(count) {
  return Array.from({ length: count }, (_, index) => ({
    ...supportedAttractionFixtures[index % supportedAttractionFixtures.length],
    id: `progress-fixture-${index + 1}`,
  }));
}

test("normaliseMapAttractions keeps supported attractions with valid coordinates", () => {
  const attractions = normaliseMapAttractions([
    {
      _id: "melaka-1",
      name: "  A Famosa  ",
      address: "Bandar Hilir",
      category: "Historical",
      latitude: "2.1918",
      longitude: 102.2504,
      rating: "4.6",
    },
  ]);

  assert.deepEqual(attractions, [
    {
      id: "melaka-1",
      name: "A Famosa",
      address: "Bandar Hilir",
      category: "Historical",
      latitude: 2.1918,
      longitude: 102.2504,
      rating: 4.6,
    },
  ]);
});

test("normaliseMapAttractions removes records that cannot be placed on the map", () => {
  const attractions = normaliseMapAttractions([
    { _id: "missing-latitude", longitude: 102.25 },
    { _id: "invalid-latitude", latitude: 91, longitude: 102.25 },
    { _id: "invalid-longitude", latitude: 2.19, longitude: 181 },
    { latitude: 2.19, longitude: 102.25 },
  ]);

  assert.deepEqual(attractions, []);
});

test("normaliseMapAttractions returns an empty list for a non-array response", () => {
  assert.deepEqual(normaliseMapAttractions(null), []);
});

test("normaliseAttractionId trims string-like identifiers and rejects invalid values", () => {
  assert.equal(normaliseAttractionId("  melaka-1  "), "melaka-1");
  assert.equal(
    normaliseAttractionId({ toString: () => "melaka-object-id" }),
    "melaka-object-id"
  );
  assert.equal(normaliseAttractionId("   "), null);
  assert.equal(normaliseAttractionId({}), null);
  assert.equal(normaliseAttractionId(null), null);
});

test("normaliseReviewedAttractionIds removes duplicates and invalid identifiers", () => {
  assert.deepEqual(
    normaliseReviewedAttractionIds([
      "melaka-1",
      " melaka-1 ",
      "melaka-2",
      "",
      null,
    ]),
    ["melaka-1", "melaka-2"]
  );
});

test("development preview selects three IDs only from the loaded supported attractions", () => {
  const reviewedAttractionIds =
    selectDevelopmentPreviewReviewedAttractionIds(
      developmentPreviewAttractionFixtures
    );

  assert.deepEqual(reviewedAttractionIds, [
    "preview-fixture-1",
    "preview-fixture-3",
    "preview-fixture-5",
  ]);
  assert.equal(reviewedAttractionIds.length, 3);
  assert.equal(
    reviewedAttractionIds.every((reviewedAttractionId) =>
      developmentPreviewAttractionFixtures.some(
        (attraction) => attraction.id === reviewedAttractionId
      )
    ),
    true
  );
});

test("development preview query is enabled only by the exact development flag", () => {
  assert.equal(
    isDevelopmentVisitedPreviewEnabled(
      "?previewVisited=1",
      "development"
    ),
    true
  );
  assert.equal(
    isDevelopmentVisitedPreviewEnabled(
      "?previewVisited=1",
      "production"
    ),
    false
  );
  assert.equal(
    isDevelopmentVisitedPreviewEnabled(
      "?previewVisited=0",
      "development"
    ),
    false
  );
});

test("createExplorationMapViewModel marks supported reviewed attractions as visited", () => {
  const viewModel = createExplorationMapViewModel(
    supportedAttractionFixtures,
    ["melaka-2", "melaka-2", "stale-attraction-id"],
    VISITED_DATA_STATUS.SUCCESS
  );

  assert.deepEqual(
    viewModel.attractions.map(({ id, isVisited }) => ({ id, isVisited })),
    [
      { id: "melaka-1", isVisited: false },
      { id: "melaka-2", isVisited: true },
    ]
  );
  assert.deepEqual(viewModel.visitedAttractionIds, ["melaka-2"]);
  assert.deepEqual(
    viewModel.visitedAttractions.map((attraction) => attraction.id),
    viewModel.attractions
      .filter((attraction) => attraction.isVisited === true)
      .map((attraction) => attraction.id)
  );
  assert.equal(viewModel.visitedDataStatus, VISITED_DATA_STATUS.SUCCESS);
});

test("createExplorationMapViewModel represents a successful empty result truthfully", () => {
  const viewModel = createExplorationMapViewModel(
    supportedAttractionFixtures,
    [],
    VISITED_DATA_STATUS.SUCCESS
  );

  assert.deepEqual(
    viewModel.attractions.map((attraction) => attraction.isVisited),
    [false, false]
  );
  assert.deepEqual(viewModel.visitedAttractions, []);
  assert.deepEqual(viewModel.visitedAttractionIds, []);
});

test("exploration progress reports 3 of 123 supported attractions as 2.4 percent", () => {
  const attractions = createProgressAttractionFixtures(123);
  const viewModel = createExplorationMapViewModel(
    attractions,
    [
      "progress-fixture-1",
      "progress-fixture-2",
      "progress-fixture-3",
      "progress-fixture-3",
      "unknown-progress-fixture",
    ],
    VISITED_DATA_STATUS.SUCCESS
  );

  assert.deepEqual(viewModel.progress, {
    status: VISITED_DATA_STATUS.SUCCESS,
    visitedCount: 3,
    totalCount: 123,
    percentage: 2.4,
    percentageLabel: "2.4%",
  });
});

test("exploration progress handles successful empty and complete results", async (context) => {
  const attractions = createProgressAttractionFixtures(4);

  await context.test("empty", () => {
    const viewModel = createExplorationMapViewModel(
      attractions,
      [],
      VISITED_DATA_STATUS.SUCCESS
    );

    assert.deepEqual(viewModel.progress, {
      status: VISITED_DATA_STATUS.SUCCESS,
      visitedCount: 0,
      totalCount: 4,
      percentage: 0,
      percentageLabel: "0%",
    });
  });

  await context.test("complete", () => {
    const viewModel = createExplorationMapViewModel(
      attractions,
      attractions.map((attraction) => attraction.id),
      VISITED_DATA_STATUS.SUCCESS
    );

    assert.deepEqual(viewModel.progress, {
      status: VISITED_DATA_STATUS.SUCCESS,
      visitedCount: 4,
      totalCount: 4,
      percentage: 100,
      percentageLabel: "100%",
    });
  });
});

test("exploration progress never exceeds 100 percent or divides by zero", () => {
  const overCountedProgress = createExplorationProgressSummary(
    createProgressAttractionFixtures(2),
    createProgressAttractionFixtures(3),
    VISITED_DATA_STATUS.SUCCESS
  );
  const zeroTotalProgress = createExplorationProgressSummary(
    [],
    [],
    VISITED_DATA_STATUS.SUCCESS
  );

  assert.equal(overCountedProgress.visitedCount, 2);
  assert.equal(overCountedProgress.percentage, 100);
  assert.equal(overCountedProgress.percentageLabel, "100%");
  assert.equal(zeroTotalProgress.percentage, 0);
  assert.equal(zeroTotalProgress.percentageLabel, "0%");
  assert.equal(Number.isFinite(zeroTotalProgress.percentage), true);
});

test("unresolved visited states do not expose a misleading zero percent", async (context) => {
  const attractions = createProgressAttractionFixtures(4);

  for (const status of [
    VISITED_DATA_STATUS.LOADING,
    VISITED_DATA_STATUS.ERROR,
    VISITED_DATA_STATUS.UNAVAILABLE,
  ]) {
    await context.test(status, () => {
      const progress = createExplorationProgressSummary(
        attractions,
        [],
        status
      );

      assert.equal(progress.status, status);
      assert.equal(progress.totalCount, 4);
      assert.equal(progress.visitedCount, null);
      assert.equal(progress.percentage, null);
      assert.equal(progress.percentageLabel, null);
    });
  }
});

test("createExplorationMapViewModel does not treat missing reviewed IDs as a successful empty result", () => {
  const viewModel = createExplorationMapViewModel(
    supportedAttractionFixtures,
    undefined,
    VISITED_DATA_STATUS.SUCCESS
  );

  assert.equal(
    viewModel.visitedDataStatus,
    VISITED_DATA_STATUS.UNAVAILABLE
  );
  assert.deepEqual(
    viewModel.attractions.map((attraction) => attraction.isVisited),
    [null, null]
  );
  assert.deepEqual(viewModel.visitedAttractions, []);
  assert.deepEqual(viewModel.visitedAttractionIds, []);
});

test("createExplorationMapViewModel keeps visited state unknown when data is unavailable or failed", async (context) => {
  for (const status of [
    VISITED_DATA_STATUS.LOADING,
    VISITED_DATA_STATUS.UNAVAILABLE,
    VISITED_DATA_STATUS.ERROR,
  ]) {
    await context.test(status, () => {
      const viewModel = createExplorationMapViewModel(
        supportedAttractionFixtures,
        ["melaka-1"],
        status
      );

      assert.deepEqual(
        viewModel.attractions.map((attraction) => attraction.isVisited),
        [null, null]
      );
      assert.deepEqual(viewModel.visitedAttractions, []);
      assert.deepEqual(viewModel.visitedAttractionIds, []);
      assert.equal(viewModel.visitedDataStatus, status);
    });
  }
});

test("the production adapter reports integration pending without fake visited IDs", async () => {
  const result = await loadVisitedAttractionIds();

  assert.equal(result.status, VISITED_DATA_STATUS.UNAVAILABLE);
  assert.deepEqual(result.data, []);
  assert.match(result.message, /Review integration/);
  assert.doesNotMatch(result.message, /Authentication/);
});

test("the adapter returns mock reviewed IDs only while running in development", async () => {
  const originalNodeEnvironment = process.env.NODE_ENV;

  try {
    process.env.NODE_ENV = "development";

    const developmentResult = await loadVisitedAttractionIds({
      developmentPreview: true,
      previewAttractionIds: [
        "preview-fixture-1",
        "preview-fixture-3",
        "preview-fixture-5",
      ],
    });

    assert.equal(developmentResult.status, VISITED_DATA_STATUS.SUCCESS);
    assert.deepEqual(developmentResult.data, [
      "preview-fixture-1",
      "preview-fixture-3",
      "preview-fixture-5",
    ]);

    process.env.NODE_ENV = "production";

    const productionResult = await loadVisitedAttractionIds({
      developmentPreview: true,
      previewAttractionIds: [
        "preview-fixture-1",
        "preview-fixture-3",
        "preview-fixture-5",
      ],
    });

    assert.equal(productionResult.status, VISITED_DATA_STATUS.UNAVAILABLE);
    assert.deepEqual(productionResult.data, []);
  } finally {
    if (originalNodeEnvironment === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnvironment;
    }
  }
});

test("development preview markers and visited list use the same three supported IDs", () => {
  const selectedIds = selectDevelopmentPreviewReviewedAttractionIds(
    developmentPreviewAttractionFixtures
  );
  const viewModel = createExplorationMapViewModel(
    developmentPreviewAttractionFixtures,
    [selectedIds[0], ...selectedIds, selectedIds[1], "unknown-preview-id"],
    VISITED_DATA_STATUS.SUCCESS
  );
  const markerVisitedIds = viewModel.attractions
    .filter((attraction) => attraction.isVisited === true)
    .map((attraction) => attraction.id);
  const visitedListIds = viewModel.visitedAttractions.map(
    (attraction) => attraction.id
  );

  assert.equal(viewModel.attractions.length, 5);
  assert.deepEqual(markerVisitedIds, [
    "preview-fixture-1",
    "preview-fixture-3",
    "preview-fixture-5",
  ]);
  assert.deepEqual(visitedListIds, markerVisitedIds);
  assert.deepEqual(viewModel.visitedAttractionIds, markerVisitedIds);
});

test("development preview adapter synchronises add, remove, and reset through the canonical view model", async () => {
  const originalNodeEnvironment = process.env.NODE_ENV;

  try {
    process.env.NODE_ENV = "development";
    const previewAdapter = createDevelopmentVisitedPreviewAdapter({
      supportedAttractions: developmentPreviewAttractionFixtures,
    });

    assert.ok(previewAdapter);

    const initialResult = await previewAdapter.load();
    const initialViewModel = createExplorationMapViewModel(
      developmentPreviewAttractionFixtures,
      initialResult.data,
      initialResult.status
    );

    assert.deepEqual(initialViewModel.visitedAttractionIds, [
      "preview-fixture-1",
      "preview-fixture-3",
      "preview-fixture-5",
    ]);
    assert.equal(initialViewModel.progress.visitedCount, 3);
    assert.equal(initialViewModel.progress.percentage, 60);

    const addedResult = await previewAdapter.add();
    const addedViewModel = createExplorationMapViewModel(
      developmentPreviewAttractionFixtures,
      addedResult.data,
      addedResult.status
    );
    const addedMarkerIds = addedViewModel.attractions
      .filter((attraction) => attraction.isVisited === true)
      .map((attraction) => attraction.id);
    const addedListIds = addedViewModel.visitedAttractions.map(
      (attraction) => attraction.id
    );

    assert.deepEqual(addedMarkerIds, [
      "preview-fixture-1",
      "preview-fixture-2",
      "preview-fixture-3",
      "preview-fixture-5",
    ]);
    assert.deepEqual(addedListIds, addedMarkerIds);
    assert.equal(addedViewModel.progress.visitedCount, 4);
    assert.equal(
      addedViewModel.progress.visitedCount,
      addedViewModel.visitedAttractions.length
    );
    assert.equal(addedViewModel.progress.totalCount, 5);
    assert.equal(addedViewModel.progress.percentage, 80);
    assert.match(
      getMapMarkerPresentation(
        addedViewModel.attractions.find(
          (attraction) => attraction.id === "preview-fixture-2"
        ),
        1
      ).title,
      /Visited/
    );

    const removedResult = await previewAdapter.remove();
    const removedViewModel = createExplorationMapViewModel(
      developmentPreviewAttractionFixtures,
      removedResult.data,
      removedResult.status
    );

    assert.deepEqual(removedViewModel.visitedAttractionIds, [
      "preview-fixture-1",
      "preview-fixture-3",
      "preview-fixture-5",
    ]);
    assert.equal(removedViewModel.progress.visitedCount, 3);
    assert.equal(removedViewModel.attractions.length, 5);
    assert.equal(
      removedViewModel.attractions.find(
        (attraction) => attraction.id === "preview-fixture-2"
      )?.isVisited,
      false
    );
    assert.equal(
      removedViewModel.progress.visitedCount,
      removedViewModel.visitedAttractions.length
    );
    assert.doesNotMatch(
      getMapMarkerPresentation(
        removedViewModel.attractions.find(
          (attraction) => attraction.id === "preview-fixture-2"
        ),
        1
      ).title,
      /Visited/
    );

    await previewAdapter.remove();
    const resetResult = await previewAdapter.reset();
    const resetViewModel = createExplorationMapViewModel(
      developmentPreviewAttractionFixtures,
      resetResult.data,
      resetResult.status
    );

    assert.deepEqual(resetViewModel.visitedAttractionIds, [
      "preview-fixture-1",
      "preview-fixture-3",
      "preview-fixture-5",
    ]);
    assert.equal(resetViewModel.progress.visitedCount, 3);
  } finally {
    if (originalNodeEnvironment === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnvironment;
    }
  }
});

test("production mode cannot create development preview controls", () => {
  const originalNodeEnvironment = process.env.NODE_ENV;

  try {
    process.env.NODE_ENV = "production";

    assert.equal(
      createDevelopmentVisitedPreviewAdapter({
        supportedAttractions: developmentPreviewAttractionFixtures,
      }),
      null
    );
  } finally {
    if (originalNodeEnvironment === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnvironment;
    }
  }
});

test("getMapMarkerPresentation distinguishes visited markers by colour, glyph, and title", () => {
  const visitedPresentation = getMapMarkerPresentation(
    { ...supportedAttractionFixtures[0], isVisited: true },
    0
  );
  const neutralPresentation = getMapMarkerPresentation(
    { ...supportedAttractionFixtures[1], isVisited: null },
    1
  );

  assert.equal(visitedPresentation.background, "#006C56");
  assert.equal(visitedPresentation.glyphText, "\u2713");
  assert.match(visitedPresentation.title, /Visited/);
  assert.equal(visitedPresentation.zIndex > neutralPresentation.zIndex, true);
  assert.equal(neutralPresentation.background, "#E3EAE7");
  assert.equal(neutralPresentation.glyphText, "2");
  assert.doesNotMatch(neutralPresentation.title, /Visited/);
  assert.notEqual(
    visitedPresentation.background,
    neutralPresentation.background
  );
  assert.notEqual(
    visitedPresentation.glyphText,
    neutralPresentation.glyphText
  );
});

test("getAttractionDetailsHref safely encodes the attraction identifier", () => {
  assert.equal(
    getAttractionDetailsHref("melaka place/1"),
    "/attractions/melaka%20place%2F1"
  );
});

test("no-visit is exposed only after attractions and visited data both succeed", async (context) => {
  const emptyState = createExplorationPageState({
    supportedAttractions: supportedAttractionFixtures,
    reviewedAttractionIds: [],
    attractionDataStatus: "success",
    visitedDataStatus: VISITED_DATA_STATUS.SUCCESS,
    mapStatus: "ready",
  });

  assert.equal(emptyState.isNoVisit, true);
  assert.equal(emptyState.viewModel.attractions.length, 2);
  assert.equal(
    emptyState.viewModel.attractions.filter(
      (attraction) => attraction.isVisited === true
    ).length,
    0
  );
  assert.equal(emptyState.viewModel.visitedAttractions.length, 0);
  assert.equal(emptyState.viewModel.progress.visitedCount, 0);
  assert.equal(emptyState.viewModel.progress.totalCount, 2);
  assert.equal(emptyState.viewModel.progress.percentage, 0);

  for (const visitedDataStatus of [
    VISITED_DATA_STATUS.LOADING,
    VISITED_DATA_STATUS.ERROR,
    VISITED_DATA_STATUS.UNAVAILABLE,
  ]) {
    await context.test(visitedDataStatus, () => {
      const unresolvedState = createExplorationPageState({
          supportedAttractions: supportedAttractionFixtures,
          reviewedAttractionIds: [],
          attractionDataStatus: "success",
          visitedDataStatus,
          mapStatus: "ready",
        });

      assert.equal(unresolvedState.isNoVisit, false);
      assert.equal(unresolvedState.viewModel.progress.visitedCount, null);
      assert.equal(unresolvedState.viewModel.progress.percentage, null);
    });
  }
});

test("attractions loading suppresses empty counts while visited loading keeps supported places", async (context) => {
  await context.test("attractions loading", () => {
    const pageState = createExplorationPageState({
      supportedAttractions: supportedAttractionFixtures,
      reviewedAttractionIds: [],
      attractionDataStatus: "loading",
      visitedDataStatus: VISITED_DATA_STATUS.SUCCESS,
      mapStatus: "idle",
    });

    assert.equal(pageState.isAttractionsLoading, true);
    assert.equal(pageState.isNoVisit, false);
    assert.equal(pageState.viewModel.attractions.length, 0);
    assert.equal(pageState.viewModel.progress.visitedCount, null);
    assert.equal(pageState.viewModel.progress.percentage, null);
  });

  await context.test("visited data loading", () => {
    const pageState = createExplorationPageState({
      supportedAttractions: supportedAttractionFixtures,
      reviewedAttractionIds: [],
      attractionDataStatus: "success",
      visitedDataStatus: VISITED_DATA_STATUS.LOADING,
      mapStatus: "loading",
    });

    assert.equal(pageState.isAttractionsLoading, false);
    assert.equal(pageState.isNoVisit, false);
    assert.equal(pageState.viewModel.attractions.length, 2);
    assert.deepEqual(
      pageState.viewModel.attractions.map(
        (attraction) => attraction.isVisited
      ),
      [null, null]
    );
    assert.equal(pageState.viewModel.progress.visitedCount, null);
    assert.equal(pageState.viewModel.progress.percentage, null);
  });
});

test("map unavailable preserves canonical marker, list, progress, and details data", () => {
  const pageState = createExplorationPageState({
    supportedAttractions: supportedAttractionFixtures,
    reviewedAttractionIds: ["melaka-2"],
    attractionDataStatus: "success",
    visitedDataStatus: VISITED_DATA_STATUS.SUCCESS,
    mapStatus: "unavailable",
  });
  const markerVisitedIds = pageState.viewModel.attractions
    .filter((attraction) => attraction.isVisited === true)
    .map((attraction) => attraction.id);
  const visitedListIds = pageState.viewModel.visitedAttractions.map(
    (attraction) => attraction.id
  );

  assert.equal(pageState.isMapUnavailable, true);
  assert.equal(pageState.viewModel.visitedDataStatus, "success");
  assert.deepEqual(markerVisitedIds, ["melaka-2"]);
  assert.deepEqual(visitedListIds, markerVisitedIds);
  assert.equal(pageState.viewModel.progress.visitedCount, 1);
  assert.equal(pageState.viewModel.progress.totalCount, 2);
  assert.equal(pageState.viewModel.progress.percentage, 50);
  assert.deepEqual(
    pageState.viewModel.attractions.map((attraction) => attraction.id),
    ["melaka-1", "melaka-2"]
  );
  assert.equal(
    getAttractionDetailsHref(pageState.viewModel.visitedAttractions[0].id),
    "/attractions/melaka-2"
  );
});

test("loading completion synchronises dynamic marker, list, and progress totals", () => {
  const attractions = createProgressAttractionFixtures(7);
  const loadingState = createExplorationPageState({
    supportedAttractions: attractions,
    reviewedAttractionIds: [],
    attractionDataStatus: "success",
    visitedDataStatus: VISITED_DATA_STATUS.LOADING,
    mapStatus: "ready",
  });
  const successState = createExplorationPageState({
    supportedAttractions: attractions,
    reviewedAttractionIds: [
      "progress-fixture-2",
      "progress-fixture-5",
      "progress-fixture-5",
      "stale-progress-fixture",
    ],
    attractionDataStatus: "success",
    visitedDataStatus: VISITED_DATA_STATUS.SUCCESS,
    mapStatus: "ready",
  });
  const markerVisitedIds = successState.viewModel.attractions
    .filter((attraction) => attraction.isVisited === true)
    .map((attraction) => attraction.id);
  const visitedListIds = successState.viewModel.visitedAttractions.map(
    (attraction) => attraction.id
  );

  assert.equal(loadingState.viewModel.attractions.length, 7);
  assert.equal(loadingState.viewModel.progress.percentage, null);
  assert.deepEqual(markerVisitedIds, [
    "progress-fixture-2",
    "progress-fixture-5",
  ]);
  assert.deepEqual(visitedListIds, markerVisitedIds);
  assert.equal(
    successState.viewModel.progress.visitedCount,
    visitedListIds.length
  );
  assert.equal(successState.viewModel.progress.totalCount, 7);
  assert.equal(successState.viewModel.progress.percentage, 28.6);
});

test("PB34 development preview query modes are exact and development-only", () => {
  assert.equal(
    getDevelopmentVisitedPreviewMode(
      "?previewVisited=1",
      "development"
    ),
    "visited"
  );
  assert.equal(
    getDevelopmentVisitedPreviewMode(
      "?previewVisited=empty",
      "development"
    ),
    "empty"
  );
  assert.equal(
    getDevelopmentVisitedPreviewMode(
      "?previewVisited=loading",
      "development"
    ),
    "loading"
  );
  assert.equal(
    getDevelopmentMapPreviewMode(
      "?previewMap=loading",
      "development"
    ),
    "loading"
  );
  assert.equal(
    getDevelopmentMapPreviewMode(
      "?previewMap=unavailable",
      "development"
    ),
    "unavailable"
  );
  assert.equal(
    getDevelopmentVisitedPreviewMode(
      "?previewVisited=empty",
      "production"
    ),
    null
  );
  assert.equal(
    getDevelopmentMapPreviewMode(
      "?previewMap=unavailable",
      "production"
    ),
    null
  );
  assert.equal(
    getDevelopmentVisitedPreviewMode(
      "?previewVisited=unknown",
      "development"
    ),
    null
  );
});

test("development adapter represents successful-empty and loading previews without fake IDs", async () => {
  const originalNodeEnvironment = process.env.NODE_ENV;

  try {
    process.env.NODE_ENV = "development";

    const emptyAdapter = createDevelopmentVisitedPreviewAdapter({
      supportedAttractions: developmentPreviewAttractionFixtures,
      mode: "empty",
    });
    const loadingAdapter = createDevelopmentVisitedPreviewAdapter({
      supportedAttractions: developmentPreviewAttractionFixtures,
      mode: "loading",
    });
    const emptyResult = await emptyAdapter.load();
    const loadingResult = await loadingAdapter.load();

    assert.equal(emptyResult.status, VISITED_DATA_STATUS.SUCCESS);
    assert.deepEqual(emptyResult.data, []);
    assert.equal(loadingResult.status, VISITED_DATA_STATUS.LOADING);
    assert.deepEqual(loadingResult.data, []);
  } finally {
    if (originalNodeEnvironment === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnvironment;
    }
  }
});
