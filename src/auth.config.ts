import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const authConfig = {
  providers: [Google],
  pages: {
    signIn: "/login",
  },
  secret: process.env.AUTH_SECRET,
};

// 导出轻量级的 auth 给中间件使用
export const { auth } = NextAuth(authConfig);