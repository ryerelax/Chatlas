import { auth } from "@/auth";
import {
  getMyWishlist,
  MyWishlistServiceError,
} from "@/business/services/myWishlistService";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { createMyWishlistHandler } from "./handler.js";

export const runtime = "nodejs";

export const GET = createMyWishlistHandler({
  authenticate: auth,
  connectToDatabase,
  getMyWishlist,
  ServiceError: MyWishlistServiceError,
});
