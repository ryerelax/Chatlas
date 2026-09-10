import { auth } from "@/auth";
import {
  getPublicVerifiedPhotos,
  VerifiedVisitServiceError,
} from "@/business/services/verifiedVisitService";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { createPublicVerifiedPhotosHandler } from "./handler.js";

export const runtime = "nodejs";

export const GET = createPublicVerifiedPhotosHandler({
  auth,
  connectToDatabase,
  getPublicVerifiedPhotos,
  ServiceError: VerifiedVisitServiceError,
});
