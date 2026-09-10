import { auth } from "@/auth";
import {
  deleteOwnedVerifiedPhoto,
  VerifiedVisitServiceError,
} from "@/business/services/verifiedVisitService";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { createDeleteVerifiedPhotoHandler } from "./handler.js";

export const runtime = "nodejs";

export const DELETE = createDeleteVerifiedPhotoHandler({
  auth,
  connectToDatabase,
  deleteOwnedVerifiedPhoto,
  ServiceError: VerifiedVisitServiceError,
});
