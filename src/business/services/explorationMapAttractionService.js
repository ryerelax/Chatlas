import { findAllActiveMelakaMapAttractions } from "@/data/repositories/attractionRepository";
import { resolveVerificationRadiusMeters } from "@/business/services/visitVerificationRules";

function toPublicMapAttraction(attraction) {
  const { verificationRadiusMeters: canonicalOverride, ...publicAttraction } = attraction;

  return {
    ...publicAttraction,
    verificationRadiusMeters: resolveVerificationRadiusMeters({
      ...attraction,
      verificationRadiusMeters: canonicalOverride,
    }),
  };
}

export function createExplorationMapService({
  findAllActiveMelakaMapAttractions: findMapAttractions,
}) {
  return {
    async getExplorationMapAttractions() {
      const attractions = await findMapAttractions();
      return attractions.map(toPublicMapAttraction);
    },
  };
}

const explorationMapService = createExplorationMapService({
  findAllActiveMelakaMapAttractions,
});

export async function getExplorationMapAttractions() {
  return explorationMapService.getExplorationMapAttractions();
}
