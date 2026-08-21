# カテゴリ一覧APIのHTTPエラー応答で返すメッセージ
ERROR_500_CATEGORY_LIST_FETCH_FAILED = "サーバーエラーのため、カテゴリ一覧の取得に失敗しました。"
ERROR_503_CATEGORY_LIST_SERVICE_UNAVAILABLE = "サービスが一時的に利用できないため、カテゴリ一覧の取得に失敗しました。"
ERROR_504_CATEGORY_LIST_GATEWAY_TIMEOUT = "タイムアウトが発生したため、カテゴリ一覧の取得に失敗しました。"

# 備品一覧APIのHTTPエラー応答で返すメッセージ
ERROR_500_ASSET_LIST_FETCH_FAILED = "サーバーエラーのため、備品一覧の取得に失敗しました。"
ERROR_503_ASSET_LIST_SERVICE_UNAVAILABLE = "サービスが一時的に利用できないため、備品一覧の取得に失敗しました。"
ERROR_504_ASSET_LIST_GATEWAY_TIMEOUT = "タイムアウトが発生したため、備品一覧の取得に失敗しました。"

# 備品情報取得APIのHTTPエラー応答で返すメッセージ
ERROR_500_ASSET_DETAIL_FETCH_FAILED = "サーバーエラーのため、備品情報の取得に失敗しました。"
ERROR_503_ASSET_DETAIL_SERVICE_UNAVAILABLE = "サービスが一時的に利用できないため、備品情報の取得に失敗しました。"
ERROR_504_ASSET_DETAIL_GATEWAY_TIMEOUT = "タイムアウトが発生したため、備品情報の取得に失敗しました。"

# 備品登録APIのHTTPエラー応答で返すメッセージ
ERROR_500_ASSET_CREATE_FAILED = "サーバーエラーのため、備品登録に失敗しました。"

# 備品貸出申請リクエスト送信APIのHTTPエラー応答で返すメッセージ
ERROR_400_LOAN_REQUEST_BAD_REQUEST = "リクエスト内容が不正です。"
ERROR_404_LOAN_REQUEST_ASSET_NOT_FOUND = "指定された備品が見つかりません。"
ERROR_409_LOAN_REQUEST_CONFLICT = "予約満了のため、貸出申請できません。"
ERROR_422_LOAN_REQUEST_VALIDATION_ERROR = "入力内容を確認してください。"
ERROR_500_LOAN_REQUEST_SUBMIT_FAILED = "サーバーエラーのため、備品貸出申請の送信に失敗しました。"
ERROR_503_LOAN_REQUEST_SERVICE_UNAVAILABLE = "サービスが一時的に利用できないため、備品貸出申請の送信に失敗しました。"
ERROR_504_LOAN_REQUEST_GATEWAY_TIMEOUT = "タイムアウトが発生したため、備品貸出申請の送信に失敗しました。"

# マイ貸出状況APIのHTTPエラー応答で返すメッセージ
ERROR_500_ACTIVE_REQUESTS_FETCH_FAILED = "サーバーエラーのため、貸出状況の取得に失敗しました。"
ERROR_503_ACTIVE_REQUESTS_FETCH_FAILED = "サービスが一時的に利用できないため、貸出状況の取得に失敗しました。"
ERROR_504_ACTIVE_REQUESTS_FETCH_FAILED = "タイムアウトが発生したため、貸出状況の取得に失敗しました。"
ERROR_500_START_LOAN_REQUEST_FAILED = "サーバーエラーのため、貸出開始に失敗しました。"
ERROR_503_START_LOAN_REQUEST_FAILED = "サービスが一時的に利用できないため、貸出開始に失敗しました。"
ERROR_504_START_LOAN_REQUEST_FAILED = "タイムアウトが発生したため、貸出開始に失敗しました。"
ERROR_500_ADMIN_SUMMARY_FETCH_FAILED = "サーバーエラーのため、管理者サマリーの取得に失敗しました。"
ERROR_500_ADMIN_ACTIVE_REQUESTS_FETCH_FAILED = "サーバーエラーのため、管理者向け申請一覧の取得に失敗しました。"
ERROR_500_ADMIN_REQUEST_APPROVE_FAILED = "サーバーエラーのため、申請承認に失敗しました。"
ERROR_500_ADMIN_REQUEST_REJECT_FAILED = "サーバーエラーのため、申請却下に失敗しました。"
ERROR_500_ADMIN_REQUEST_FORCE_RETURN_FAILED = "サーバーエラーのため、強制返却に失敗しました。"
ERROR_500_RETURN_REQUEST_FAILED = "サーバーエラーのため、返却処理に失敗しました。"
ERROR_503_RETURN_REQUEST_FAILED = "サービスが一時的に利用できないため、返却処理に失敗しました。"
ERROR_504_RETURN_REQUEST_FAILED = "タイムアウトが発生したため、返却処理に失敗しました。"
ERROR_500_CANCEL_REQUEST_FAILED = "サーバーエラーのため、申請キャンセルに失敗しました。"
ERROR_503_CANCEL_REQUEST_FAILED = "サービスが一時的に利用できないため、申請キャンセルに失敗しました。"
ERROR_504_CANCEL_REQUEST_FAILED = "タイムアウトが発生したため、申請キャンセルに失敗しました。"

# アプリ全体の共通エラー応答で返すメッセージ
ERROR_500_INTERNAL_SERVER_ERROR = "サーバーエラーが発生しました。"
ERROR_ASSET_NOT_FOUND = "指定された備品が見つかりません。"

# 認証APIのHTTPエラー応答で返すメッセージ
ERROR_AUTH_INVALID_CREDENTIALS = "ログインIDまたはパスワードが正しくありません。"
ERROR_AUTH_UNAUTHORIZED = "ログインが必要です。"
