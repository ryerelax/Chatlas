// 从 auth.config.ts 导入，而不是从 auth.ts
import { auth } from "@/auth.config";
import { isPublicPagePathname } from "@/business/services/explorationMapService";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === "/login";
  const isApiRoute = req.nextUrl.pathname.startsWith("/api");
  const isPublicPage = isPublicPagePathname(req.nextUrl.pathname);

  if (isApiRoute) {
    return NextResponse.next();
  }

  if (!isLoggedIn && !isLoginPage && !isPublicPage) {
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
