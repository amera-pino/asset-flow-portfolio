export const API_PATHS = {
  // ログインAPI
  login: "/api/auth/login",

  // ログイン中ユーザー取得API
  me: "/api/auth/me",

  // ログアウトAPI
  logout: "/api/auth/logout",

  // 備品カテゴリ取得API
  assetCategories: "/api/assets/categories",

  // 備品情報取得API
  assetDetail: (assetId: number) => `/api/assets/${assetId}`,

  // 備品一覧取得API
  assetList: "/api/assets",

  // 備品登録API
  assetRegistration: "/api/assets",

  // 申請キャンセルAPI
  cancelLoanRequest: (requestId: number) => `/api/requests/${requestId}/cancel`,

  // 申請登録API
  loanRequestRegistration: "/api/requests",

  // 貸出状況取得API
  myLoanRequests: "/api/requests/me/active",

  // 貸出開始API
  startLoanRequest: (requestId: number) => `/api/requests/${requestId}/start-loan`,

  // 返却登録API
  returnLoanRequest: (requestId: number) => `/api/requests/${requestId}/return`,

  // 管理者ホームサマリー取得API
  adminSummary: "/api/admin/summary",

  // 管理者向け申請一覧取得API
  adminActiveRequests: "/api/admin/requests/active",

  // 管理者向け申請承認API
  adminApproveRequest: (requestId: number) => `/api/admin/requests/${requestId}/approve`,

  // 管理者向け申請却下API
  adminRejectRequest: (requestId: number) => `/api/admin/requests/${requestId}/reject`,

  // 管理者向け強制返却API
  adminForceReturnRequest: (requestId: number) => `/api/admin/requests/${requestId}/force-return`,

  // 管理者向けユーザー一覧取得API
  adminUsers: "/api/admin/users",

  // 管理者向けユーザー登録API
  adminUserRegistration: "/api/admin/users",

  // 管理者向けユーザー削除API
  adminUserDeletion: (userId: number) => `/api/admin/users/${userId}`,
} as const;
