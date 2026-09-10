import { DefaultSession } from "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      googleId?: string;
      displayName?: string | null;
      bio?: string;
      location?: string;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    googleId?: string;
    displayName?: string | null;
    bio?: string;
    location?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    googleId?: string;
    userId?: string;
    bio?: string;
    location?: string;
    picture?: string;
  }
}