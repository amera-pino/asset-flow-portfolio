# Backend API

`asset-flow` のバックエンド FastAPI アプリです。

この README では、日々の開発でよく使う起動方法と、`venv` の扱いをまとめます。

## 基本方針

- 普段の開発は **VS Code の `Open in Container`** を使う
- コンテナの中で **バックエンド用の仮想環境 `.venv`** を使う
- 全体起動はルートの `docker-compose.yml` から行う
- バックエンド単体での起動は、API や Python の動作確認をしたいときに使う
- テスト実行は **ホスト mac の Python や `backend/.venv/bin/pytest` を直接使わず**、コンテナ内で行う

`backend/.venv` は devcontainer / Docker コンテナ内の `/workspace/backend/.venv` 前提で作られます。
そのため、ホスト mac 側から直接 `backend/.venv/bin/pytest` を実行すると `bad interpreter` になることがあります。

## 日々の作業

### 毎朝の開始

VS Code で `Open in Container` を実行して開発用コンテナに入ったら、まず次の 3 行で作業を始めます。

```bash
cd /workspace
source backend/.venv/bin/activate
docker compose up -d
```

`Open in Container` は VS Code の操作なので、コマンドには含めていません。
すでにコンテナ内で `backend` にいる場合は、`cd /workspace` は省略しても構いません。

この 3 行で次のサービスをまとめて起動した状態にできます。

- `db`
- `backend`
- `frontend`

### 変更の反映

この状態で、コードリーディングや改修を進められます。

- `backend`
  - `uvicorn ... --reload` で動いているので、Python のコード変更は基本的に自動再起動されます
- `frontend`
  - `npm run dev` で動いているので、Vite の HMR で画面にすぐ反映されやすいです
- `db`
  - DB は起動していて、データはボリュームに保存されます

ただし、次のような変更は **再起動や再ビルドが必要** になることがあります。

- `requirements.txt` を変えた
- `package.json` を変えた
- `Dockerfile` を変えた
- `docker-compose.yml` の設定を変えた
- `.venv` を作り直した

`backend/requirements.txt` を変えたときは、バックエンドのイメージを作り直す必要があります。

```bash
docker compose up --build -d backend
```

また、今回のように Alembic の初回導入で DB の履歴管理を入れた直後は、手元の既存 DB が Alembic 管理外のまま残っていることがあります。
その場合は、ローカル開発 DB を作り直すのがいちばん分かりやすいです。

```bash
docker compose down -v
docker compose up --build -d
```

## 初回だけやる準備

### 1. 仮想環境 `.venv` を準備する

`backend` ディレクトリで、最初の 1 回だけ仮想環境を作成します。

```bash
cd /workspace/backend
python -m venv .venv
```

### 2. 仮想環境を有効化する

作業のたびに `.venv` を有効化します。

```bash
source .venv/bin/activate
```

有効化できているかは、次で確認できます。

```bash
which python
python -c "import sys; print(sys.executable)"
pip --version
```

`/workspace/backend/.venv/bin/python` のようなパスが出れば、仮想環境が使えています。

### 3. 依存パッケージを入れる

`.venv` を新しく作ったときや、`requirements.txt` が更新されたときに実行します。

```bash
pip install -r requirements.txt
```

通常は毎回やり直す必要はありません。

### 4. バックエンドを起動する

FastAPI は `uvicorn` で起動します。

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

`uvicorn` は FastAPI アプリを実際に動かす ASGI サーバーです。

### 5. Alembic を準備する

このプロジェクトでは、DB スキーマ変更を Alembic で管理します。

- 設定ファイル: `backend/alembic.ini`
- マイグレーション本体: `backend/alembic/versions/`

初回セットアップ後に DB を最新スキーマへ上げる基本コマンドは次のとおりです。

```bash
cd /workspace/backend
source .venv/bin/activate
alembic upgrade head
```

バックエンド起動時にも `upgrade head` 相当が自動実行されるため、普段の開発では明示実行が不要なことも多いです。
ただし、マイグレーション自体の動作確認をしたいときは手で実行すると分かりやすいです。

新しいマイグレーションを追加するときは、次のようにファイルを作ります。

```bash
cd /workspace/backend
source .venv/bin/activate
alembic revision -m "describe change"
```

今回の初回導入では、既存スキーマ一式を作る初期マイグレーションを追加しています。

### 6. Alembic の運用ルール

Alembic は、DB に影響する変更を「履歴として残す」ために使います。

- モデルを変えただけでは、既存 DB には自動反映されない
- DB に影響する変更を入れたら、Alembic の revision ファイルも追加する
- ローカルで `docker compose down -v` を使うのは復旧や作り直しの手段であり、履歴管理の代わりではない

対象になりやすい変更は次のようなものです。

- テーブルの追加・削除
- カラムの追加・削除
- 型変更
- NOT NULL 制約の追加・削除
- CHECK 制約の追加・削除
- 文字数上限の追加・変更
- インデックスの追加・削除

逆に、DB 構造に影響しない変更なら Alembic は不要です。たとえば次のようなものです。

- API レスポンスの整形だけを変える
- ログ出力を変える
- フロントエンドの表示だけを変える
- Python ロジックだけを変える

### 7. DB 変更時の基本手順

DB に影響する変更を入れるときは、基本的に次の順番で進めます。

1. SQLAlchemy のモデルを変更する
2. 必要なら Pydantic schema も変更する
3. Alembic の revision ファイルを作る
4. revision ファイルに upgrade / downgrade を書く
5. `alembic upgrade head` で適用する
6. アプリ起動と API 動作を確認する
7. README やテストケースに影響があれば更新する

今回の `reason` 300 文字制限は、この流れでいうと次のような変更です。

- フロント: `textarea` に `maxLength=300`
- schema: `max_length=300`
- DB: `length(reason) <= 300` の CHECK 制約

### 8. Alembic revision 作成テンプレ

新しい DB 変更を入れるときは、まず次のコマンドで雛形を作ります。

```bash
cd /workspace/backend
source .venv/bin/activate
alembic revision -m "add reason max length"
```

生成されたファイルでは、最低限次を埋めます。

```python
def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
```

たとえば CHECK 制約を追加する場合は、次のような形になります。

```python
def upgrade() -> None:
    op.create_check_constraint(
        "constraint_name",
        "table_name",
        "length(target_column) <= 300",
    )


def downgrade() -> None:
    op.drop_constraint("constraint_name", "table_name", type_="check")
```

### 9. どんなときに DB を作り直すか

Alembic を入れていても、ローカル開発では DB を作り直したほうが早い場面があります。

- Alembic 導入前の古いボリュームが残っている
- `.env` の DB 接続情報を変えた
- 初期データからやり直したい
- ローカル DB を一度まっさらにしたい

その場合は次の手順で作り直します。

```bash
docker compose down -v
docker compose up --build -d
```

この操作はあくまで「ローカル環境の作り直し」です。
DB 変更の履歴を残す目的にはならないので、DB に影響する変更をしたときは、別途 Alembic revision も必ず作成します。

## バックエンド単体で起動する場面

バックエンド単体で起動するのは、たとえば次のようなときです。

- API の挙動だけを確認したい
- Python のロジックだけを追いたい
- バックエンドのテストやデバッグだけをしたい

フロントエンドや DB を含めて全体を見たいときは、ルートの `docker-compose.yml` から起動するほうが分かりやすいです。

## テスト実行

バックエンドのテストは、`backend/Makefile` 経由でコンテナ内の `pytest` を呼ぶのを基本にします。

よく使うコマンドは次のとおりです。

```bash
make -C backend test
make -C backend test-unit
make -C backend test-assets
make -C backend test-file FILE=tests/test_assets_routes.py
```

- `test`: バックエンドの pytest をまとめて実行する
- `test-unit`: `backend/tests` 配下を実行する
- `test-assets`: 今回の備品一覧テストだけを実行する
- `test-file`: 任意のテストファイルを指定して実行する

Makefile を使わずに直接実行したい場合も、ホスト側の Python ではなくコンテナ内で実行します。

```bash
docker compose exec backend bash -lc "cd /workspace/backend && pytest tests/test_assets_routes.py"
```

## 全体を起動する場合

リポジトリのルートで次を実行します。

```bash
docker compose up -d
```

これで次の 3 つのサービスが起動します。

- `db` : PostgreSQL
- `backend` : FastAPI
- `frontend` : React + Vite

## 環境変数

公開用の初期設定は、ルートの `.env.example` をコピーして `.env` を作る想定です。

`docker-compose.yml` では、バックエンドに次の環境変数を渡しています。

- `APP_ENV`
  - `dev` のときに開発用のログ設定を使います
- `LOG_TO_FILE`
  - `true` のときに `logs/backend.log` にも書き出します
- `DATABASE_URL`
  - PostgreSQL の接続先
- `CORS_ORIGINS`
  - フロントエンドのオリジン

## 開発時のログ

開発環境では、`APP_ENV=dev` かつ `LOG_TO_FILE=true` のときに、バックエンドは標準出力に加えて `logs/backend.log` にもログを書きます。

このファイルは VS Code で直接開けるので、`docker compose logs ...` を毎回打たなくても、エラーの前後をまとめて追いやすくなります。

起動エラーや DB 接続エラーが出た場合は、まずこのファイルを見ると原因を追いやすいです。

このログまわりの考え方は、ざっくり次の通りです。

- `APP_ENV=dev`
  - 開発環境として扱います
  - ログレベルは `logging.DEBUG` になります
- `APP_ENV=dev` かつ `LOG_TO_FILE=true`
  - バックエンドは標準出力に加えて `logs/backend.log` にもログを書きます
- ログの見え方
  - `asset_flow.app.main.lifespan` のように、モジュール名と関数名が分かる形式で出ます
- `logger.info(...)` / `logger.exception(...)`
  - どちらも標準出力に出ます
  - Docker やクラウド側が標準出力を拾う設定なら、CloudWatch のような外部ログ基盤でも確認できます
- `logger.debug(...)`
  - 今回の実装では、まだ debug レベルのメッセージは書いていません
  - 必要になった段階で、追加したい場所に明示的に入れます
- 本番や検証環境
  - `APP_ENV` の値を変えることで、開発時ほど細かいログを出さない運用にできます

## エンドポイント確認

バックエンドが起動したら、まずは次を確認できます。

- `GET /health`

例:

```bash
curl http://localhost:8000/health
```

## 補足

- `backend/Dockerfile` は、バックエンドを Docker イメージとして起動するための定義です。
- 開発中は `Open in Container` か `docker compose up -d` を使うのが基本です。
- ローカルでバックエンドだけ試したい場合は、`backend/.venv` を使って `uvicorn` を直接起動できます。

## トラブルシューティング

### `GET /health` にアクセスできない場合

今回のように、ブラウザで `http://localhost:8000/health` を開いても
`ERR_CONNECTION_RESET` になったり、真っ白な画面のまま止まることがあります。

このときは、まず「どこで止まっているか」を分けて考えると整理しやすいです。

- `backend` が起動していない
- `backend` は起動しているが、`db` に接続できずに止まっている
- `frontend` は動いているが、`backend` に届いていない

今回の原因は、`backend` と `db` のつなぎ方にありました。
より正確には、`backend` は起動しようとしたものの、起動直後に `db` へ接続するところで失敗していました。

`backend` は起動時に [`app/main.py`](./app/main.py) の中で Alembic の `upgrade head` を実行します。
そのため、`db` にログインできないと、`/health` を返す前に止まってしまいます。

今回の `db` 側の問題は、PostgreSQL が以前の設定をボリュームに覚えていたことでした。
PostgreSQL は `docker compose` で一度作ると、データだけでなく「初期化時の設定」もボリュームに残します。
その後に `.env` の `POSTGRES_PASSWORD` を変えると、`backend` が使うパスワードと `db` が覚えているパスワードがずれて、接続エラーになります。

つまり、今回の流れはこうです。

1. `db` は起動している
2. でも、保存済みのパスワードが古い
3. `backend` が `db` にログインできない
4. `backend` の起動が止まる
5. `GET /health` も `GET /api/assets` も返らない

直し方は次の順番です。

```bash
docker compose down -v
docker compose up -d
docker compose exec -e PYTHONPATH=. backend python app/seeds.py
```

- `docker compose down -v`
  - `db` のボリュームを消して、PostgreSQL を作り直します
- `docker compose up -d`
  - `db`、`backend`、`frontend` をもう一度起動します
- `docker compose exec -e PYTHONPATH=. backend python app/seeds.py`
  - `db` に初期データを入れます

このトラブルで覚えておくとよいのは、`backend` のコードそのものが壊れていたわけではなく、
`backend` が `db` に入るための合言葉が合っていなかった、という点です。
なので、次に同じことが起きたら、まずは `db` のボリュームと `.env` の値を見直すと早く復旧できます。

### VS Code で `fastapi` などが見つからない場合

`fastapi` や `sqlalchemy` に黄色い波線が出る場合は、VS Code が参照している Python interpreter が `backend/.venv` ではなく、グローバル Python になっている可能性があります。

その場合は、右下の Python 表示から次を選び直します。

```text
/workspace/backend/.venv/bin/python
```

選び直したあとも表示がすぐ反映されない場合は、`Developer: Reload Window` を実行すると改善することがあります。

### ターミナルが毎回 `.venv` に入る場合

VS Code の設定で `python.terminal.activateEnvironment` が有効になっていると、新しいターミナルでも自動的に仮想環境が有効になります。

Git 作業用と Python 作業用でターミナルを分けたい場合は、この設定を `false` にしておくと扱いやすくなります。

### ワークスペース名や配置を変えたあとに `.venv` が壊れる場合

`venv` は作成時の絶対パスを内部に持つので、`/workspace/backend/.venv` のような場所で作ったものを別のパスに持っていくと、`python` や `pip` が見つからなくなることがあります。

その場合は、古い `.venv` を作り直すのがいちばん簡単です。

```bash
cd /workspace/backend
deactivate 2>/dev/null || true
rm -rf .venv
/usr/local/bin/python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

`which python` が `.venv/bin/python` を返せば、仮想環境は正しく使えています。
