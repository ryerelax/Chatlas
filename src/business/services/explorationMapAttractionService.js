import { findAllActiveMelakaMapAttractions } from "@/data/repositories/attractionRepository";

export function createExplorationMapService({
  findAllActiveMelakaMapAttractions: findMapAttractions,
}) {
  return {
    async getExplorationMapAttractions() {
      return findMapAttractions();
    },
  };
}

const explorationMapService = createExplorationMapService({
  findAllActiveMelakaMapAttractions,
});

export async function getExplorationMapAttractions() {
  return explorationMapService.getExplorationMapAttractions();
}
