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
    /**
     * 登录时：确保 User 表里一定有正确的 googleId（Google 的真实 sub）
     */
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;

      try {
        await connectToDatabase();

        // Google 真实 ID（数字字符串），绝对不要用 NextAuth 自己生成的 UUID
        const googleId = profile?.sub || account.providerAccountId;
        if (!googleId) {
          console.error("❌ No googleId from Google profile");
          return false;
        }

        const existingUser = await User.findOne({
          $or: [{ googleId }, { email: user.email }],
        });

        if (!existingUser) {
          // 新用户
          await User.create({
            name: user.name || "",
            email: user.email,
            profilePicture: user.image || "",
            googleId,
            displayName: user.name || "",
            bio: "",
            location: "",
          });
          console.log("✅ New user created with googleId:", googleId);
        } else {
          // 已有用户：强制同步 googleId，防止旧数据是错的
          await User.updateOne(
            { _id: existingUser._id },
            {
              $set: {
                name: user.name || existingUser.name,
                googleId, // 关键：永远用真实 Google sub
              },
            }
          );
          console.log("✅ Existing user googleId synced:", googleId);
        }

        return true;
      } catch (error) {
        console.error("❌ Error in signIn callback:", error);
        return false;
      }
    },

    /**
     * JWT callback（必须有！）
     * - 第一次登录：把 googleId 写进 token
     * - 客户端调用 update()：把新头像/名字/location 写进 token
     * - 每次请求：尽量从 DB 拉最新数据
     */
    async jwt({ token, user, account, profile, trigger, session }) {
      // ---------- 第一次登录 ----------
      if (account && profile) {
        const googleId = profile.sub || account.providerAccountId;
        token.googleId = googleId;
        token.email = user?.email || token.email;
      }

      // ---------- 客户端调用 update() 时 ----------
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

      // ---------- 每次都从 DB 补最新资料（容错：googleId 或 email） ----------
      try {
        await connectToDatabase();

        const dbUser = await User.findOne({
          $or: [
            { googleId: token.googleId || token.sub },
            { email: token.email },
          ],
        });

        if (dbUser) {
          // 统一用真实 googleId，避免 UUID 问题
          token.sub = dbUser.googleId;
          token.googleId = dbUser.googleId;
          token.userId = dbUser._id.toString(); // MongoDB _id，给其他模块用
          token.name = dbUser.displayName || dbUser.name || token.name;
          token.picture = dbUser.profilePicture || token.picture || "";
          token.bio = dbUser.bio || "";
          token.location = dbUser.location || "";
          token.email = dbUser.email || token.email;
        }
      } catch (err) {
        console.error("❌ jwt callback DB error:", err);
      }

      return token;
    },

    /**
     * Session callback：把 token 里的字段暴露给前端和其它模块
     */
    async session({ session, token }) {
      if (session.user) {
        // 稳定 id：优先 MongoDB _id，其次 googleId
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