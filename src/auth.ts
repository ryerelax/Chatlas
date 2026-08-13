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
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        try {
          await connectToDatabase();

          const existingUser = await User.findOne({ email: user.email });

          if (!existingUser) {
            // ✅ 新用户：保存 Google 头像和 googleId
            await User.create({
              name: user.name,
              email: user.email,
              profilePicture: user.image,
              googleId: profile?.sub,
              displayName: user.name || "",
              bio: "",
              location: "",
            });
            console.log("✅ New user saved to database");
          } else {
            // ✅ 已有用户：更新 name，并确保 googleId 存在
            await User.updateOne(
              { email: user.email },
              {
                name: user.name,
                googleId: profile?.sub,  // ← 关键修复：同步 googleId
              }
            );
            console.log("✅ Existing user updated (name and googleId synced)");
          }
          return true;
        } catch (error) {
          console.error("❌ Error saving user to database:", error);
          return false;
        }
      }
      return true;
    },
    async session({ session, token }) {
      session.user.id = token.sub;

      try {
        await connectToDatabase();
        const user = await User.findOne({ googleId: token.sub });
        if (user) {
          // ✅ 优先使用数据库中的 profilePicture
          session.user.image = user.profilePicture || session.user.image;
          session.user.name = user.displayName || user.name;
          session.user.displayName = user.displayName || user.name;
          session.user.bio = user.bio || "";
          session.user.location = user.location || "";
        }
      } catch (error) {
        console.error("❌ Error fetching user from database:", error);
      }

      return session;
    },
  },
});