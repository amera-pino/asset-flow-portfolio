export const ASSET_LIST_PAGE_MESSAGES = {
  emptySearchResult: "該当する備品が見つかりませんでした。条件を変えて検索してください。",
  loanRequestAccepted: (requestId: number) =>
    `申請を受け付けました。 申請ID: ${requestId}`,
} as const;
