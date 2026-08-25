import { getPublicProfileOverview } from "@/business/services/socialProfileService";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { createPublicProfileHandler } from "./handler.js";

export const GET = createPublicProfileHandler({
  connectToDatabase,
  getPublicProfileOverview,
});
