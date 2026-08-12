import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  pages: {
    signIn: "/login",
  },
  secret: process.env.AUTH_SECRET,
  callbacks: {
    async signIn({ user, account, profile }) {
      // TODO: Save user to database
      return true;
    },
    async session({ session, token }) {
      // Add user.id to session
      session.user.id = token.sub;
      return session;
    },
  },
});