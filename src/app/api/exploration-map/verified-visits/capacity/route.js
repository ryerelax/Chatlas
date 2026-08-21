import { auth } from "@/auth";
import {
  getVerifiedVisitPhotoCapacity,
  VerifiedVisitServiceError,
} from "@/business/services/verifiedVisitService";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { createVerifiedVisitPhotoCapacityHandler } from "./handler.js";

export const runtime = "nodejs";

export const GET = createVerifiedVisitPhotoCapacityHandler({
  auth,
  connectToDatabase,
  getVerifiedVisitPhotoCapacity,
  ServiceError: VerifiedVisitServiceError,
});
