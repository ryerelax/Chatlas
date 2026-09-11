import { auth } from "@/auth";
import {
  getMyPhotos,
  MyPhotosServiceError,
} from "@/business/services/myPhotosService";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { createMyPhotosHandler } from "./handler.js";

export const runtime = "nodejs";

export const GET = createMyPhotosHandler({
  authenticate: auth,
  connectToDatabase,
  getMyPhotos,
  ServiceError: MyPhotosServiceError,
});
