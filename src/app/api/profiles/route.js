import { auth } from "@/auth";
import { getPublicProfiles } from "@/business/services/userService";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { createProfilesHandler } from "./handler.js";

export const GET = createProfilesHandler({
  authenticate: auth,
  connectToDatabase,
  getPublicProfiles,
});
