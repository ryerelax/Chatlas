import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { connectToDatabase } from "src/infrastructure/database/mongodb.js";
import User from "src/data/models/User";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  pages: {
    signIn: "/login",
  },
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;

      try {
        await connectToDatabase();

        const googleId = profile?.sub || account.providerAccountId;
        if (!googleId) {
          console.error("No googleId was returned by the Google provider.");
          return false;
        }

        const existingUser = await User.findOne({
          $or: [{ googleId }, { email: user.email }],
        });

        if (!existingUser) {
          await User.create({
            name: user.name || "",
            email: user.email,
            profilePicture: user.image || "",
            googleId,
            displayName: user.name || "",
            bio: "",
            location: "",
          });
        } else {
          await User.updateOne(
            { _id: existingUser._id },
            {
              $set: {
                name: user.name || existingUser.name,
                googleId,
              },
            }
          );
        }

        return true;
      } catch {
        console.error("Unable to save the signed-in Google user.");
        return false;
      }
    },

    async jwt({ token, user, account, profile, trigger, session }) {
      if (account && profile) {
        const googleId = profile.sub || account.providerAccountId;
        token.googleId = googleId;
        token.email = user?.email || token.email;
      }

      if (trigger === "update" && session?.user) {
        if (session.user.image !== undefined) {
          token.picture = session.user.image;
        }
        if (session.user.displayName !== undefined) {
          token.name = session.user.displayName;
        }
        if (session.user.name !== undefined && !session.user.displayName) {
          token.name = session.user.name;
        }
        if (session.user.bio !== undefined) {
          token.bio = session.user.bio;
        }
        if (session.user.location !== undefined) {
          token.location = session.user.location;
        }
      }

      try {
        await connectToDatabase();

        const dbUser = await User.findOne({
          $or: [
            { googleId: token.googleId || token.sub },
            { email: token.email },
          ],
        });

        if (dbUser) {
          token.sub = dbUser.googleId;
          token.googleId = dbUser.googleId;
          token.userId = dbUser._id.toString();
          token.name = dbUser.displayName || dbUser.name || token.name;
          token.picture = dbUser.profilePicture || token.picture || "";
          token.bio = dbUser.bio || "";
          token.location = dbUser.location || "";
          token.email = dbUser.email || token.email;
        }
      } catch {
        console.error("Unable to load the signed-in user identity.");
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId || token.googleId || token.sub;
        session.user.googleId = token.googleId || token.sub;
        session.user.name = token.name || session.user.name;
        session.user.displayName = token.name || session.user.name;
        session.user.image = token.picture || session.user.image || "";
        session.user.bio = token.bio || "";
        session.user.location = token.location || "";
        session.user.email = token.email || session.user.email;
      }
      return session;
    },
  },
});
