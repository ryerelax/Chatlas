import { auth } from "@/auth";
import {
  getVerifiedAttractionIdsForUser,
  getVerifiedAttractionsForUser,
  VerifiedVisitServiceError,
  verifyVisitPhoto,
} from "@/business/services/verifiedVisitService";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { createVerifiedVisitsHandlers } from "./handler.js";

export const runtime = "nodejs";

const handlers = createVerifiedVisitsHandlers({
  auth,
  connectToDatabase,
  getVerifiedAttractionIdsForUser,
  getVerifiedAttractionsForUser,
  verifyVisitPhoto,
  ServiceError: VerifiedVisitServiceError,
});

export const { GET, POST } = handlers;
