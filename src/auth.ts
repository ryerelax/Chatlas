import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { createAuthIdentityService } from "@/business/services/authIdentityService";
import {
  createUser,
  findGoogleIdentityByEmail,
  findUserByGoogleId,
  updateUserByGoogleId,
} from "@/data/repositories/userRepository";
import { connectToDatabase } from "@/infrastructure/database/mongodb";

const authIdentityService = createAuthIdentityService({
  connectToDatabase,
  findGoogleIdentityByEmail,
  findUserByGoogleId,
  createUser,
  updateUserByGoogleId,
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  pages: {
    signIn: "/login",
  },
  secret: process.env.AUTH_SECRET,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        try {
          await authIdentityService.persistGoogleSignIn({ user, account });
          return true;
        } catch {
          console.error("Unable to save the signed-in Google user.");
          return false;
        }
      }
      return true;
    },
    async jwt({ token, account }) {
      return authIdentityService.addGoogleSubjectToToken({ token, account });
    },
    async session({ session, token }) {
      try {
        await authIdentityService.applyGoogleSubjectToSession({ session, token });

        const googleId = session?.user?.id;
        if (!googleId) return session;

        await connectToDatabase();
        const user = await findUserByGoogleId(googleId);
        if (user) {
          session.user.image = user.profilePicture || session.user.image;
          session.user.name = user.displayName || user.name;
          session.user.displayName = user.displayName || user.name;
          session.user.bio = user.bio || "";
          session.user.location = user.location || "";
        }
      } catch {
        console.error("Unable to load the signed-in user profile.");
      }

      return session;
    },
  },
});
