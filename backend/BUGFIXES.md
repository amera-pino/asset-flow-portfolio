# Bug Fixes

バックエンドで行った小さめの不具合修正を、人がざっと追いやすい形で残すメモです。
厳密な差分は Git 履歴を参照し、このファイルには原因と対応の要点だけを簡潔に残します。

## Template

```md
## YYYY-MM-DD

### 修正タイトル
- 対象: `path/to/file.py`
- 症状: 何が起きていたか
- 原因: なぜ起きていたか
- 対応: どう直したか
- 補足: 必要なら追加メモ
```

## 2026-07-02

### SQLAlchemy モデルの前方参照型でエディタに赤線が出る
- 対象: `backend/app/models/asset.py`, `backend/app/models/asset_request.py`
- 症状: VS Code 上で `Asset` / `AssetRequest` の型参照に赤線が表示される
- 原因: `Mapped["Asset"]` と `Mapped[list["AssetRequest"]]` の前方参照が、静的解析時に名前解決できていなかった
- 対応: `TYPE_CHECKING` を使った型専用 import を追加した
- 補足: 実行時の SQLAlchemy `relationship(...)` 自体の不具合ではなく、Pylance などの静的解析上の警告だった
