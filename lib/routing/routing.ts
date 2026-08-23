export function getPostLoginDestination(appUser: AppUser): string {
  if (appUser.role === "root_admin") return "/root-admin";

  const roles = appUser.roles ?? [];
  const isAdmin = roles.includes("restaurant_admin");
  const isManager = roles.includes("restaurant_manager");

  if (isAdmin && isManager) return "/restaurant-superadmin";
  if (isAdmin) return "/restaurant-admin";
  if (isManager) return "/restaurant-manager";

  // No special roles (including auto-created accounts that never had
  // `role: "user"` set, and demoted admins/managers) → default customer view.
  return "/menu";
}