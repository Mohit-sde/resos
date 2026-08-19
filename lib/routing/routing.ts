// e.g. src/lib/routing.ts
export function getPostLoginDestination(appUser: AppUser): string {
  if (appUser.role === "root_admin") return "/root-admin";
  if (appUser.role === "user") return "/menu";

  const roles = appUser.roles ?? [];
  const isAdmin = roles.includes("restaurant_admin");
  const isManager = roles.includes("restaurant_manager");

  if (isAdmin && isManager) return "/restaurant-superadmin";
  if (isAdmin) return "/restaurant-admin";
  if (isManager) return "/restaurant-manager";
  return "/login";
}