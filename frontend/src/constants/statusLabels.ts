export const ASSET_STATUS_LABELS = {
  available: "貸出可能",
} as const;

export const REQUEST_STATUS_LABELS = {
  pending: "承認待ち",
  approved: "承認済み",
  loaned: "貸出中",
  rejected: "承認却下",
  returned: "返却済み",
  cancelled: "キャンセル済み",
} as const;

export function getAssetStatusLabel(status: string) {
  return ASSET_STATUS_LABELS[status as keyof typeof ASSET_STATUS_LABELS] ?? status;
}

export function getRequestStatusLabel(status: string) {
  return REQUEST_STATUS_LABELS[status as keyof typeof REQUEST_STATUS_LABELS] ?? status;
}
