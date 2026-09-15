import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Next.js 16: `middleware.ts` er erstattet av `proxy.ts`. Kjører alltid i
// Node.js-runtime (ikke edge), så vanlig JWT-verifisering via Auth.js
// fungerer uten videre.
const PUBLIC_PREFIXES = [
  "/logg-inn",
  "/registrer",
  "/api/auth",
  "/manifest.json",
  "/icons",
  "/sw.js",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!req.auth) {
    const loginUrl = new URL("/logg-inn", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
