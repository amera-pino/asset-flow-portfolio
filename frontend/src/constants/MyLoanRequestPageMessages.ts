export const MY_LOAN_REQUEST_PAGE_MESSAGES = {
  emptyInitialState: "現在、あなたが借りている備品はありません。",
  emptySearchResult: "検索条件に一致する申請はありません。",
  startLoanAccepted: (requestId: string) =>
    `貸出開始を受け付けました。申請ID：${requestId}`,
  returnAccepted: (requestId: string) =>
    `返却を受け付けました。申請ID：${requestId}`,
  cancelAccepted: (requestId: string) =>
    `キャンセルを受け付けました。申請ID：${requestId}`,
  startLoanConfirmTitle: "貸出開始確認",
  returnConfirmTitle: "返却確認",
  cancelConfirmTitle: "キャンセル確認",
  startLoanConfirmMessage: "この備品の貸出を開始してもよろしいですか？",
  returnConfirmMessage: "この備品を返却してもよろしいですか？",
  cancelConfirmMessage: "この申請をキャンセルしてもよろしいですか？",
} as const;
