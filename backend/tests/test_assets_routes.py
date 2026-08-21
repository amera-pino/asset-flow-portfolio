import json
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError

from app.constants.enums import AssetLoanRequestStatus
from app.constants.error_messages import (
    ERROR_500_ASSET_CREATE_FAILED,
    ERROR_500_ASSET_LIST_FETCH_FAILED,
    ERROR_500_CATEGORY_LIST_FETCH_FAILED,
)
from app.models.asset import Asset
from app.schemas.asset import AssetCreate, AssetPage, AssetRow
from app.api.routes.assets import (
    build_asset_row,
    build_consuming_quantity_subquery,
    create_asset,
    list_asset_categories,
    list_assets,
)


JST = timezone(timedelta(hours=9))


def dt(day: int, hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 7, day, hour, minute, tzinfo=JST)


def response_json(response: object) -> dict:
    return json.loads(response.body.decode("utf-8"))


def current_user_stub() -> SimpleNamespace:
    return SimpleNamespace(id=1, role="user")


@pytest.mark.parametrize(
    ("consuming_quantity", "expected_effective_stock"),
    [
        pytest.param(4, 6, id="B-AL-002"),
        pytest.param(5, 0, id="B-AL-003"),
    ],
)
def test_build_asset_row_returns_expected_values(
    asset_factory,
    consuming_quantity: int,
    expected_effective_stock: int,
) -> None:
    asset = asset_factory(
        name="ノートPC" if consuming_quantity == 4 else "モニター",
        category="PC" if consuming_quantity == 4 else "ディスプレイ",
        total_stock=10 if consuming_quantity == 4 else 3,
        created_at=dt(30, 9),
        updated_at=dt(30, 10),
    )

    row = build_asset_row(asset, consuming_quantity)

    assert isinstance(row, AssetRow)
    assert row.id == asset.id
    assert row.name == asset.name
    assert row.category == asset.category
    assert row.status == asset.status
    assert row.total_stock == asset.total_stock
    assert row.consuming_quantity == consuming_quantity
    assert row.effective_stock == expected_effective_stock
    assert row.created_at == asset.created_at
    assert row.updated_at == asset.updated_at


def test_build_consuming_quantity_subquery_aggregates_only_pending_approved_and_loaned(
    db_session,
    asset_factory,
    loan_request_factory,
) -> None:
    asset_1 = asset_factory(
        name="ノートPC",
        category="PC",
        total_stock=10,
        created_at=dt(30, 9),
        updated_at=dt(30, 10),
    )
    asset_2 = asset_factory(
        name="モニター",
        category="ディスプレイ",
        total_stock=5,
        created_at=dt(30, 9),
        updated_at=dt(30, 10),
    )
    loan_request_factory(asset_id=asset_1.id, quantity=2, status=AssetLoanRequestStatus.pending)
    loan_request_factory(asset_id=asset_1.id, quantity=1, status=AssetLoanRequestStatus.approved)
    loan_request_factory(asset_id=asset_1.id, quantity=3, status=AssetLoanRequestStatus.loaned)
    loan_request_factory(asset_id=asset_1.id, quantity=4, status=AssetLoanRequestStatus.returned)
    loan_request_factory(asset_id=asset_1.id, quantity=5, status=AssetLoanRequestStatus.cancelled)
    loan_request_factory(asset_id=asset_2.id, quantity=1, status=AssetLoanRequestStatus.pending)

    subquery = build_consuming_quantity_subquery()
    rows = db_session.execute(
        select(subquery.c.asset_id, subquery.c.consuming_quantity).order_by(subquery.c.asset_id)
    ).all()

    assert rows == [
        (asset_1.id, 6),
        (asset_2.id, 1),
    ]


def test_create_asset_persists_row_for_admin_user(
    db_session,
    user_factory,
) -> None:
    admin_user = user_factory(
        id=1,
        name="管理者",
        login_id="admin@example.com",
        password_hash="hashed-password",
        role="admin",
    )

    response = create_asset(
        AssetCreate(name="  Surface Laptop  ", category="  PC  ", total_stock=3),
        db_session,
        admin_user,
    )

    assert response["success"] is True
    created = response["data"]
    assert created.name == "Surface Laptop"
    assert created.category == "PC"
    assert created.total_stock == 3
    assert created.effective_stock == 3
    assert db_session.scalar(select(func.count()).select_from(Asset)) == 1
    persisted = db_session.scalar(select(Asset))
    assert persisted is not None
    assert persisted.name == "Surface Laptop"
    assert persisted.category == "PC"
    assert persisted.total_stock == 3


def test_create_asset_rejects_non_admin_user(
    db_session,
    user_factory,
) -> None:
    normal_user = user_factory(
        id=2,
        name="一般ユーザー",
        login_id="user@example.com",
        password_hash="hashed-password",
        role="user",
    )

    with pytest.raises(HTTPException) as exc_info:
        create_asset(
            AssetCreate(name="Mac mini", category="PC", total_stock=2),
            db_session,
            normal_user,
        )

    assert exc_info.value.status_code == HTTPStatus.FORBIDDEN


def test_create_asset_returns_internal_server_error_on_db_failure(
    monkeypatch,
    db_session,
    user_factory,
) -> None:
    admin_user = user_factory(
        id=3,
        name="管理者",
        login_id="admin2@example.com",
        password_hash="hashed-password",
        role="admin",
    )

    def raise_error() -> None:
        raise SQLAlchemyError("db failure")

    monkeypatch.setattr(db_session, "commit", raise_error)

    response = create_asset(
        AssetCreate(name="iPad Air", category="タブレット", total_stock=4),
        db_session,
        admin_user,
    )

    assert isinstance(response, JSONResponse)
    assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
    assert response_json(response)["error"]["message"] == ERROR_500_ASSET_CREATE_FAILED


def test_list_assets_returns_default_order_and_stock_summary(
    db_session,
    asset_factory,
    loan_request_factory,
) -> None:
    older = dt(29, 9)
    newer = dt(30, 9)
    asset_1 = asset_factory(
        name="古い備品",
        category="備品",
        total_stock=4,
        created_at=older,
        updated_at=older,
    )
    asset_2 = asset_factory(
        name="在庫あり",
        category="PC",
        total_stock=10,
        created_at=older,
        updated_at=older,
    )
    asset_3 = asset_factory(
        name="新しい備品",
        category="周辺機器",
        total_stock=8,
        created_at=newer,
        updated_at=newer,
    )
    loan_request_factory(asset_id=asset_2.id, quantity=3, status=AssetLoanRequestStatus.pending)

    response = list_assets(db_session, current_user_stub(), category=None, q=None, page=1, sort=None)

    assert response["success"] is True
    page = response["data"]
    assert isinstance(page, AssetPage)
    assert page.page == 1
    assert page.page_size == 20
    assert [item.id for item in page.items] == [asset_3.id, asset_2.id, asset_1.id]
    asset_with_request = next(item for item in page.items if item.id == asset_2.id)
    asset_without_request = next(item for item in page.items if item.id == asset_3.id)
    assert asset_with_request.consuming_quantity == 3
    assert asset_with_request.effective_stock == 7
    assert asset_without_request.consuming_quantity == 0


@pytest.mark.parametrize(
    ("sort", "expected_names", "expected_ids"),
    [
        pytest.param("name_asc", ["Adapter", "Monitor", "Monitor"], [1, 2, 3], id="B-AL-005-name-asc"),
        pytest.param("name_desc", ["Monitor", "Monitor", "Adapter"], [3, 2, 1], id="B-AL-005-name-desc"),
    ],
)
def test_list_assets_applies_name_sorting(
    db_session,
    asset_factory,
    sort: str,
    expected_names: list[str],
    expected_ids: list[int],
) -> None:
    for name in ("Adapter", "Monitor", "Monitor"):
        asset_factory(
            name=name,
            category="PC",
            total_stock=1,
            created_at=dt(30, 9),
            updated_at=dt(30, 9),
        )

    response = list_assets(db_session, current_user_stub(), category=None, q=None, page=1, sort=sort)

    items = response["data"].items
    assert [item.name for item in items] == expected_names
    assert [item.id for item in items] == expected_ids


@pytest.mark.parametrize(
    ("category", "q", "expected_names"),
    [
        pytest.param("PC", None, ["モニター"], id="B-AL-006-category"),
        pytest.param(None, "PC", ["PCスタンド", "ノートPC"], id="B-AL-006-query"),
        pytest.param("周辺機器", "PC", ["PCスタンド"], id="B-AL-006-category-query"),
    ],
)
def test_list_assets_applies_category_and_partial_name_filters(
    db_session,
    asset_factory,
    category: str | None,
    q: str | None,
    expected_names: list[str],
) -> None:
    asset_factory(name="ノートPC", category="端末", total_stock=5, created_at=dt(30, 9), updated_at=dt(30, 9))
    asset_factory(name="モニター", category="PC", total_stock=5, created_at=dt(30, 9), updated_at=dt(30, 9))
    asset_factory(name="USBハブ", category="周辺機器", total_stock=5, created_at=dt(30, 9), updated_at=dt(30, 9))
    asset_factory(name="PCスタンド", category="周辺機器", total_stock=5, created_at=dt(30, 9), updated_at=dt(30, 9))

    response = list_assets(db_session, current_user_stub(), category=category, q=q, page=1, sort=None)

    assert [item.name for item in response["data"].items] == expected_names


def test_list_assets_returns_summary_counts_for_filtered_results(
    db_session,
    asset_factory,
    loan_request_factory,
) -> None:
    asset_a = asset_factory(
        name="ノートPC",
        category="PC",
        total_stock=10,
        created_at=dt(30, 9),
        updated_at=dt(30, 9),
    )
    asset_b = asset_factory(
        name="モニター",
        category="PC",
        total_stock=4,
        created_at=dt(30, 10),
        updated_at=dt(30, 10),
    )
    asset_c = asset_factory(
        name="USBハブ",
        category="周辺機器",
        total_stock=6,
        created_at=dt(30, 11),
        updated_at=dt(30, 11),
    )
    loan_request_factory(asset_id=asset_a.id, quantity=3, status=AssetLoanRequestStatus.pending)
    loan_request_factory(asset_id=asset_b.id, quantity=1, status=AssetLoanRequestStatus.loaned)
    loan_request_factory(asset_id=asset_c.id, quantity=2, status=AssetLoanRequestStatus.pending)

    response = list_assets(db_session, current_user_stub(), category="PC", q=None, page=1, sort=None)

    page = response["data"]
    assert page.filtered_item_count == 2
    assert page.total_item_count == 3
    assert page.total_item_stock == 20
    assert page.total_effective_stock == 14
    assert page.low_stock_item_count == 2
    assert [item.name for item in page.items] == ["モニター", "ノートPC"]


def test_list_assets_returns_expected_page_contents_and_total_pages(
    db_session,
    asset_factory,
) -> None:
    for asset_id in range(1, 22):
        asset_factory(
            name=f"備品{asset_id}",
            category="備品",
            total_stock=1,
            created_at=dt(1, 0) + timedelta(minutes=asset_id),
            updated_at=dt(1, 0) + timedelta(minutes=asset_id),
        )

    page_1 = list_assets(db_session, current_user_stub(), category=None, q=None, page=1, sort=None)["data"]
    page_2 = list_assets(db_session, current_user_stub(), category=None, q=None, page=2, sort=None)["data"]

    assert [item.id for item in page_1.items] == list(range(21, 1, -1))
    assert [item.id for item in page_2.items] == [1]
    assert page_1.total_pages == 2
    assert page_2.total_pages == 2


def test_list_assets_keeps_total_pages_as_one_when_no_rows_match(
    db_session,
    asset_factory,
) -> None:
    asset_factory(
        name="ノートPC",
        category="PC",
        total_stock=5,
        created_at=dt(30, 9),
        updated_at=dt(30, 9),
    )

    response = list_assets(db_session, current_user_stub(), category="存在しないカテゴリ", q=None, page=1, sort=None)

    page = response["data"]
    assert page.items == []
    assert page.filtered_item_count == 0
    assert page.total_pages == 1
    assert page.page == 1


def test_list_assets_returns_json_error_response_on_db_failure() -> None:
    db = Mock()
    db.scalar.side_effect = SQLAlchemyError("boom")

    response = list_assets(db, current_user_stub(), category=None, q=None, page=1, sort=None)

    assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
    assert response_json(response) == {
        "success": False,
        "data": None,
        "error": {
            "code": "ASSET_LIST_FETCH_FAILED",
            "message": ERROR_500_ASSET_LIST_FETCH_FAILED,
            "details": None,
        },
    }


def test_list_asset_categories_returns_distinct_sorted_categories(
    db_session,
    asset_factory,
) -> None:
    asset_factory(name="備品1", category="PC", total_stock=1, created_at=dt(30, 9), updated_at=dt(30, 9))
    asset_factory(name="備品2", category="周辺機器", total_stock=1, created_at=dt(30, 9), updated_at=dt(30, 9))
    asset_factory(name="備品3", category="PC", total_stock=1, created_at=dt(30, 9), updated_at=dt(30, 9))
    asset_factory(name="備品4", category="会議用品", total_stock=1, created_at=dt(30, 9), updated_at=dt(30, 9))

    response = list_asset_categories(db_session, current_user_stub())

    assert response["success"] is True
    assert response["data"] == ["PC", "会議用品", "周辺機器"]
    assert response["error"] is None


def test_list_asset_categories_returns_json_error_response_on_db_failure() -> None:
    db = Mock()
    db.scalars.side_effect = SQLAlchemyError("boom")

    response = list_asset_categories(db, current_user_stub())

    assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
    assert response_json(response) == {
        "success": False,
        "data": None,
        "error": {
            "code": "CATEGORY_LIST_FETCH_FAILED",
            "message": ERROR_500_CATEGORY_LIST_FETCH_FAILED,
            "details": None,
        },
    }
