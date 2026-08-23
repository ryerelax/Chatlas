import assert from "node:assert/strict";
import test from "node:test";
import {
  createExplorationMapViewModel,
  VISITED_DATA_STATUS,
} from "../src/business/services/explorationMapService.js";
import {
  createExplorationRank,
  EXPLORER_RANK,
} from "../src/business/services/explorationRankService.js";
import { createExplorationRankPresentation } from "../src/presentation/lib/explorationRankPresentation.js";
import { refreshVerifiedVisitConsumers } from "../src/presentation/lib/visitVerificationPresentation.js";
import { createDevelopmentVisitedPreviewAdapter } from "../src/presentation/lib/visitedAttractionsAdapter.js";

function createProgress(overrides = {}) {
  return {
    status: VISITED_DATA_STATUS.SUCCESS,
    visitedCount: 0,
    totalCount: 1000,
    percentage: 0,
    ...overrides,
  };
}

function createAttractions(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `rank-attraction-${index + 1}`,
    name: `Rank Attraction ${index + 1}`,
    latitude: 2.19 + index / 1000,
    longitude: 102.25 + index / 1000,
  }));
}

test("exploration rank honours every threshold boundary after one-decimal normalisation", () => {
  const cases = [
    [-20, EXPLORER_RANK.NEW],
    [0, EXPLORER_RANK.NEW],
    [9.9, EXPLORER_RANK.NEW],
    [9.949, EXPLORER_RANK.NEW],
    [9.95, EXPLORER_RANK.BRONZE],
    [10, EXPLORER_RANK.BRONZE],
    [34.9, EXPLORER_RANK.BRONZE],
    [35, EXPLORER_RANK.SILVER],
    [64.9, EXPLORER_RANK.SILVER],
    [65, EXPLORER_RANK.GOLD],
    [99.9, EXPLORER_RANK.GOLD],
  ];

  for (const [percentage, expectedRank] of cases) {
    assert.equal(
      createExplorationRank(createProgress({ percentage }))?.id,
      expectedRank,
      String(percentage)
    );
  }
});

test("next-rank distance uses stable tenths and true completion alone achieves Melaka Master", () => {
  const bronze = createExplorationRank(createProgress({ percentage: 10.3 }));
  const nearSilver = createExplorationRank(createProgress({ percentage: 34.9 }));
  const roundedButIncomplete = createExplorationRank(
    createProgress({ visitedCount: 999, totalCount: 1000, percentage: 100 })
  );
  const complete = createExplorationRank(
    createProgress({ visitedCount: 232, totalCount: 232, percentage: 100 })
  );

  assert.equal(bronze.id, EXPLORER_RANK.BRONZE);
  assert.equal(bronze.nextRankId, EXPLORER_RANK.SILVER);
  assert.equal(bronze.percentageToNext, 24.7);
  assert.equal(nearSilver.percentageToNext, 0.1);
  assert.equal(roundedButIncomplete.id, EXPLORER_RANK.GOLD);
  assert.equal(roundedButIncomplete.percentageToNext, 0.1);
  assert.deepEqual(complete, {
    id: EXPLORER_RANK.MASTER,
    nextRankId: null,
    normalizedPercentage: 100,
    percentageToNext: 0,
    isComplete: true,
  });
});

test("rank stays neutral for loading, signed-out, error, unavailable, empty, and invalid progress", () => {
  for (const status of [
    VISITED_DATA_STATUS.LOADING,
    VISITED_DATA_STATUS.AUTH_REQUIRED,
    VISITED_DATA_STATUS.ERROR,
    VISITED_DATA_STATUS.UNAVAILABLE,
  ]) {
    assert.equal(createExplorationRank(createProgress({ status })), null, status);
  }

  assert.equal(
    createExplorationRank(createProgress({ totalCount: 0, percentage: 0 })),
    null
  );
  assert.equal(
    createExplorationRank(createProgress({ percentage: Number.NaN })),
    null
  );
});

test("rank uses canonical distinct verified IDs and ignores Review, Wishlist, marker, and upload data", () => {
  const attractions = createAttractions(10);
  const viewModel = createExplorationMapViewModel(
    attractions,
    [
      attractions[0].id,
      attractions[0].id,
      attractions[1].id,
      attractions[1].id,
      "unknown-attraction",
    ],
    VISITED_DATA_STATUS.SUCCESS
  );
  const canonicalRank = createExplorationRank(viewModel.progress);
  const noisyRank = createExplorationRank({
    ...viewModel.progress,
    reviewCount: 999,
    wishlistCount: 999,
    markerColour: "gold",
    uploadAttempts: 999,
  });

  assert.equal(viewModel.progress.visitedCount, 2);
  assert.equal(viewModel.progress.percentage, 20);
  assert.equal(canonicalRank.id, EXPLORER_RANK.BRONZE);
  assert.equal(canonicalRank.percentageToNext, 15);
  assert.deepEqual(noisyRank, canonicalRank);
});

test("development preview rank follows canonical add, remove, and reset progress", async () => {
  const originalNodeEnvironment = process.env.NODE_ENV;

  try {
    process.env.NODE_ENV = "development";
    const attractions = createAttractions(5);
    const previewAdapter = createDevelopmentVisitedPreviewAdapter({
      supportedAttractions: attractions,
    });

    const getRank = async (action) => {
      const result = await previewAdapter[action]();
      return createExplorationRank(
        createExplorationMapViewModel(
          attractions,
          result.data,
          result.status
        ).progress
      );
    };

    assert.equal((await getRank("load")).id, EXPLORER_RANK.SILVER);
    assert.equal((await getRank("add")).id, EXPLORER_RANK.GOLD);
    assert.equal((await getRank("remove")).id, EXPLORER_RANK.SILVER);
    assert.equal((await getRank("reset")).id, EXPLORER_RANK.SILVER);
  } finally {
    if (originalNodeEnvironment === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnvironment;
    }
  }
});

test("successful verification refresh recomputes progress and rank from refreshed IDs", async () => {
  const attractions = createAttractions(10);
  let canonicalVisitedIds = attractions.slice(0, 3).map((item) => item.id);
  const rankFromCanonicalIds = () =>
    createExplorationRank(
      createExplorationMapViewModel(
        attractions,
        canonicalVisitedIds,
        VISITED_DATA_STATUS.SUCCESS
      ).progress
    );

  assert.equal(rankFromCanonicalIds().id, EXPLORER_RANK.BRONZE);

  await refreshVerifiedVisitConsumers({
    attractionId: attractions[3].id,
    refreshVisitedAttractions: async () => {
      canonicalVisitedIds = [
        ...canonicalVisitedIds,
        attractions[3].id,
        attractions[3].id,
      ];
    },
    publishPublicPhotoInvalidation: () => {},
  });

  assert.equal(rankFromCanonicalIds().id, EXPLORER_RANK.SILVER);
  assert.equal(rankFromCanonicalIds().percentageToNext, 25);
});

test("all rank labels and next-rank copy are complete in English, Chinese, and BM", () => {
  const rankFixtures = [
    [0, EXPLORER_RANK.NEW],
    [10, EXPLORER_RANK.BRONZE],
    [35, EXPLORER_RANK.SILVER],
    [65, EXPLORER_RANK.GOLD],
    [100, EXPLORER_RANK.MASTER],
  ];
  const expectedLabels = {
    en: ["New Explorer", "Bronze Explorer", "Silver Explorer", "Gold Explorer", "Melaka Master"],
    zh: ["新晋探索者", "铜级探索者", "银级探索者", "金级探索者", "马六甲大师"],
    ms: ["Penjelajah Baharu", "Penjelajah Gangsa", "Penjelajah Perak", "Penjelajah Emas", "Pakar Melaka"],
  };

  for (const [language, labels] of Object.entries(expectedLabels)) {
    const actualLabels = rankFixtures.map(([percentage, rankId]) => {
      const rank = createExplorationRank(
        createProgress({
          percentage,
          visitedCount: rankId === EXPLORER_RANK.MASTER ? 1000 : 0,
        })
      );
      return createExplorationRankPresentation(rank, language).rankLabel;
    });
    assert.deepEqual(actualLabels, labels, language);
  }

  const bronze = createExplorationRank(createProgress({ percentage: 10.3 }));
  assert.deepEqual(createExplorationRankPresentation(bronze, "en"), {
    rankLabel: "Bronze Explorer",
    rankAriaLabel: "Explorer rank: Bronze Explorer",
    message: "24.7% more to reach Silver Explorer",
  });
  assert.deepEqual(createExplorationRankPresentation(bronze, "zh"), {
    rankLabel: "铜级探索者",
    rankAriaLabel: "探索等级：铜级探索者",
    message: "再探索 24.7% 即可晋升为银级探索者",
  });
  assert.deepEqual(createExplorationRankPresentation(bronze, "ms"), {
    rankLabel: "Penjelajah Gangsa",
    rankAriaLabel: "Taraf penjelajah: Penjelajah Gangsa",
    message: "Terokai lagi 24.7% untuk mencapai Penjelajah Perak",
  });
});

test("Melaka Master completion copy is natural and complete in all three languages", () => {
  const master = createExplorationRank(
    createProgress({ visitedCount: 1000, percentage: 100 })
  );

  assert.equal(
    createExplorationRankPresentation(master, "en").message,
    "All supported attractions explored — Melaka Master achieved!"
  );
  assert.equal(
    createExplorationRankPresentation(master, "zh").message,
    "已探索所有支持的景点——达成马六甲大师！"
  );
  assert.equal(
    createExplorationRankPresentation(master, "ms").message,
    "Semua tarikan yang disokong telah diterokai — tahap Pakar Melaka dicapai!"
  );
});
