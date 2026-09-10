import assert from "node:assert/strict";
import test from "node:test";
import * as explorationMapService from "../src/business/services/explorationMapService.js";
import {
  createExplorationMapViewModel,
  createExplorationPageState,
  createExplorationProgressSummary,
  normaliseAttractionId,
  normaliseMapAttractions,
  normaliseVisitedAttractionIds,
  selectDevelopmentPreviewVisitedAttractionIds,
  VISITED_DATA_STATUS,
} from "../src/business/services/explorationMapService.js";
import * as explorationMapPresentation from "../src/presentation/lib/explorationMapPresentation.js";
import {
  getAttractionDetailsHref,
  getMapMarkerPresentation,
} from "../src/presentation/lib/explorationMapPresentation.js";
import {
  canLoadVisitedAttractions,
  createVisitedDataReloadRevision,
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

test("session status and authenticated identity changes produce new visited-data reload revisions", () => {
  const loadingRevision = createVisitedDataReloadRevision({
    sessionStatus: "loading",
    sessionUserId: null,
    requestRevision: 0,
  });
  const firstIdentityRevision = createVisitedDataReloadRevision({
    sessionStatus: "authenticated",
    sessionUserId: "google-subject-one",
    requestRevision: 0,
  });
  const secondIdentityRevision = createVisitedDataReloadRevision({
    sessionStatus: "authenticated",
    sessionUserId: "google-subject-two",
    requestRevision: 0,
  });
  const signedOutRevision = createVisitedDataReloadRevision({
    sessionStatus: "unauthenticated",
    sessionUserId: null,
    requestRevision: 0,
  });

  assert.notEqual(loadingRevision, firstIdentityRevision);
  assert.notEqual(firstIdentityRevision, secondIdentityRevision);
  assert.notEqual(secondIdentityRevision, signedOutRevision);
});

test("private visited-data loading waits for session resolution while development previews stay independent", () => {
  assert.equal(
    canLoadVisitedAttractions({
      isPreviewQueryReady: true,
      developmentPreviewActive: false,
      developmentPreviewReady: false,
      sessionStatus: "loading",
    }),
    false
  );
  assert.equal(
    canLoadVisitedAttractions({
      isPreviewQueryReady: true,
      developmentPreviewActive: true,
      developmentPreviewReady: true,
      sessionStatus: "loading",
    }),
    true
  );
});

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
      verificationRadiusMeters: "50",
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
      verificationRadiusMeters: 50,
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

test("normaliseVisitedAttractionIds removes duplicates and invalid identifiers", () => {
  assert.deepEqual(
    normaliseVisitedAttractionIds([
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
  const visitedAttractionIds =
    selectDevelopmentPreviewVisitedAttractionIds(
      developmentPreviewAttractionFixtures
    );

  assert.deepEqual(visitedAttractionIds, [
    "preview-fixture-1",
    "preview-fixture-3",
    "preview-fixture-5",
  ]);
  assert.equal(visitedAttractionIds.length, 3);
  assert.equal(
    visitedAttractionIds.every((visitedAttractionId) =>
      developmentPreviewAttractionFixtures.some(
        (attraction) => attraction.id === visitedAttractionId
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

test("createExplorationMapViewModel marks supported visited attractions as visited", () => {
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

test("repeated verified IDs across dates count once in markers, list, and progress", () => {
  const attractions = [
    { ...supportedAttractionFixtures[0], id: "64b000000000000000000011" },
    { ...supportedAttractionFixtures[1], id: "64b000000000000000000012" },
    { ...supportedAttractionFixtures[0], id: "64b000000000000000000013" },
  ];
  const repeatedAcrossDates = [
    "64b000000000000000000011",
    "64b000000000000000000011",
    "64b000000000000000000012",
    "64b000000000000000000012",
    "64b000000000000000000099",
  ];
  const viewModel = createExplorationMapViewModel(
    attractions,
    repeatedAcrossDates,
    VISITED_DATA_STATUS.SUCCESS
  );
  const markerIds = viewModel.attractions
    .filter((attraction) => attraction.isVisited === true)
    .map((attraction) => attraction.id);
  const listIds = viewModel.visitedAttractions.map((attraction) => attraction.id);

  assert.deepEqual(markerIds, [
    "64b000000000000000000011",
    "64b000000000000000000012",
  ]);
  assert.deepEqual(viewModel.visitedAttractionIds, markerIds);
  assert.deepEqual(listIds, markerIds);
  assert.equal(viewModel.progress.visitedCount, listIds.length);
  assert.equal(viewModel.progress.totalCount, attractions.length);
  assert.equal(viewModel.progress.percentage, 66.7);
  assert.equal(
    getAttractionDetailsHref(listIds[0]),
    "/attractions/64b000000000000000000011"
  );
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
    VISITED_DATA_STATUS.AUTH_REQUIRED,
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

test("createExplorationMapViewModel does not treat missing visited IDs as a successful empty result", () => {
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
    VISITED_DATA_STATUS.AUTH_REQUIRED,
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

test("production adapter loads and normalises verified attraction IDs", async () => {
  const controller = new AbortController();
  let request;
  const result = await loadVisitedAttractionIds({
    signal: controller.signal,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(
        JSON.stringify({
          success: true,
          data: ["a", " a ", "b", "", null],
          visitedAttractions: [
            {
              attractionId: "a",
              latestVisitedDate: "2026-08-23",
              latestVerifiedAt: "2026-08-23T09:08:00.000Z",
            },
          ],
        }),
        { status: 200 }
      );
    },
  });

  assert.deepEqual(result, {
    status: VISITED_DATA_STATUS.SUCCESS,
    data: ["a", "b"],
    latestVisitedDateByAttractionId: { a: "2026-08-23" },
    latestVerifiedAtByAttractionId: {
      a: "2026-08-23T09:08:00.000Z",
    },
    message: "",
  });
  assert.equal(request.url, "/api/exploration-map/verified-visits");
  assert.deepEqual(request.options, {
    signal: controller.signal,
    cache: "no-store",
  });
});

test("production adapter keeps authentication-required distinct", async () => {
  const result = await loadVisitedAttractionIds({
    fetchImpl: async () =>
      new Response(JSON.stringify({ success: false }), { status: 401 }),
  });

  assert.deepEqual(result, {
    status: VISITED_DATA_STATUS.AUTH_REQUIRED,
    data: [],
    message: "Sign in to view your verified visits.",
  });
});

test("production adapter rejects malformed, unsuccessful, and invalid JSON responses", async (context) => {
  const responseFactories = {
    "malformed data": () =>
      new Response(JSON.stringify({ success: true, data: {} }), {
        status: 200,
      }),
    "unsuccessful payload": () =>
      new Response(JSON.stringify({ success: false, data: [] }), {
        status: 200,
      }),
    "non-ok response": () =>
      new Response(JSON.stringify({ success: true, data: [] }), {
        status: 503,
      }),
    "invalid JSON": () => new Response("not-json", { status: 200 }),
  };

  for (const [name, createResponse] of Object.entries(responseFactories)) {
    await context.test(name, async () => {
      await assert.rejects(
        loadVisitedAttractionIds({
          fetchImpl: async () => createResponse(),
        }),
        {
          name: "Error",
          message: "Verified visits could not be loaded.",
        }
      );
    });
  }
});

test("production adapter preserves abort failures for the component boundary", async () => {
  const abortError = new DOMException("The request was aborted.", "AbortError");

  await assert.rejects(
    loadVisitedAttractionIds({
      fetchImpl: async () => {
        throw abortError;
      },
    }),
    (error) => error === abortError
  );
});

test("production adapter preserves AbortError from response JSON parsing", async () => {
  const abortError = { name: "AbortError" };

  await assert.rejects(
    loadVisitedAttractionIds({
      fetchImpl: async () => ({
        status: 200,
        ok: true,
        json: async () => {
          throw abortError;
        },
      }),
    }),
    (error) => error === abortError
  );
});

test("the adapter returns mock visited IDs only while running in development", async () => {
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
      fetchImpl: async () =>
        new Response(
          JSON.stringify({ success: true, data: ["production-visit"] }),
          { status: 200 }
        ),
    });

    assert.equal(productionResult.status, VISITED_DATA_STATUS.SUCCESS);
    assert.deepEqual(productionResult.data, ["production-visit"]);
  } finally {
    if (originalNodeEnvironment === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnvironment;
    }
  }
});

test("development preview markers and visited list use the same three supported IDs", () => {
  const selectedIds = selectDevelopmentPreviewVisitedAttractionIds(
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
    let loaderCalls = 0;

    assert.equal(
      createDevelopmentVisitedPreviewAdapter({
        supportedAttractions: developmentPreviewAttractionFixtures,
        loadVisitedAttractionIdsImpl: async () => {
          loaderCalls += 1;
        },
      }),
      null
    );
    assert.equal(loaderCalls, 0);
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

test("visited helpers expose generic visited terminology", () => {
  assert.equal(
    typeof explorationMapService.normaliseVisitedAttractionIds,
    "function"
  );
  assert.equal(
    typeof explorationMapService.selectDevelopmentPreviewVisitedAttractionIds,
    "function"
  );
});

test("no-visit is exposed only after attractions and visited data both succeed", async (context) => {
  const emptyState = createExplorationPageState({
    supportedAttractions: supportedAttractionFixtures,
    visitedAttractionIds: [],
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
    VISITED_DATA_STATUS.AUTH_REQUIRED,
    VISITED_DATA_STATUS.ERROR,
    VISITED_DATA_STATUS.UNAVAILABLE,
  ]) {
    await context.test(visitedDataStatus, () => {
      const unresolvedState = createExplorationPageState({
          supportedAttractions: supportedAttractionFixtures,
          visitedAttractionIds: [],
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

test("development visited query previews never call the production fetch", async () => {
  const originalNodeEnvironment = process.env.NODE_ENV;

  try {
    process.env.NODE_ENV = "development";

    for (const queryString of [
      "?previewVisited=1",
      "?previewVisited=empty",
      "?previewVisited=loading",
    ]) {
      const mode = getDevelopmentVisitedPreviewMode(
        queryString,
        process.env.NODE_ENV
      );
      let fetchCalls = 0;
      let loaderCalls = 0;
      let receivedFetchImpl;
      const fetchImpl = async () => {
        fetchCalls += 1;
        throw new Error("Production fetch must not run for previews.");
      };
      const previewAdapter = createDevelopmentVisitedPreviewAdapter({
        supportedAttractions: developmentPreviewAttractionFixtures,
        mode,
        fetchImpl,
        loadVisitedAttractionIdsImpl: async (options) => {
          loaderCalls += 1;
          receivedFetchImpl = options.fetchImpl;
          return loadVisitedAttractionIds(options);
        },
      });
      const result = await previewAdapter.load();

      assert.equal(loaderCalls, 1);
      assert.equal(receivedFetchImpl, fetchImpl);
      assert.equal(fetchCalls, 0);
      assert.equal(
        result.status,
        mode === "loading"
          ? VISITED_DATA_STATUS.LOADING
          : VISITED_DATA_STATUS.SUCCESS
      );
    }
  } finally {
    if (originalNodeEnvironment === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnvironment;
    }
  }
});

test("production query strings cannot enable visited mock data", async () => {
  const originalNodeEnvironment = process.env.NODE_ENV;

  try {
    process.env.NODE_ENV = "production";
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({ success: true, data: ["production-visit"] }),
        { status: 200 }
      );

    for (const queryString of [
      "?previewVisited=1",
      "?previewVisited=empty",
      "?previewVisited=loading",
    ]) {
      assert.equal(
        getDevelopmentVisitedPreviewMode(queryString, process.env.NODE_ENV),
        null
      );
      const result = await loadVisitedAttractionIds({
        developmentPreview: true,
        previewAttractionIds: ["mock-visit"],
        fetchImpl,
      });

      assert.deepEqual(result.data, ["production-visit"]);
    }
  } finally {
    if (originalNodeEnvironment === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnvironment;
    }
  }
});

test("authentication-required keeps visit markers and progress unresolved", () => {
  const viewModel = createExplorationMapViewModel(
    supportedAttractionFixtures,
    ["melaka-1"],
    VISITED_DATA_STATUS.AUTH_REQUIRED
  );

  assert.equal(
    viewModel.visitedDataStatus,
    VISITED_DATA_STATUS.AUTH_REQUIRED
  );
  assert.deepEqual(
    viewModel.attractions.map((attraction) => attraction.isVisited),
    [null, null]
  );
  assert.deepEqual(viewModel.visitedAttractions, []);
  assert.equal(viewModel.progress.visitedCount, null);
  assert.equal(viewModel.progress.percentage, null);
});

test("authentication-required presentation points to the accessible sign-in route", () => {
  assert.equal(
    typeof explorationMapPresentation.getVisitedAuthenticationPresentation,
    "function"
  );

  const presentation =
    explorationMapPresentation.getVisitedAuthenticationPresentation(
      VISITED_DATA_STATUS.AUTH_REQUIRED
    );

  assert.deepEqual(presentation, {
    message: "Sign in to view your verified visits.",
    signInHref: "/login",
    signInLabel: "Sign in",
  });
  assert.equal(
    explorationMapPresentation.getVisitedAuthenticationPresentation("error"),
    null
  );
});

test("existing guest routes and the exploration map remain public", () => {
  assert.equal(typeof explorationMapService.isPublicPagePathname, "function");

  for (const pathname of [
    "/",
    "/offline",
    "/sw.js",
    "/manifest.webmanifest",
    "/exploration-map",
    "/exploration-map/",
    "/profiles",
    "/profiles/507f1f77bcf86cd799439011",
    "/attractions/507f1f77bcf86cd799439011",
    "/attractions/507F1F77BCF86CD799439011/",
    "/attractions/507f1f77bcf86cd799439011/location",
    "/attractions/507f1f77bcf86cd799439011/location/",
    "/attractions/add",
  ]) {
    assert.equal(
      explorationMapService.isPublicPagePathname(pathname),
      true,
      pathname
    );
  }

  for (const pathname of [
    "/profile",
    "/test",
    "/attractions",
    "/Attractions/507f1f77bcf86cd799439011",
    "/exploration-map/manage",
    "/api/exploration-map/verified-visits",
  ]) {
    assert.equal(
      explorationMapService.isPublicPagePathname(pathname),
      false,
      pathname
    );
  }
});

test("attractions loading suppresses empty counts while visited loading keeps supported places", async (context) => {
  await context.test("attractions loading", () => {
    const pageState = createExplorationPageState({
      supportedAttractions: supportedAttractionFixtures,
      visitedAttractionIds: [],
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
      visitedAttractionIds: [],
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
    visitedAttractionIds: ["melaka-2"],
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
    visitedAttractionIds: [],
    attractionDataStatus: "success",
    visitedDataStatus: VISITED_DATA_STATUS.LOADING,
    mapStatus: "ready",
  });
  const successState = createExplorationPageState({
    supportedAttractions: attractions,
    visitedAttractionIds: [
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

test("one successful batch refreshes canonical visited IDs and invalidates one matching photo collection", async () => {
  const { refreshVerifiedVisitConsumers } = await import(
    "../src/presentation/lib/visitVerificationPresentation.js"
  );
  let canonicalVisitedIds = ["melaka-1"];
  let refreshCount = 0;
  const invalidatedAttractionIds = [];

  await refreshVerifiedVisitConsumers({
    attractionId: "melaka-1",
    refreshVisitedAttractions: async () => {
      refreshCount += 1;
      canonicalVisitedIds = explorationMapService.normaliseVisitedAttractionIds([
        "melaka-1",
        "melaka-1",
      ]);
    },
    publishPublicPhotoInvalidation: (attractionId) => {
      invalidatedAttractionIds.push(attractionId);
    },
  });

  assert.equal(refreshCount, 1);
  assert.deepEqual(canonicalVisitedIds, ["melaka-1"]);
  assert.deepEqual(invalidatedAttractionIds, ["melaka-1"]);
});

test("public-photo invalidation publishes even while visited refresh is still pending", async () => {
  const { refreshVerifiedVisitConsumers } = await import(
    "../src/presentation/lib/visitVerificationPresentation.js"
  );
  let finishRefresh;
  const invalidatedAttractionIds = [];
  const refreshPromise = refreshVerifiedVisitConsumers({
    attractionId: "melaka-1",
    refreshVisitedAttractions: () => new Promise((resolve) => {
      finishRefresh = resolve;
    }),
    publishPublicPhotoInvalidation: (attractionId) => {
      invalidatedAttractionIds.push(attractionId);
    },
  });

  await Promise.resolve();
  assert.deepEqual(invalidatedAttractionIds, ["melaka-1"]);
  finishRefresh();
  await refreshPromise;
});

test("visited refresh rejection still publishes invalidation and preserves the rejection", async () => {
  const { refreshVerifiedVisitConsumers } = await import(
    "../src/presentation/lib/visitVerificationPresentation.js"
  );
  const refreshError = new Error("visited refresh unavailable");
  const invalidatedAttractionIds = [];

  await assert.rejects(
    refreshVerifiedVisitConsumers({
      attractionId: "melaka-1",
      refreshVisitedAttractions: async () => {
        throw refreshError;
      },
      publishPublicPhotoInvalidation: (attractionId) => {
        invalidatedAttractionIds.push(attractionId);
      },
    }),
    (error) => error === refreshError
  );
  assert.deepEqual(invalidatedAttractionIds, ["melaka-1"]);
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
