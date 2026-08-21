export type UserRole = "user" | "admin";

export type AuthUser = {
  id: number;
  name: string;
  loginId: string;
  role: UserRole;
};

export type LoginResponseUser = {
  id: number;
  name: string;
  login_id: string;
  role: UserRole;
  session_token?: string | null;
};
