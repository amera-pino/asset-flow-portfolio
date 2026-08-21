// カテゴリ一覧APIのHTTPエラー応答で表示するメッセージ
export const ERROR_500_CATEGORY_LIST_FETCH_FAILED =
  "サーバーエラーのため、カテゴリ一覧の取得に失敗しました。";
export const ERROR_503_CATEGORY_LIST_SERVICE_UNAVAILABLE =
  "サービスが一時的に利用できないため、カテゴリ一覧の取得に失敗しました。";
export const ERROR_504_CATEGORY_LIST_GATEWAY_TIMEOUT =
  "タイムアウトが発生したため、カテゴリ一覧の取得に失敗しました。";

// 備品一覧APIのHTTPエラー応答で表示するメッセージ
export const ERROR_500_ASSET_LIST_FETCH_FAILED =
  "サーバーエラーのため、備品一覧の取得に失敗しました。";
export const ERROR_503_ASSET_LIST_SERVICE_UNAVAILABLE =
  "サービスが一時的に利用できないため、備品一覧の取得に失敗しました。";
export const ERROR_504_ASSET_LIST_GATEWAY_TIMEOUT =
  "タイムアウトが発生したため、備品一覧の取得に失敗しました。";

// 備品一覧画面で、ApiResponseError ではない想定外例外を拾った場合の救済メッセージ
export const ERROR_UNEXPECTED_CATEGORY_LIST_FETCH =
  "予期しないエラーが発生したため、カテゴリ一覧の取得に失敗しました。";
export const ERROR_UNEXPECTED_ASSET_LIST_FETCH =
  "予期しないエラーが発生したため、備品一覧の取得に失敗しました。";

// 備品貸出申請画面で表示するメッセージ
export const ERROR_ASSET_LOAN_REQUEST_RELOAD_GUIDANCE =
  "備品貸出申請画面を再読み込みするか、備品一覧画面に戻ってください。";
export const ERROR_ASSET_LOAN_REQUEST_RESELECT_GUIDANCE =
  "備品一覧画面から対象備品を選び直してください。";
export const ERROR_500_ASSET_DETAIL_FETCH_FAILED =
  "サーバーエラーのため、備品情報の取得に失敗しました。";
export const ERROR_503_ASSET_DETAIL_FETCH_FAILED =
  "サービスが一時的に利用できないため、備品情報の取得に失敗しました。";
export const ERROR_504_ASSET_DETAIL_FETCH_FAILED =
  "タイムアウトが発生したため、備品情報の取得に失敗しました。";
export const ERROR_UNEXPECTED_ASSET_DETAIL_FETCH =
  "予期しないエラーが発生したため、備品情報の取得に失敗しました。";
export const ERROR_ASSET_DETAIL_API_RESPONSE_READ_FAILED =
  "備品情報データの読み込みに失敗しました。";
export const ERROR_INVALID_ASSET_ID = "URL の備品IDが正しくありません。";
export const ERROR_ASSET_NOT_FOUND = "指定された備品が見つかりません。";
export const ERROR_500_LOAN_REQUEST_SUBMIT_FAILED =
  "サーバーエラーのため、備品貸出申請の送信に失敗しました。";
export const ERROR_503_LOAN_REQUEST_SUBMIT_FAILED =
  "サービスが一時的に利用できないため、備品貸出申請の送信に失敗しました。";
export const ERROR_504_LOAN_REQUEST_SUBMIT_FAILED =
  "タイムアウトが発生したため、備品貸出申請の送信に失敗しました。";
export const ERROR_LOAN_REQUEST_SUBMIT_API_RESPONSE_READ_FAILED =
  "備品貸出申請結果データの読み込みに失敗しました。";
export const ERROR_UNEXPECTED_LOAN_REQUEST_SUBMIT =
  "予期しないエラーが発生したため、備品貸出申請の送信に失敗しました。";

// マイ貸出状況画面で表示するメッセージ
export const ERROR_ACTIVE_REQUESTS_API_RESPONSE_READ_FAILED =
  "貸出状況データの読み込みに失敗しました。";
export const ERROR_500_ACTIVE_REQUESTS_FETCH_FAILED =
  "サーバーエラーのため、貸出状況の取得に失敗しました。";
export const ERROR_500_ADMIN_SUMMARY_FETCH_FAILED =
  "サーバーエラーのため、管理者サマリーの取得に失敗しました。";
export const ERROR_ACTIVE_REQUESTS_FETCH_FAILED =
  "貸出状況の取得に失敗しました。";
export const ERROR_UNEXPECTED_ACTIVE_REQUESTS_FETCH =
  "予期しないエラーが発生したため、貸出状況の取得に失敗しました。";
export const ERROR_503_ACTIVE_REQUESTS_FETCH_FAILED =
  "サービスが一時的に利用できないため、貸出状況の取得に失敗しました。";
export const ERROR_504_ACTIVE_REQUESTS_FETCH_FAILED =
  "タイムアウトが発生したため、貸出状況の取得に失敗しました。";
export const ERROR_MY_LOAN_REQUEST_RELOAD_GUIDANCE =
  "貸出状況を再読み込みしてください。";
export const ERROR_START_LOAN_REQUEST_API_RESPONSE_READ_FAILED =
  "貸出開始結果データの読み込みに失敗しました。";
export const ERROR_START_LOAN_REQUEST_RELOAD_GUIDANCE =
  ERROR_MY_LOAN_REQUEST_RELOAD_GUIDANCE;
export const ERROR_500_START_LOAN_REQUEST_FAILED =
  "サーバーエラーのため、貸出開始に失敗しました。";
export const ERROR_UNEXPECTED_START_LOAN_REQUEST =
  "予期しないエラーが発生したため、貸出開始に失敗しました。";
export const ERROR_503_START_LOAN_REQUEST_FAILED =
  "サービスが一時的に利用できないため、貸出開始に失敗しました。";
export const ERROR_504_START_LOAN_REQUEST_FAILED =
  "タイムアウトが発生したため、貸出開始に失敗しました。";
export const ERROR_RETURN_REQUEST_API_RESPONSE_READ_FAILED =
  "返却結果データの読み込みに失敗しました。";
export const ERROR_RETURN_REQUEST_RELOAD_GUIDANCE =
  ERROR_MY_LOAN_REQUEST_RELOAD_GUIDANCE;
export const ERROR_500_RETURN_REQUEST_FAILED =
  "サーバーエラーのため、返却処理に失敗しました。";
export const ERROR_UNEXPECTED_RETURN_REQUEST =
  "予期しないエラーが発生したため、返却処理に失敗しました。";
export const ERROR_503_RETURN_REQUEST_FAILED =
  "サービスが一時的に利用できないため、返却処理に失敗しました。";
export const ERROR_504_RETURN_REQUEST_FAILED =
  "タイムアウトが発生したため、返却処理に失敗しました。";
export const ERROR_CANCEL_REQUEST_API_RESPONSE_READ_FAILED =
  "申請キャンセル結果データの読み込みに失敗しました。";
export const ERROR_CANCEL_REQUEST_RELOAD_GUIDANCE =
  ERROR_MY_LOAN_REQUEST_RELOAD_GUIDANCE;
export const ERROR_500_CANCEL_REQUEST_FAILED =
  "サーバーエラーのため、申請キャンセルに失敗しました。";
export const ERROR_UNEXPECTED_CANCEL_REQUEST =
  "予期しないエラーが発生したため、申請キャンセルに失敗しました。";
export const ERROR_503_CANCEL_REQUEST_FAILED =
  "サービスが一時的に利用できないため、申請キャンセルに失敗しました。";
export const ERROR_504_CANCEL_REQUEST_FAILED =
  "タイムアウトが発生したため、申請キャンセルに失敗しました。";
export const ERROR_RETURN_REQUEST_FAILED = "返却処理に失敗しました。";
export const ERROR_CANCEL_REQUEST_FAILED = "キャンセル処理に失敗しました。";

// APIレスポンス共通処理で表示するメッセージ
export const ERROR_API_RESPONSE_READ_FAILED =
  "APIレスポンスの読み込みに失敗しました。";
export const ERROR_API_REQUEST_FAILED = "APIリクエストに失敗しました。";
