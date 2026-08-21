export type AdminSummary = {
  pending_request_count: number;
  approved_request_count: number;
  rejected_request_count: number;
  loaned_request_count: number;
  registered_asset_count: number;
  managed_user_count: number;
};

export type AdminUser = {
  id: number;
  name: string;
  login_id: string;
  role: "user" | "admin";
  department: string | null;
  state: "active";
};

export type AdminUserCreateInput = {
  name: string;
  login_id: string;
  role: "user" | "admin";
  department: string | null;
};
