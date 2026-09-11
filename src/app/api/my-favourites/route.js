import { auth } from "@/auth";
import {
  getMyFavourites,
  MyFavouritesServiceError,
} from "@/business/services/myFavouritesService";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { createMyFavouritesHandler } from "./handler.js";

export const runtime = "nodejs";

export const GET = createMyFavouritesHandler({
  authenticate: auth,
  connectToDatabase,
  getMyFavourites,
  ServiceError: MyFavouritesServiceError,
});
