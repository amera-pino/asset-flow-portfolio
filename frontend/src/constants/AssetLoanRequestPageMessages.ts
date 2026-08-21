export const ASSET_LOAN_REQUEST_PAGE_MESSAGES = {
  invalidAssetId: "備品IDが正しくありません。",
  requesterNameRequired: "申請者名を入力してください。",
  quantityMinimum: "申請数量は1以上で入力してください。",
  startDateMinimum: "開始日は本日以降の日付を指定してください。",
  reasonRequired: "使用目的を入力してください。",
  quantityExceedsStock: "申請数量が有効在庫数を超えています。",
  endDateMinimum: "終了日は開始日以降の日付を指定してください。",
  endDateMaximum: (deadlineLabel: string) =>
    `終了日は本日から6ヶ月後以内（${deadlineLabel}まで）で指定してください。`,
  invalidFormSubmission: "申請内容を確認してください。",
  reasonPlaceholder: "利用目的や貸出が必要な背景を入力",
  submitting: "申請中...",
} as const;
