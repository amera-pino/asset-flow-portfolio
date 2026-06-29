# Backend API

`asset-flow` のバックエンド FastAPI アプリです。

この README では、日々の開発でよく使う起動方法と、`venv` の扱いをまとめます。

## 基本方針

- 普段の開発は **VS Code の `Open in Container`** を使う
- コンテナの中で **バックエンド用の仮想環境 `.venv`** を使う
- 全体起動はルートの `docker-compose.yml` から行う
- バックエンド単体での起動は、API や Python の動作確認をしたいときに使う

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

## バックエンド単体で起動する場面

バックエンド単体で起動するのは、たとえば次のようなときです。

- API の挙動だけを確認したい
- Python のロジックだけを追いたい
- バックエンドのテストやデバッグだけをしたい

フロントエンドや DB を含めて全体を見たいときは、ルートの `docker-compose.yml` から起動するほうが分かりやすいです。

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

`docker-compose.yml` では、バックエンドに次の環境変数を渡しています。

- `DATABASE_URL`
  - PostgreSQL の接続先
- `CORS_ORIGINS`
  - フロントエンドのオリジン

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
