import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Next.js 16: `middleware.ts` er erstattet av `proxy.ts`. Kjører i
// Node.js-runtime, så vanlig JWT-verifisering via Auth.js fungerer direkte.
//
// Privat plattform: ALT krever innlogging som standard. Kun de eksplisitte
// unntakene under er offentlige.
const PUBLIC_PREFIXES = ["/logg-inn", "/registrer", "/api/auth", "/api/health"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
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
