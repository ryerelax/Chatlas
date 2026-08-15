import assert from "node:assert/strict";
import test from "node:test";
import {
  createExplorationMapAttractionsRepository,
} from "../src/data/repositories/attractionRepository.js";
import {
  createExplorationMapService,
} from "../src/business/services/explorationMapAttractionService.js";
import {
  createExplorationMapAttractionsHandler,
} from "../src/app/api/exploration-map/attractions/handler.js";
import {
  createAttractionService,
} from "../src/business/services/attractionService.js";

test("map repository returns every active Melaka attraction with only map fields", async () => {
  const records = [{ _id: "one" }, { _id: "two" }];
  const observed = {};
  const repository = createExplorationMapAttractionsRepository({
    find(query) {
      observed.query = query;
      return {
        select(fields) {
          observed.fields = fields;
          return this;
        },
        sort(sort) {
          observed.sort = sort;
          return this;
        },
        lean() {
          return records;
        },
      };
    },
  });

  const result = await repository.findAllActiveMelakaMapAttractions();

  assert.deepEqual(result, records);
  assert.deepEqual(observed.query, { state: "Melaka", isActive: true });
  assert.equal(
    observed.fields,
    "_id name address latitude longitude category rating totalReviews businessStatus"
  );
  assert.deepEqual(observed.sort, { name: 1, _id: 1 });
});

test("map service preserves a complete attraction result without pagination", async () => {
  const allMapAttractions = Array.from({ length: 16 }, (_, index) => ({
    _id: `attraction-${index + 1}`,
  }));
  const service = createExplorationMapService({
    findAllActiveMelakaMapAttractions: async () => allMapAttractions,
  });

  const result = await service.getExplorationMapAttractions();

  assert.deepEqual(result, allMapAttractions);
  assert.equal(result.length, 16);
});

test("attraction explorer pagination stays independent while map service keeps all records", async () => {
  const explorerRepositoryCalls = [];
  const explorerService = createAttractionService({
    findAttractions: async (options) => {
      explorerRepositoryCalls.push(options);
      return {
        items: [{ _id: "attraction-31" }],
        total: 31,
      };
    },
    findAttractionById: async () => null,
    isValidObjectId: () => true,
  });
  const mapRecords = Array.from({ length: 31 }, (_, index) => ({
    _id: `attraction-${index + 1}`,
  }));
  const mapService = createExplorationMapService({
    findAllActiveMelakaMapAttractions: async () => mapRecords,
  });

  const [explorerResult, mapResult] = await Promise.all([
    explorerService.getAttractions({ page: 3 }),
    mapService.getExplorationMapAttractions(),
  ]);

  assert.deepEqual(explorerResult.items, [{ _id: "attraction-31" }]);
  assert.equal(explorerResult.totalPages, 3);
  assert.deepEqual(explorerRepositoryCalls, [
    {
      search: "",
      category: "",
      locationArea: "",
      minRating: 0,
      page: 3,
      limit: 15,
    },
  ]);
  assert.equal(mapResult.length, 31);
  assert.equal(mapResult.at(-1)._id, "attraction-31");
});

test("map route returns the full service result and count", async () => {
  const mapAttractions = Array.from({ length: 16 }, (_, index) => ({
    _id: `attraction-${index + 1}`,
  }));
  let connected = false;
  const handler = createExplorationMapAttractionsHandler({
    connectToDatabase: async () => {
      connected = true;
    },
    getExplorationMapAttractions: async () => mapAttractions,
  });

  const response = await handler();

  assert.equal(connected, true);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    count: 16,
    data: mapAttractions,
  });
});

test("map route returns a safe error when its data service fails", async () => {
  const handler = createExplorationMapAttractionsHandler({
    connectToDatabase: async () => {},
    getExplorationMapAttractions: async () => {
      throw new Error("database connection details");
    },
  });

  const response = await handler();

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    success: false,
    message: "Failed to retrieve map attractions.",
  });
});
