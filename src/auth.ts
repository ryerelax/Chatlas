import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import {
  getSessionUserProfile,
  provisionGoogleUser,
} from "@/business/services/userService";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  pages: {
    signIn: "/login",
  },
  secret: process.env.AUTH_SECRET,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;

      try {
        await connectToDatabase();
        await provisionGoogleUser({
          name: user.name,
          email: user.email,
          image: user.image,
          googleId: profile?.sub,
        });
        return true;
      } catch (error) {
        console.error("Unable to provision the signed-in user.", error);
        return false;
      }
    },
    async session({ session, token }) {
      session.user.id = token.sub;

      try {
        await connectToDatabase();
        const profile = await getSessionUserProfile(token.sub);

        if (profile) {
          session.user.image = profile.image || session.user.image;
          session.user.name = profile.name;
          session.user.displayName = profile.displayName;
          session.user.bio = profile.bio;
          session.user.location = profile.location;
        }
      } catch (error) {
        console.error("Unable to enrich the user session.", error);
      }

      return session;
    },
  },
});
