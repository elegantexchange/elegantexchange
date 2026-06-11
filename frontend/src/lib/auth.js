/** @param {{ role?: string } | null | undefined} user */
export function isOwner(user) {
  return user?.role?.toLowerCase() === "owner";
}
