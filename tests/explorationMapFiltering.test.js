import assert from "node:assert/strict";
import test from "node:test";
import {
  createVisibleAttractions,
  getExplorationMapFilterCountLabel,
  getNextExplorationMapFilter,
} from "../src/business/services/explorationMapService.js";
import {
  createVisitedVerificationPresentation,
  getVisitedAttractionsCopy,
  paginateVisitedAttractions,
  sortVisitedAttractions,
  VISITED_ATTRACTIONS_SORT,
} from "../src/presentation/lib/visitedAttractionsAdapter.js";

const attractions = [
  { id: "a", name: "Zebra", isVisited: true },
  { id: "b", name: "A Famosa", isVisited: false },
  { id: "c", name: "Melaka River", isVisited: true },
];

test("map filter toggles and derives one visible collection without treating unknown visits as unvisited", () => {
  assert.equal(getNextExplorationMapFilter("all", "visited"), "visited");
  assert.equal(getNextExplorationMapFilter("visited", "visited"), "all");
  assert.equal(getNextExplorationMapFilter("visited", "unvisited"), "unvisited");
  assert.deepEqual(createVisibleAttractions(attractions, "visited").map((item) => item.id), ["a", "c"]);
  assert.deepEqual(createVisibleAttractions(attractions, "unvisited").map((item) => item.id), ["b"]);
  assert.deepEqual(createVisibleAttractions([{ id: "unknown", isVisited: null }], "unvisited"), []);
  assert.equal(getExplorationMapFilterCountLabel(1, "visited"), "1 visited attraction");
  assert.equal(getExplorationMapFilterCountLabel(2, "unvisited"), "2 not visited attractions");
});

test("visited list newest and oldest sorts use full verification timestamps, including different times on the same date", () => {
  const attractionsWithTimes = [
    { id: "late", name: "Late", latestVerifiedAt: "2026-08-23T09:08:00.000Z" },
    { id: "early", name: "Early", latestVerifiedAt: "2026-08-23T01:05:00.000Z" },
    { id: "older", name: "Older", latestVerifiedAt: "2026-08-22T23:59:00.000Z" },
  ];

  assert.deepEqual(
    sortVisitedAttractions(
      attractionsWithTimes,
      VISITED_ATTRACTIONS_SORT.MOST_RECENT
    ).map((item) => item.id),
    ["late", "early", "older"]
  );
  assert.deepEqual(
    sortVisitedAttractions(
      attractionsWithTimes,
      VISITED_ATTRACTIONS_SORT.OLDEST
    ).map((item) => item.id),
    ["older", "early", "late"]
  );
});

test("legacy timestamps sort after valid verification times and keep the existing stable name and ID fallback", () => {
  const sorted = sortVisitedAttractions([
    { id: "same-b", name: "Same", latestVisitedDate: "2026-08-23" },
    { id: "verified", name: "Verified", latestVerifiedAt: "2026-08-01T00:00:00.000Z" },
    { id: "same-a", name: "Same", latestVerifiedAt: "invalid", latestVisitedDate: "2026-08-24" },
    { id: "missing", name: "Alpha", latestVisitedDate: null },
  ], VISITED_ATTRACTIONS_SORT.MOST_RECENT);

  assert.deepEqual(
    sorted.map((item) => item.id),
    ["verified", "missing", "same-a", "same-b"]
  );
});

test("verification presentation formats ISO timestamps in Malaysia time with EN, Chinese, and BM labels", () => {
  const attraction = {
    latestVisitedDate: "2026-08-23",
    latestVerifiedAt: "2026-08-23T09:08:00.000Z",
  };

  assert.deepEqual(createVisitedVerificationPresentation(attraction, "en"), {
    label: "Last verified",
    value: "23 Aug 2026, 5:08 PM",
    timeUnavailable: false,
    timeUnavailableLabel: "Time unavailable",
  });
  assert.deepEqual(createVisitedVerificationPresentation(attraction, "zh"), {
    label: "最后验证",
    value: "2026年8月23日 17:08",
    timeUnavailable: false,
    timeUnavailableLabel: "时间不可用",
  });
  assert.deepEqual(createVisitedVerificationPresentation(attraction, "ms"), {
    label: "Terakhir disahkan",
    value: "23 Ogos 2026 pada 17:08",
    timeUnavailable: false,
    timeUnavailableLabel: "Masa tidak tersedia",
  });
});

test("legacy verification presentation retains the visit date and reports unavailable time", () => {
  assert.deepEqual(
    createVisitedVerificationPresentation(
      { latestVisitedDate: "2026-08-23", latestVerifiedAt: "invalid" },
      "zh"
    ),
    {
      label: "最后验证",
      value: "2026-08-23",
      timeUnavailable: true,
      timeUnavailableLabel: "时间不可用",
    }
  );
});

test("visited sorting copy follows EN, Chinese, and BM language settings", () => {
  assert.deepEqual(getVisitedAttractionsCopy("en"), {
    sortBy: "Sort by",
    mostRecent: "Most recently verified",
    oldest: "Oldest verified",
    nameAsc: "Name A–Z",
  });
  assert.deepEqual(getVisitedAttractionsCopy("zh"), {
    sortBy: "排序方式",
    mostRecent: "最近验证",
    oldest: "最早验证",
    nameAsc: "名称 A–Z",
  });
  assert.deepEqual(getVisitedAttractionsCopy("ms"), {
    sortBy: "Susun mengikut",
    mostRecent: "Paling baru disahkan",
    oldest: "Paling awal disahkan",
    nameAsc: "Nama A–Z",
  });
});

test("visited list paginates after sorting and clamps pages to a valid range", () => {
  const sorted = Array.from({ length: 12 }, (_, index) => ({ id: String(index + 1) }));
  const first = paginateVisitedAttractions(sorted, 0);
  const last = paginateVisitedAttractions(sorted, 99);
  assert.deepEqual(first.items.map((item) => item.id), ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
  assert.equal(first.page, 1);
  assert.deepEqual(last.items.map((item) => item.id), ["11", "12"]);
  assert.equal(last.page, 2);
});
