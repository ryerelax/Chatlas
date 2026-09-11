import { auth } from "@/auth";
import {
  getMyReviews,
  MyReviewsServiceError,
} from "@/business/services/myReviewsService";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { createMyReviewsHandler } from "./handler.js";

export const runtime = "nodejs";

export const GET = createMyReviewsHandler({
  authenticate: auth,
  connectToDatabase,
  getMyReviews,
  ServiceError: MyReviewsServiceError,
});
