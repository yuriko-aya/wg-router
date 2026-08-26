export const Role = {
  USER: "USER",
  ADMIN: "ADMIN",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export function isAdminRole(role: string | undefined): boolean {
  return role === Role.ADMIN;
}
