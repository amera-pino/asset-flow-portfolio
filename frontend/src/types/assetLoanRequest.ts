// 備品貸出申請画面から POST /api/requests へ送る入力データ
export type AssetLoanRequestCreate = {
  asset_id: number;
  requester_name: string;
  start_date: string;
  end_date: string;
  reason: string;
  quantity: number;
};

// 申請作成・返却・キャンセル API から返る貸出申請データ
export type AssetLoanRequest = AssetLoanRequestCreate & {
  id: number;
  user_id: number;
  status: "pending" | "approved" | "loaned" | "rejected" | "returned" | "cancelled";
  returned_at: string | null;
  created_at: string;
  updated_at: string;
};

// マイ貸出状況画面で備品名・カテゴリ付きで表示する申請データ
export type ActiveAssetLoanRequest = AssetLoanRequest & {
  asset_name: string;
  asset_category: string;
};
