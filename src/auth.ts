import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import {
  createAuthConfig,
  createAuthIdentityService,
} from "@/business/services/authIdentityService";
import {
  findGoogleIdentityByEmail,
  findUserByGoogleId,
  upsertUserByGoogleId,
} from "@/data/repositories/userRepository";
import { connectToDatabase } from "@/infrastructure/database/mongodb";

const authIdentityService = createAuthIdentityService({
  connectToDatabase,
  findGoogleIdentityByEmail,
  upsertUserByGoogleId,
});

const authConfig = createAuthConfig({
  providers: [Google],
  secret: process.env.AUTH_SECRET,
  authIdentityService,
  connectToDatabase,
  findUserByGoogleId,
});

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);
