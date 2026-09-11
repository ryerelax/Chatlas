import { auth } from "@/auth";
import {
  getTravelHistory,
  TravelHistoryServiceError,
} from "@/business/services/travelHistoryService";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { createTravelHistoryHandler } from "./handler.js";

export const runtime = "nodejs";

export const GET = createTravelHistoryHandler({
  authenticate: auth,
  connectToDatabase,
  getTravelHistory,
  ServiceError: TravelHistoryServiceError,
});
