import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public routes that don't need auth
const PUBLIC_ROUTES = ["/login"];

// Route prefixes that map to roles
const ROLE_ROUTES: Record<string, string[]> = {
  "/root-admin": ["root_admin"],
  "/restaurant-admin": ["restaurant_admin"],
  "/restaurant-manager": ["restaurant_manager"],
  "/menu": ["customer"],
  "/cart": ["customer"],
  "/orders": ["customer"],
  "/queries": ["customer"],
  "/profile": ["customer"],
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // For protected routes, client-side auth handles redirection
  // Middleware here just ensures basic cookie presence
  // Full role enforcement is done in each page via useAuth hook
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api).*)",
  ],
};
