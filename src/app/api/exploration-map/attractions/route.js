import { getExplorationMapAttractions } from "@/business/services/explorationMapAttractionService";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { createExplorationMapAttractionsHandler } from "./handler.js";

export const GET = createExplorationMapAttractionsHandler({
  connectToDatabase,
  getExplorationMapAttractions,
});
