// 从 auth.config.ts 导入，而不是从 auth.ts
import { auth } from "@/auth.config";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === "/login";
  const isApiRoute = req.nextUrl.pathname.startsWith("/api");
  const isPublicPage =
    req.nextUrl.pathname === "/" ||
    req.nextUrl.pathname === "/offline" ||
    req.nextUrl.pathname === "/sw.js" ||
    req.nextUrl.pathname === "/manifest.webmanifest" ||
    req.nextUrl.pathname.startsWith("/attractions/") ||
    req.nextUrl.pathname === "/profiles" ||
    req.nextUrl.pathname.startsWith("/profiles/");

  if (isApiRoute || isPublicPage) {
    return NextResponse.next();
  }

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
