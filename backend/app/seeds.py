import csv
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from app.constants.enums import AssetLoanRequestStatus, AssetStatus
from app.core.database import SessionLocal
from app.core.logger import get_logger
from app.core.migrations import run_migrations
from app.core.security import hash_password
from app.models.asset import Asset
from app.models.asset_loan_request import AssetLoanRequest
from app.models.user import User

# スクリプト実行時でも `__main__` ではなく、役割名が見えるようにする
logger = get_logger("app.seeds")

BASE_CREATED_AT = datetime(2026, 6, 1, 11, 35, tzinfo=timezone.utc)
BASE_REQUEST_CREATED_AT = datetime(2026, 7, 24, 9, 0, tzinfo=timezone.utc)
SEED_DATA_DIR = Path(__file__).resolve().parent / "seed_data"
ASSET_SEED_DATA_PATH = SEED_DATA_DIR / "seed_assets.csv"
ASSET_LOAN_REQUEST_SEED_DATA_PATH = SEED_DATA_DIR / "seed_asset_loan_requests.csv"
USER_SEED_DATA_PATH = SEED_DATA_DIR / "seed_users.csv"
ASSET_REQUIRED_COLUMNS = {"name", "category", "total_stock", "status"}
USER_REQUIRED_COLUMNS = {"id", "name", "login_id", "password", "role"}
ASSET_LOAN_REQUEST_REQUIRED_COLUMNS = {
    "asset_name",
    "requester_name",
    "user_id",
    "start_date",
    "end_date",
    "reason",
    "quantity",
    "status",
}


def load_seed_users() -> list[dict[str, object]]:
    seed_users: list[dict[str, object]] = []

    for row_number, row in load_seed_rows(USER_SEED_DATA_PATH, USER_REQUIRED_COLUMNS):
        user_id_value = row.get("id") or ""
        name = row.get("name") or ""
        login_id = row.get("login_id") or ""
        password = row.get("password") or ""
        role = row.get("role") or ""
        department = row.get("department") or ""

        if not user_id_value:
            raise ValueError(f"Seed data row {row_number}: id is required")
        if not name:
            raise ValueError(f"Seed data row {row_number}: name is required")
        if not login_id:
            raise ValueError(f"Seed data row {row_number}: login_id is required")
        if not password:
            raise ValueError(f"Seed data row {row_number}: password is required")
        if role not in {"admin", "user"}:
            raise ValueError(f"Seed data row {row_number}: unsupported role '{role}'")

        try:
            user_id = int(user_id_value)
        except ValueError as exc:
            raise ValueError(f"Seed data row {row_number}: id must be an integer") from exc

        if user_id < 1:
            raise ValueError(f"Seed data row {row_number}: id must be greater than or equal to 1")

        seed_users.append(
            {
                "id": user_id,
                "name": name,
                "login_id": login_id.lower(),
                "password_hash": hash_password(password),
                "role": role,
                "department": department or None,
            }
        )

    return seed_users


def load_seed_rows(
    file_path: Path,
    required_columns: set[str],
) -> list[tuple[int, dict[str, str]]]:
    if not file_path.exists():
        raise FileNotFoundError(f"Seed data file not found: {file_path}")

    with file_path.open(encoding="utf-8", newline="") as csv_file:
        reader = csv.DictReader(csv_file)
        missing_columns = required_columns - set(reader.fieldnames or [])
        if missing_columns:
            raise ValueError(
                f"Seed data columns are missing in {file_path.name}: {sorted(missing_columns)}"
            )

        return [
            (index + 2, {key: (value or "").strip() for key, value in row.items()})
            for index, row in enumerate(reader)
        ]


def load_seed_assets() -> list[dict[str, object]]:
    seed_assets: list[dict[str, object]] = []

    for index, (row_number, row) in enumerate(
        load_seed_rows(ASSET_SEED_DATA_PATH, ASSET_REQUIRED_COLUMNS)
    ):
        name = row.get("name") or ""
        category = row.get("category") or ""
        total_stock_value = row.get("total_stock") or ""
        status_value = row.get("status") or ""

        if not name:
            raise ValueError(f"Seed data row {row_number}: name is required")
        if not category:
            raise ValueError(f"Seed data row {row_number}: category is required")
        if not total_stock_value:
            raise ValueError(f"Seed data row {row_number}: total_stock is required")
        if not status_value:
            raise ValueError(f"Seed data row {row_number}: status is required")

        try:
            total_stock = int(total_stock_value)
        except ValueError as exc:
            raise ValueError(
                f"Seed data row {row_number}: total_stock must be an integer"
            ) from exc

        if total_stock < 0:
            raise ValueError(
                f"Seed data row {row_number}: "
                "total_stock must be greater than or equal to 0"
            )

        try:
            status = AssetStatus(status_value)
        except ValueError as exc:
            raise ValueError(
                f"Seed data row {row_number}: unsupported status '{status_value}'"
            ) from exc

        timestamp = BASE_CREATED_AT - timedelta(minutes=index * 37)
        seed_assets.append(
            {
                "name": name,
                "category": category,
                "total_stock": total_stock,
                "status": status,
                "created_at": timestamp,
                "updated_at": timestamp,
            }
        )

    return seed_assets


def load_seed_asset_loan_requests() -> list[dict[str, object]]:
    seed_asset_loan_requests: list[dict[str, object]] = []

    for index, (row_number, row) in enumerate(
        load_seed_rows(
            ASSET_LOAN_REQUEST_SEED_DATA_PATH,
            ASSET_LOAN_REQUEST_REQUIRED_COLUMNS,
        )
    ):
        asset_name = row.get("asset_name") or ""
        requester_name = row.get("requester_name") or ""
        user_id_value = row.get("user_id") or ""
        start_date_value = row.get("start_date") or ""
        end_date_value = row.get("end_date") or ""
        reason = row.get("reason") or ""
        quantity_value = row.get("quantity") or ""
        status_value = row.get("status") or ""

        if not asset_name:
            raise ValueError(f"Seed data row {row_number}: asset_name is required")
        if not requester_name:
            raise ValueError(
                f"Seed data row {row_number}: requester_name is required"
            )
        if not user_id_value:
            raise ValueError(f"Seed data row {row_number}: user_id is required")
        if not start_date_value:
            raise ValueError(f"Seed data row {row_number}: start_date is required")
        if not end_date_value:
            raise ValueError(f"Seed data row {row_number}: end_date is required")
        if not reason:
            raise ValueError(f"Seed data row {row_number}: reason is required")
        if not quantity_value:
            raise ValueError(f"Seed data row {row_number}: quantity is required")
        if not status_value:
            raise ValueError(f"Seed data row {row_number}: status is required")

        try:
            user_id = int(user_id_value)
        except ValueError as exc:
            raise ValueError(
                f"Seed data row {row_number}: user_id must be an integer"
            ) from exc

        try:
            start_date = date.fromisoformat(start_date_value)
        except ValueError as exc:
            raise ValueError(
                f"Seed data row {row_number}: start_date must be in YYYY-MM-DD format"
            ) from exc

        try:
            end_date = date.fromisoformat(end_date_value)
        except ValueError as exc:
            raise ValueError(
                f"Seed data row {row_number}: end_date must be in YYYY-MM-DD format"
            ) from exc

        if end_date < start_date:
            raise ValueError(
                f"Seed data row {row_number}: end_date must be on or after start_date"
            )

        try:
            quantity = int(quantity_value)
        except ValueError as exc:
            raise ValueError(
                f"Seed data row {row_number}: quantity must be an integer"
            ) from exc

        if quantity < 1:
            raise ValueError(
                f"Seed data row {row_number}: quantity must be greater than or equal to 1"
            )

        try:
            status = AssetLoanRequestStatus(status_value)
        except ValueError as exc:
            raise ValueError(
                f"Seed data row {row_number}: unsupported status '{status_value}'"
            ) from exc

        timestamp = BASE_REQUEST_CREATED_AT - timedelta(minutes=index * 17)
        seed_asset_loan_requests.append(
            {
                "asset_name": asset_name,
                "requester_name": requester_name,
                "user_id": user_id,
                "start_date": start_date,
                "end_date": end_date,
                "reason": reason,
                "quantity": quantity,
                "status": status,
                "returned_at": None,
                "created_at": timestamp,
                "updated_at": timestamp,
            }
        )

    return seed_asset_loan_requests


def seed_assets() -> None:
    db = SessionLocal()
    try:
        created_count = 0
        updated_count = 0

        for asset_data in load_seed_assets():
            asset = (
                db.query(Asset)
                .filter(Asset.name == asset_data["name"])
                .one_or_none()
            )

            if asset is None:
                db.add(Asset(**asset_data))
                created_count += 1
                continue

            asset.category = asset_data["category"]
            asset.total_stock = asset_data["total_stock"]
            asset.status = asset_data["status"]
            asset.created_at = asset_data["created_at"]
            asset.updated_at = asset_data["updated_at"]
            updated_count += 1

        db.commit()
        logger.info(
            "Asset seed completed: created=%s, updated=%s",
            created_count,
            updated_count,
        )
    finally:
        db.close()


def seed_users() -> None:
    db = SessionLocal()
    try:
        created_count = 0
        updated_count = 0

        for user_data in load_seed_users():
            user = db.get(User, user_data["id"])

            if user is None:
                db.add(User(**user_data))
                created_count += 1
                continue

            user.name = str(user_data["name"])
            user.login_id = str(user_data["login_id"])
            user.password_hash = str(user_data["password_hash"])
            user.role = str(user_data["role"])
            user.department = (
                str(user_data["department"])
                if user_data["department"] is not None
                else None
            )
            updated_count += 1

        db.commit()
        logger.info(
            "User seed completed: created=%s, updated=%s",
            created_count,
            updated_count,
        )
    finally:
        db.close()


def seed_asset_loan_requests() -> None:
    db = SessionLocal()
    try:
        existing_active_request = (
            db.query(AssetLoanRequest.id)
            .filter(
                AssetLoanRequest.user_id == 1,
                AssetLoanRequest.status.in_(
                    [
                        AssetLoanRequestStatus.pending,
                        AssetLoanRequestStatus.loaned,
                    ]
                ),
            )
            .first()
        )
        if existing_active_request is not None:
            logger.info(
                "Asset loan request seed skipped because user_id=1 already has active requests"
            )
            return

        asset_by_name = {
            asset.name: asset.id
            for asset in db.query(Asset).all()
        }

        created_count = 0
        for asset_loan_request_data in load_seed_asset_loan_requests():
            asset_name = str(asset_loan_request_data.pop("asset_name"))
            asset_id = asset_by_name.get(asset_name)

            if asset_id is None:
                raise ValueError(
                    f"Seed asset loan request references unknown asset_name '{asset_name}'"
                )

            db.add(
                AssetLoanRequest(
                    asset_id=asset_id,
                    **asset_loan_request_data,
                )
            )
            created_count += 1

        db.commit()
        logger.info("Asset loan request seed completed: created=%s", created_count)
    finally:
        db.close()


def seed_development_data() -> None:
    logger.info("Development seed start")
    run_migrations()
    seed_users()
    seed_assets()
    seed_asset_loan_requests()
    logger.info("Development seed completed")


if __name__ == "__main__":
    try:
        seed_development_data()
    except Exception:
        logger.exception("Seed execution failed")
        raise
