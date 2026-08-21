import asyncio
import json
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from http import HTTPStatus
from types import SimpleNamespace
import pytest
from fastapi import Request
from fastapi.routing import APIRoute
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError

from app.api.routes import requests as request_routes
from app.constants.enums import AssetLoanRequestStatus
from app.constants.error_messages import (
    ERROR_404_LOAN_REQUEST_ASSET_NOT_FOUND,
    ERROR_409_LOAN_REQUEST_CONFLICT,
    ERROR_500_ACTIVE_REQUESTS_FETCH_FAILED,
    ERROR_500_CANCEL_REQUEST_FAILED,
    ERROR_500_LOAN_REQUEST_SUBMIT_FAILED,
    ERROR_500_RETURN_REQUEST_FAILED,
    ERROR_503_ACTIVE_REQUESTS_FETCH_FAILED,
    ERROR_503_CANCEL_REQUEST_FAILED,
    ERROR_503_RETURN_REQUEST_FAILED,
    ERROR_504_ACTIVE_REQUESTS_FETCH_FAILED,
    ERROR_504_CANCEL_REQUEST_FAILED,
    ERROR_504_RETURN_REQUEST_FAILED,
)
from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.exceptions import ContextualInternalServerError, GatewayTimeoutError, ServiceUnavailableError
from app.main import app, contextual_internal_server_error_handler
from app.models.asset import Asset
from app.models.asset_loan_request import AssetLoanRequest
from app.schemas.asset_loan_request import (
    ActiveAssetLoanRequestRead,
    AssetLoanRequestCreate,
    AssetLoanRequestRead,
)
from app.services.asset_loan_request_service import (
    ActiveAssetLoanRequestNotFoundError,
    AssetNotFoundError,
    AssetLoanRequestCancelError,
    AssetLoanRequestReturnError,
    AssetLoanRequestStartLoanError,
    approve_asset_loan_request,
    force_return_asset_loan_request,
    InsufficientReservedStockError,
    cancel_asset_loan_request,
    create_asset_loan_request,
    list_admin_active_asset_loan_requests,
    list_active_asset_loan_requests,
    reject_asset_loan_request,
    return_asset_loan_request,
    start_approved_asset_loan_request,
)


JST = timezone(timedelta(hours=9))


def response_json(response: object) -> dict:
    return json.loads(response.body.decode("utf-8"))


def make_payload(**overrides: object) -> AssetLoanRequestCreate:
    payload = {
        "asset_id": 1,
        "requester_name": "山田 太郎",
        "start_date": date(2026, 8, 10),
        "end_date": date(2026, 8, 12),
        "reason": "客先デモ利用",
        "quantity": 1,
    }
    payload.update(overrides)
    return AssetLoanRequestCreate(**payload)


def make_request() -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/requests",
            "headers": [],
            "scheme": "http",
            "client": ("testclient", 50000),
            "server": ("testserver", 80),
        }
    )


def make_current_user(user_id: int = 1, role: str = "user") -> SimpleNamespace:
    return SimpleNamespace(id=user_id, role=role)


def make_asset_record(
    *,
    asset_id: int,
    name: str,
    category: str,
    total_stock: int = 10,
) -> Asset:
    timestamp = datetime(2026, 7, 31, 9, 0, tzinfo=JST)
    return Asset(
        id=asset_id,
        name=name,
        category=category,
        total_stock=total_stock,
        created_at=timestamp,
        updated_at=timestamp,
    )


def make_loan_request_record(
    *,
    request_id: int,
    asset_id: int,
    user_id: int,
    status: AssetLoanRequestStatus,
    requester_name: str = "山田太郎",
    start_date: date = date(2026, 8, 1),
    end_date: date = date(2026, 8, 10),
    reason: str = "検証",
    quantity: int = 1,
    returned_at: datetime | None = None,
) -> AssetLoanRequest:
    timestamp = datetime(2026, 7, 31, 9, 0, tzinfo=JST)
    return AssetLoanRequest(
        id=request_id,
        asset_id=asset_id,
        user_id=user_id,
        requester_name=requester_name,
        start_date=start_date,
        end_date=end_date,
        reason=reason,
        quantity=quantity,
        status=status,
        returned_at=returned_at,
        created_at=timestamp,
        updated_at=timestamp,
    )


@pytest.fixture
def fastapi_app(db_session, monkeypatch: pytest.MonkeyPatch):
    @asynccontextmanager
    async def noop_lifespan(_: object):
        yield

    def override_get_db():
        yield db_session

    def override_get_current_user():
        return make_current_user()

    monkeypatch.setattr(app.router, "lifespan_context", noop_lifespan)
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    yield app
    app.dependency_overrides.clear()


async def post_json(asgi_app, path: str, payload: dict) -> tuple[int, dict]:
    request_body = json.dumps(payload).encode("utf-8")
    response_start: dict | None = None
    response_body = bytearray()

    messages = [
        {
            "type": "http.request",
            "body": request_body,
            "more_body": False,
        }
    ]

    async def receive() -> dict:
        if messages:
            return messages.pop(0)
        return {"type": "http.disconnect"}

    async def send(message: dict) -> None:
        nonlocal response_start
        if message["type"] == "http.response.start":
            response_start = message
        elif message["type"] == "http.response.body":
            response_body.extend(message.get("body", b""))

    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode("ascii"),
        "query_string": b"",
        "headers": [
            (b"host", b"testserver"),
            (b"content-type", b"application/json"),
            (b"content-length", str(len(request_body)).encode("ascii")),
        ],
        "client": ("testclient", 50000),
        "server": ("testserver", 80),
    }

    await asgi_app(scope, receive, send)

    assert response_start is not None
    return response_start["status"], json.loads(response_body.decode("utf-8"))


@pytest.mark.parametrize(
    ("field_name", "field_value", "expected_message"),
    [
        pytest.param("asset_id", 0, "greater than or equal to 1", id="B-LR-001"),
        pytest.param("quantity", 0, "greater than or equal to 1", id="B-LR-002"),
        pytest.param("requester_name", "", "at least 1 character", id="B-LR-004"),
        pytest.param("requester_name", "a" * 121, "at most 120 characters", id="B-LR-005"),
        pytest.param("reason", "", "at least 1 character", id="B-LR-006"),
        pytest.param("reason", "a" * 301, "at most 300 characters", id="B-LR-007"),
    ],
)
def test_asset_loan_request_create_rejects_invalid_scalar_fields(
    field_name: str,
    field_value: object,
    expected_message: str,
) -> None:
    payload = {
        "asset_id": 1,
        "requester_name": "山田 太郎",
        "start_date": "2026-08-10",
        "end_date": "2026-08-12",
        "reason": "客先デモ利用",
        "quantity": 1,
    }
    payload[field_name] = field_value

    with pytest.raises(ValidationError) as exc_info:
        AssetLoanRequestCreate(**payload)

    errors = exc_info.value.errors()
    assert any(error["loc"][-1] == field_name for error in errors)
    assert any(expected_message in error["msg"] for error in errors if error["loc"][-1] == field_name)


def test_asset_loan_request_create_rejects_reversed_date_range() -> None:
    with pytest.raises(ValidationError) as exc_info:
        make_payload(start_date=date(2026, 8, 10), end_date=date(2026, 8, 9))

    assert any("終了日は開始日以降の日付を指定してください。" in error["msg"] for error in exc_info.value.errors())


def test_create_asset_loan_request_persists_pending_request(
    db_session,
    asset_factory,
) -> None:
    asset = asset_factory(
        name="MacBook Pro 14",
        category="PC",
        total_stock=10,
        created_at=datetime(2026, 7, 31, 9, 0, tzinfo=JST),
        updated_at=datetime(2026, 7, 31, 9, 0, tzinfo=JST),
    )
    asset_id = asset.id
    payload = make_payload(asset_id=asset_id, quantity=2)
    db_session.commit()

    created = create_asset_loan_request(db_session, payload, user_id=1)
    saved = db_session.get(AssetLoanRequest, created.id)

    assert isinstance(created, AssetLoanRequest)
    assert db_session.scalar(select(func.count()).select_from(AssetLoanRequest)) == 1
    assert saved is not None
    assert saved.asset_id == asset_id
    assert saved.user_id == 1
    assert saved.requester_name == "山田 太郎"
    assert saved.start_date == date(2026, 8, 10)
    assert saved.end_date == date(2026, 8, 12)
    assert saved.reason == "客先デモ利用"
    assert saved.quantity == 2
    assert saved.status == AssetLoanRequestStatus.pending
    assert saved.returned_at is None
    assert created.id == saved.id
    assert created.created_at == saved.created_at
    assert created.updated_at == saved.updated_at


def test_create_asset_loan_request_allows_request_at_effective_stock_boundary(
    db_session,
    asset_factory,
    loan_request_factory,
) -> None:
    asset = asset_factory(
        name="MacBook Pro 14",
        category="PC",
        total_stock=10,
        created_at=datetime(2026, 7, 31, 9, 0, tzinfo=JST),
        updated_at=datetime(2026, 7, 31, 9, 0, tzinfo=JST),
    )
    asset_id = asset.id
    loan_request_factory(asset_id=asset_id, quantity=2, status=AssetLoanRequestStatus.pending)
    loan_request_factory(asset_id=asset_id, quantity=3, status=AssetLoanRequestStatus.loaned)
    loan_request_factory(asset_id=asset_id, quantity=4, status=AssetLoanRequestStatus.returned)
    loan_request_factory(asset_id=asset_id, quantity=5, status=AssetLoanRequestStatus.cancelled)
    db_session.commit()

    created = create_asset_loan_request(
        db_session,
        make_payload(
            asset_id=asset_id,
            requester_name="佐藤 花子",
            start_date=date(2026, 8, 15),
            end_date=date(2026, 8, 16),
            reason="展示会搬入",
            quantity=5,
        ),
        user_id=1,
    )

    assert created.quantity == 5
    assert created.status == AssetLoanRequestStatus.pending
    assert db_session.scalar(select(func.count()).select_from(AssetLoanRequest)) == 5


def test_create_asset_loan_request_raises_when_asset_is_missing(db_session) -> None:
    with pytest.raises(AssetNotFoundError) as exc_info:
        create_asset_loan_request(db_session, make_payload(asset_id=999), user_id=1)

    assert exc_info.value.status_code == HTTPStatus.NOT_FOUND
    assert exc_info.value.code == "ASSET_NOT_FOUND"
    assert exc_info.value.message == ERROR_404_LOAN_REQUEST_ASSET_NOT_FOUND
    assert db_session.scalar(select(func.count()).select_from(AssetLoanRequest)) == 0


def test_create_asset_loan_request_raises_when_effective_stock_is_insufficient(
    db_session,
    asset_factory,
    loan_request_factory,
) -> None:
    asset = asset_factory(
        name="MacBook Pro 14",
        category="PC",
        total_stock=6,
        created_at=datetime(2026, 7, 31, 9, 0, tzinfo=JST),
        updated_at=datetime(2026, 7, 31, 9, 0, tzinfo=JST),
    )
    asset_id = asset.id
    loan_request_factory(asset_id=asset_id, quantity=2, status=AssetLoanRequestStatus.pending)
    loan_request_factory(asset_id=asset_id, quantity=1, status=AssetLoanRequestStatus.loaned)
    db_session.commit()

    with pytest.raises(InsufficientReservedStockError) as exc_info:
        create_asset_loan_request(
            db_session,
            make_payload(asset_id=asset_id, quantity=4),
            user_id=1,
        )

    assert exc_info.value.status_code == HTTPStatus.CONFLICT
    assert exc_info.value.code == "INSUFFICIENT_STOCK"
    assert exc_info.value.message == ERROR_409_LOAN_REQUEST_CONFLICT
    assert db_session.scalar(select(func.count()).select_from(AssetLoanRequest)) == 2


def test_create_request_returns_success_envelope_with_created_route_metadata(
    db_session,
    asset_factory,
    loan_request_factory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    asset = asset_factory(
        name="MacBook Pro 14",
        category="PC",
        total_stock=10,
        created_at=datetime(2026, 7, 31, 9, 0, tzinfo=JST),
        updated_at=datetime(2026, 7, 31, 9, 0, tzinfo=JST),
    )
    created = loan_request_factory(
        asset_id=asset.id,
        quantity=2,
        status=AssetLoanRequestStatus.pending,
        requester_name="山田 太郎",
        start_date=date(2026, 8, 10),
        end_date=date(2026, 8, 12),
        reason="客先デモ利用",
    )
    monkeypatch.setattr(request_routes, "create_asset_loan_request", lambda db, payload, user_id: created)

    response = request_routes.create_request(
        make_payload(asset_id=asset.id, quantity=2),
        db_session,
        make_current_user(),
    )
    route = next(
        route
        for route in request_routes.router.routes
        if isinstance(route, APIRoute) and route.endpoint is request_routes.create_request
    )

    assert route.status_code == HTTPStatus.CREATED
    assert response["success"] is True
    data = response["data"]
    assert isinstance(data, AssetLoanRequestRead)
    assert data.id == created.id
    assert data.asset_id == asset.id
    assert data.user_id == 1
    assert data.requester_name == "山田 太郎"
    assert data.start_date == date(2026, 8, 10)
    assert data.end_date == date(2026, 8, 12)
    assert data.reason == "客先デモ利用"
    assert data.quantity == 2
    assert data.status == AssetLoanRequestStatus.pending
    assert data.returned_at is None
    assert data.created_at is not None
    assert data.updated_at is not None
    assert response["error"] is None


def test_post_requests_returns_created_api_response_on_success(
    fastapi_app,
    db_session,
    asset_factory,
    loan_request_factory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    asset = asset_factory(
        name="MacBook Pro 14",
        category="PC",
        total_stock=10,
        created_at=datetime(2026, 7, 31, 9, 0, tzinfo=JST),
        updated_at=datetime(2026, 7, 31, 9, 0, tzinfo=JST),
    )
    created = loan_request_factory(
        asset_id=asset.id,
        quantity=2,
        status=AssetLoanRequestStatus.pending,
        requester_name="山田 太郎",
        start_date=date(2026, 8, 10),
        end_date=date(2026, 8, 12),
        reason="客先デモ利用",
    )
    monkeypatch.setattr(
        request_routes,
        "create_asset_loan_request",
        lambda db, payload, user_id: created,
    )

    status_code, response_json_body = asyncio.run(
        post_json(
            fastapi_app,
            "/api/requests",
            {
                "asset_id": asset.id,
                "requester_name": "山田 太郎",
                "start_date": "2026-08-10",
                "end_date": "2026-08-12",
                "reason": "客先デモ利用",
                "quantity": 2,
            },
        )
    )

    assert status_code == HTTPStatus.CREATED
    assert response_json_body["success"] is True
    assert response_json_body["error"] is None
    assert response_json_body["data"] == {
        "id": created.id,
        "asset_id": asset.id,
        "user_id": 1,
        "requester_name": "山田 太郎",
        "start_date": "2026-08-10",
        "end_date": "2026-08-12",
        "reason": "客先デモ利用",
        "quantity": 2,
        "status": "pending",
        "returned_at": None,
        "created_at": created.created_at.isoformat(),
        "updated_at": created.updated_at.isoformat(),
    }


@pytest.mark.parametrize(
    ("raised_error", "expected_status", "expected_code", "expected_message"),
    [
        pytest.param(
            AssetNotFoundError(ERROR_404_LOAN_REQUEST_ASSET_NOT_FOUND),
            HTTPStatus.NOT_FOUND,
            "ASSET_NOT_FOUND",
            ERROR_404_LOAN_REQUEST_ASSET_NOT_FOUND,
            id="B-LR-013",
        ),
        pytest.param(
            InsufficientReservedStockError(ERROR_409_LOAN_REQUEST_CONFLICT),
            HTTPStatus.CONFLICT,
            "INSUFFICIENT_STOCK",
            ERROR_409_LOAN_REQUEST_CONFLICT,
            id="B-LR-014",
        ),
    ],
)
def test_create_request_converts_business_errors_to_json_response(
    db_session,
    monkeypatch: pytest.MonkeyPatch,
    raised_error: Exception,
    expected_status: HTTPStatus,
    expected_code: str,
    expected_message: str,
) -> None:
    def raise_error(db, payload, user_id):
        raise raised_error

    monkeypatch.setattr(request_routes, "create_asset_loan_request", raise_error)

    response = request_routes.create_request(make_payload(), db_session, make_current_user())

    assert response.status_code == expected_status
    assert response_json(response) == {
        "success": False,
        "data": None,
        "error": {
            "code": expected_code,
            "message": expected_message,
            "details": None,
        },
    }


@pytest.mark.parametrize(
    "raised_error",
    [
        pytest.param(SQLAlchemyError("db failed"), id="B-LR-015"),
        pytest.param(Exception("unexpected"), id="B-LR-016"),
    ],
)
def test_create_request_wraps_unexpected_errors_with_context(
    db_session,
    monkeypatch: pytest.MonkeyPatch,
    raised_error: Exception,
) -> None:
    def raise_error(db, payload, user_id):
        raise raised_error

    monkeypatch.setattr(request_routes, "create_asset_loan_request", raise_error)

    with pytest.raises(ContextualInternalServerError, match="サーバーエラー") as exc_info:
        request_routes.create_request(make_payload(), db_session, make_current_user())

    assert exc_info.value.code == "LOAN_REQUEST_SUBMIT_FAILED"
    assert exc_info.value.message == ERROR_500_LOAN_REQUEST_SUBMIT_FAILED
    assert exc_info.value.__cause__ is raised_error


def test_contextual_internal_server_error_handler_returns_loan_request_error_envelope() -> None:
    exc = ContextualInternalServerError(
        "LOAN_REQUEST_SUBMIT_FAILED",
        ERROR_500_LOAN_REQUEST_SUBMIT_FAILED,
    )

    response = asyncio.run(contextual_internal_server_error_handler(make_request(), exc))

    assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
    assert response_json(response) == {
        "success": False,
        "data": None,
        "error": {
            "code": "LOAN_REQUEST_SUBMIT_FAILED",
            "message": ERROR_500_LOAN_REQUEST_SUBMIT_FAILED,
            "details": None,
        },
    }


@pytest.mark.parametrize(
    "raised_error",
    [
        pytest.param(SQLAlchemyError("db failed"), id="B-LR-018"),
        pytest.param(Exception("unexpected"), id="B-LR-019"),
    ],
)
def test_post_requests_returns_contextual_internal_server_error_envelope(
    fastapi_app,
    monkeypatch: pytest.MonkeyPatch,
    raised_error: Exception,
) -> None:
    def raise_error(db, payload):
        raise raised_error

    monkeypatch.setattr(request_routes, "create_asset_loan_request", raise_error)

    status_code, response_json_body = asyncio.run(
        post_json(
            fastapi_app,
            "/api/requests",
            {
            "asset_id": 1,
            "requester_name": "山田 太郎",
            "start_date": "2026-08-10",
            "end_date": "2026-08-12",
            "reason": "客先デモ利用",
            "quantity": 2,
            },
        )
    )

    assert status_code == HTTPStatus.INTERNAL_SERVER_ERROR
    assert response_json_body == {
        "success": False,
        "data": None,
        "error": {
            "code": "LOAN_REQUEST_SUBMIT_FAILED",
            "message": ERROR_500_LOAN_REQUEST_SUBMIT_FAILED,
            "details": None,
        },
    }


def test_list_active_asset_loan_requests_returns_only_current_user_pending_approved_rejected_and_loaned_in_sorted_order(
    db_session,
) -> None:
    db_session.add_all(
        [
            make_asset_record(asset_id=1, name="ノートPC", category="PC"),
            make_asset_record(asset_id=2, name="USBハブ", category="周辺機器"),
            make_loan_request_record(
                request_id=11,
                asset_id=1,
                user_id=1,
                status=AssetLoanRequestStatus.loaned,
                end_date=date(2026, 8, 5),
            ),
            make_loan_request_record(
                request_id=12,
                asset_id=2,
                user_id=1,
                status=AssetLoanRequestStatus.pending,
                end_date=date(2026, 8, 3),
                quantity=2,
            ),
            make_loan_request_record(
                request_id=13,
                asset_id=1,
                user_id=1,
                status=AssetLoanRequestStatus.returned,
                end_date=date(2026, 8, 1),
            ),
            make_loan_request_record(
                request_id=14,
                asset_id=2,
                user_id=2,
                status=AssetLoanRequestStatus.loaned,
                end_date=date(2026, 8, 2),
            ),
            make_loan_request_record(
                request_id=15,
                asset_id=1,
                user_id=1,
                status=AssetLoanRequestStatus.rejected,
                end_date=date(2026, 8, 3),
            ),
            make_loan_request_record(
                request_id=16,
                asset_id=1,
                user_id=1,
                status=AssetLoanRequestStatus.approved,
                end_date=date(2026, 8, 3),
            ),
        ]
    )
    db_session.commit()

    rows = list_active_asset_loan_requests(db_session, 1)

    assert len(rows) == 4
    assert [asset_loan_request.id for asset_loan_request, _ in rows] == [12, 15, 16, 11]
    assert all(
        asset_loan_request.status in {
            AssetLoanRequestStatus.pending,
            AssetLoanRequestStatus.approved,
            AssetLoanRequestStatus.rejected,
            AssetLoanRequestStatus.loaned,
        }
        for asset_loan_request, _ in rows
    )
    assert all(asset_loan_request.user_id == 1 for asset_loan_request, _ in rows)
    assert [(asset_loan_request.asset_id, asset.id) for asset_loan_request, asset in rows] == [
        (2, 2),
        (1, 1),
        (1, 1),
        (1, 1),
    ]
    assert all(isinstance(asset_loan_request, AssetLoanRequest) for asset_loan_request, _ in rows)
    assert all(isinstance(asset, Asset) for _, asset in rows)


def test_list_admin_active_asset_loan_requests_returns_all_users_pending_approved_rejected_and_loaned(
    db_session,
) -> None:
    db_session.add_all(
        [
            make_asset_record(asset_id=1, name="ノートPC", category="PC"),
            make_asset_record(asset_id=2, name="USBハブ", category="周辺機器"),
            make_loan_request_record(
                request_id=31,
                asset_id=1,
                user_id=1,
                status=AssetLoanRequestStatus.pending,
                end_date=date(2026, 8, 3),
            ),
            make_loan_request_record(
                request_id=32,
                asset_id=2,
                user_id=2,
                status=AssetLoanRequestStatus.approved,
                end_date=date(2026, 8, 2),
            ),
            make_loan_request_record(
                request_id=33,
                asset_id=1,
                user_id=3,
                status=AssetLoanRequestStatus.rejected,
                end_date=date(2026, 8, 1),
            ),
        ]
    )
    db_session.commit()

    rows = list_admin_active_asset_loan_requests(db_session)

    assert [asset_loan_request.id for asset_loan_request, _ in rows] == [33, 32, 31]
    assert all(
        asset_loan_request.status in {
            AssetLoanRequestStatus.pending,
            AssetLoanRequestStatus.approved,
            AssetLoanRequestStatus.rejected,
            AssetLoanRequestStatus.loaned,
        }
        for asset_loan_request, _ in rows
    )


def test_approve_asset_loan_request_updates_pending_to_approved(
    db_session,
) -> None:
    db_session.add(
        make_loan_request_record(
            request_id=41,
            asset_id=1,
            user_id=1,
            status=AssetLoanRequestStatus.pending,
        )
    )
    db_session.commit()

    updated = approve_asset_loan_request(db_session, 41)

    assert updated.status == AssetLoanRequestStatus.approved
    assert db_session.get(AssetLoanRequest, 41).status == AssetLoanRequestStatus.approved


def test_start_approved_asset_loan_request_updates_approved_to_loaned(
    db_session,
) -> None:
    db_session.add(
        make_loan_request_record(
            request_id=44,
            asset_id=1,
            user_id=1,
            status=AssetLoanRequestStatus.approved,
        )
    )
    db_session.commit()

    updated = start_approved_asset_loan_request(db_session, 44, 1)

    assert updated.status == AssetLoanRequestStatus.loaned
    assert db_session.get(AssetLoanRequest, 44).status == AssetLoanRequestStatus.loaned


def test_start_approved_asset_loan_request_raises_conflict_when_status_is_not_approved(
    db_session,
) -> None:
    db_session.add(
        make_loan_request_record(
            request_id=45,
            asset_id=1,
            user_id=1,
            status=AssetLoanRequestStatus.pending,
        )
    )
    db_session.commit()

    with pytest.raises(AssetLoanRequestStartLoanError) as exc_info:
        start_approved_asset_loan_request(db_session, 45, 1)

    assert exc_info.value.status_code == HTTPStatus.CONFLICT


def test_reject_asset_loan_request_updates_pending_to_rejected(
    db_session,
) -> None:
    db_session.add(
        make_loan_request_record(
            request_id=42,
            asset_id=1,
            user_id=1,
            status=AssetLoanRequestStatus.pending,
        )
    )
    db_session.commit()

    updated = reject_asset_loan_request(db_session, 42)

    assert updated.status == AssetLoanRequestStatus.rejected
    assert db_session.get(AssetLoanRequest, 42).status == AssetLoanRequestStatus.rejected


def test_reject_asset_loan_request_updates_approved_to_rejected(
    db_session,
) -> None:
    db_session.add(
        make_loan_request_record(
            request_id=46,
            asset_id=1,
            user_id=1,
            status=AssetLoanRequestStatus.approved,
        )
    )
    db_session.commit()

    updated = reject_asset_loan_request(db_session, 46)

    assert updated.status == AssetLoanRequestStatus.rejected
    assert db_session.get(AssetLoanRequest, 46).status == AssetLoanRequestStatus.rejected


def test_force_return_asset_loan_request_updates_loaned_to_returned(
    db_session,
) -> None:
    db_session.add(
        make_loan_request_record(
            request_id=43,
            asset_id=1,
            user_id=1,
            status=AssetLoanRequestStatus.loaned,
        )
    )
    db_session.commit()

    updated = force_return_asset_loan_request(db_session, 43)

    assert updated.status == AssetLoanRequestStatus.returned
    assert updated.returned_at is not None
    assert db_session.get(AssetLoanRequest, 43).status == AssetLoanRequestStatus.returned


def test_list_my_active_requests_returns_active_asset_loan_request_read_list(monkeypatch: pytest.MonkeyPatch) -> None:
    active_request_rows = [
        (
            make_loan_request_record(
                request_id=21,
                asset_id=3,
                user_id=1,
                status=AssetLoanRequestStatus.pending,
                requester_name="山田太郎",
                start_date=date(2026, 8, 1),
                end_date=date(2026, 8, 10),
                reason="検証",
                quantity=1,
            ),
            make_asset_record(asset_id=3, name="iPad", category="タブレット"),
        ),
        (
            make_loan_request_record(
                request_id=22,
                asset_id=4,
                user_id=1,
                status=AssetLoanRequestStatus.loaned,
                requester_name="山田太郎",
                start_date=date(2026, 8, 2),
                end_date=date(2026, 8, 12),
                reason="商談",
                quantity=2,
            ),
            make_asset_record(asset_id=4, name="プロジェクター", category="会議用品"),
        ),
    ]
    monkeypatch.setattr(request_routes, "list_active_asset_loan_requests", lambda db, user_id: active_request_rows)

    response = request_routes.list_my_active_requests(db=None, current_user=make_current_user())

    assert response["success"] is True
    assert response["error"] is None
    data = response["data"]
    assert isinstance(data, list)
    assert [item.id for item in data] == [21, 22]
    assert all(isinstance(item, ActiveAssetLoanRequestRead) for item in data)
    assert data[0].asset_name == "iPad"
    assert data[0].asset_category == "タブレット"
    assert data[0].status == AssetLoanRequestStatus.pending
    assert data[1].asset_name == "プロジェクター"
    assert data[1].asset_category == "会議用品"
    assert data[1].status == AssetLoanRequestStatus.loaned
    assert data[0].asset_id == 3
    assert data[0].requester_name == "山田太郎"
    assert data[0].quantity == 1
    assert data[1].asset_id == 4
    assert data[1].requester_name == "山田太郎"
    assert data[1].quantity == 2


def test_list_my_active_requests_returns_empty_success_response_when_no_rows(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(request_routes, "list_active_asset_loan_requests", lambda db, user_id: [])

    response = request_routes.list_my_active_requests(db=None, current_user=make_current_user())

    assert response == {"success": True, "data": [], "error": None}


@pytest.mark.parametrize(
    ("raised_error", "expected_exception_type", "expected_status", "expected_message"),
    [
        pytest.param(
            TimeoutError("timeout"),
            GatewayTimeoutError,
            HTTPStatus.GATEWAY_TIMEOUT,
            ERROR_504_ACTIVE_REQUESTS_FETCH_FAILED,
            id="B-MR-004",
        ),
        pytest.param(
            ConnectionError("connection"),
            ServiceUnavailableError,
            HTTPStatus.SERVICE_UNAVAILABLE,
            ERROR_503_ACTIVE_REQUESTS_FETCH_FAILED,
            id="B-MR-005",
        ),
    ],
)
def test_list_my_active_requests_raises_http_exceptions_for_timeout_and_connection_errors(
    monkeypatch: pytest.MonkeyPatch,
    raised_error: Exception,
    expected_exception_type: type[Exception],
    expected_status: HTTPStatus,
    expected_message: str,
) -> None:
    def raise_error(db, user_id):
        raise raised_error

    monkeypatch.setattr(request_routes, "list_active_asset_loan_requests", raise_error)

    with pytest.raises(expected_exception_type) as exc_info:
        request_routes.list_my_active_requests(db=None, current_user=make_current_user())

    assert exc_info.value.status_code == expected_status
    assert exc_info.value.message == expected_message


def test_list_my_active_requests_returns_json_error_for_unexpected_exception(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def raise_error(db, user_id):
        raise Exception("unexpected")

    monkeypatch.setattr(request_routes, "list_active_asset_loan_requests", raise_error)

    response = request_routes.list_my_active_requests(db=None, current_user=make_current_user())

    assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
    assert response_json(response) == {
        "success": False,
        "data": None,
        "error": {
            "code": "ACTIVE_REQUESTS_FETCH_FAILED",
            "message": ERROR_500_ACTIVE_REQUESTS_FETCH_FAILED,
            "details": None,
        },
    }


def test_return_asset_loan_request_updates_loaned_request_to_returned(db_session, loan_request_factory) -> None:
    loan_request = loan_request_factory(
        asset_id=1,
        quantity=1,
        status=AssetLoanRequestStatus.loaned,
        user_id=1,
        requester_name="返却対象",
        start_date=date(2026, 8, 1),
        end_date=date(2026, 8, 10),
        reason="返却確認",
    )
    expected_values = {
        "id": loan_request.id,
        "asset_id": loan_request.asset_id,
        "user_id": loan_request.user_id,
        "requester_name": loan_request.requester_name,
        "start_date": loan_request.start_date,
        "end_date": loan_request.end_date,
        "reason": loan_request.reason,
        "quantity": loan_request.quantity,
    }
    db_session.commit()

    returned = return_asset_loan_request(db_session, expected_values["id"], 1)
    persisted = db_session.get(AssetLoanRequest, expected_values["id"])

    assert isinstance(returned, AssetLoanRequest)
    assert returned.status == AssetLoanRequestStatus.returned
    assert returned.returned_at is not None
    assert persisted is not None
    assert persisted.status == AssetLoanRequestStatus.returned
    assert persisted.returned_at is not None
    for field_name, expected_value in expected_values.items():
        assert getattr(returned, field_name) == expected_value
        assert getattr(persisted, field_name) == expected_value


@pytest.mark.parametrize(
    ("setup_request", "request_id", "user_id"),
    [
        pytest.param(None, 31, 1, id="B-MR-008"),
        pytest.param(
            make_loan_request_record(
                request_id=31,
                asset_id=1,
                user_id=2,
                status=AssetLoanRequestStatus.loaned,
            ),
            31,
            1,
            id="B-MR-009",
        ),
    ],
)
def test_return_asset_loan_request_raises_not_found_for_missing_or_other_users_request(
    db_session,
    setup_request: AssetLoanRequest | None,
    request_id: int,
    user_id: int,
) -> None:
    if setup_request is not None:
        db_session.add(setup_request)
        db_session.commit()

    with pytest.raises(ActiveAssetLoanRequestNotFoundError) as exc_info:
        return_asset_loan_request(db_session, request_id, user_id)

    assert exc_info.value.status_code == HTTPStatus.NOT_FOUND
    assert exc_info.value.code == "ACTIVE_REQUEST_NOT_FOUND"
    assert exc_info.value.message == "対象の貸出申請が見つかりません。"


def test_return_asset_loan_request_raises_conflict_when_status_is_not_loaned(
    db_session,
    loan_request_factory,
) -> None:
    loan_request = loan_request_factory(
        asset_id=1,
        quantity=1,
        status=AssetLoanRequestStatus.pending,
        user_id=1,
    )
    request_id = loan_request.id
    db_session.commit()

    with pytest.raises(AssetLoanRequestReturnError) as exc_info:
        return_asset_loan_request(db_session, request_id, 1)

    assert exc_info.value.status_code == HTTPStatus.CONFLICT
    assert exc_info.value.code == "ASSET_LOAN_REQUEST_NOT_RETURNABLE"
    assert exc_info.value.message == "貸出中の備品のみ返却できます。"


def test_return_request_returns_success_response_with_asset_loan_request_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    returned_at = datetime(2026, 8, 10, 18, 30, tzinfo=JST)
    asset_loan_request = make_loan_request_record(
        request_id=31,
        asset_id=3,
        user_id=1,
        status=AssetLoanRequestStatus.returned,
        requester_name="山田太郎",
        start_date=date(2026, 8, 1),
        end_date=date(2026, 8, 10),
        reason="検証",
        quantity=1,
        returned_at=returned_at,
    )
    monkeypatch.setattr(request_routes, "return_asset_loan_request", lambda db, request_id, user_id: asset_loan_request)

    response = request_routes.return_request(31, db=None, current_user=make_current_user())

    assert response["success"] is True
    assert response["error"] is None
    data = response["data"]
    assert isinstance(data, AssetLoanRequestRead)
    assert data.id == 31
    assert data.asset_id == 3
    assert data.user_id == 1
    assert data.requester_name == "山田太郎"
    assert data.quantity == 1
    assert data.status == AssetLoanRequestStatus.returned
    assert data.returned_at == returned_at


@pytest.mark.parametrize(
    ("raised_error", "expected_status", "expected_code", "expected_message"),
    [
        pytest.param(
            ActiveAssetLoanRequestNotFoundError("対象の貸出申請が見つかりません。"),
            HTTPStatus.NOT_FOUND,
            "ACTIVE_REQUEST_NOT_FOUND",
            "対象の貸出申請が見つかりません。",
            id="B-MR-012",
        ),
        pytest.param(
            AssetLoanRequestReturnError("貸出中の備品のみ返却できます。"),
            HTTPStatus.CONFLICT,
            "ASSET_LOAN_REQUEST_NOT_RETURNABLE",
            "貸出中の備品のみ返却できます。",
            id="B-MR-013",
        ),
    ],
)
def test_return_request_converts_business_errors_to_json_response(
    monkeypatch: pytest.MonkeyPatch,
    raised_error: Exception,
    expected_status: HTTPStatus,
    expected_code: str,
    expected_message: str,
) -> None:
    def raise_error(db, request_id, user_id):
        raise raised_error

    monkeypatch.setattr(request_routes, "return_asset_loan_request", raise_error)

    response = request_routes.return_request(31, db=None, current_user=make_current_user())

    assert response.status_code == expected_status
    assert response_json(response) == {
        "success": False,
        "data": None,
        "error": {
            "code": expected_code,
            "message": expected_message,
            "details": None,
        },
    }


@pytest.mark.parametrize(
    ("raised_error", "expected_exception_type", "expected_status", "expected_message"),
    [
        pytest.param(
            TimeoutError("timeout"),
            GatewayTimeoutError,
            HTTPStatus.GATEWAY_TIMEOUT,
            ERROR_504_RETURN_REQUEST_FAILED,
            id="B-MR-014",
        ),
        pytest.param(
            ConnectionError("connection"),
            ServiceUnavailableError,
            HTTPStatus.SERVICE_UNAVAILABLE,
            ERROR_503_RETURN_REQUEST_FAILED,
            id="B-MR-015",
        ),
    ],
)
def test_return_request_raises_http_exceptions_for_timeout_and_connection_errors(
    monkeypatch: pytest.MonkeyPatch,
    raised_error: Exception,
    expected_exception_type: type[Exception],
    expected_status: HTTPStatus,
    expected_message: str,
) -> None:
    def raise_error(db, request_id, user_id):
        raise raised_error

    monkeypatch.setattr(request_routes, "return_asset_loan_request", raise_error)

    with pytest.raises(expected_exception_type) as exc_info:
        request_routes.return_request(31, db=None, current_user=make_current_user())

    assert exc_info.value.status_code == expected_status
    assert exc_info.value.message == expected_message


def test_return_request_returns_json_error_for_unexpected_exception(monkeypatch: pytest.MonkeyPatch) -> None:
    def raise_error(db, request_id, user_id):
        raise Exception("unexpected")

    monkeypatch.setattr(request_routes, "return_asset_loan_request", raise_error)

    response = request_routes.return_request(31, db=None, current_user=make_current_user())

    assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
    assert response_json(response) == {
        "success": False,
        "data": None,
        "error": {
            "code": "RETURN_REQUEST_FAILED",
            "message": ERROR_500_RETURN_REQUEST_FAILED,
            "details": None,
        },
    }


def test_cancel_asset_loan_request_updates_pending_request_to_cancelled(
    db_session,
    loan_request_factory,
) -> None:
    loan_request = loan_request_factory(
        asset_id=1,
        quantity=2,
        status=AssetLoanRequestStatus.pending,
        user_id=1,
        requester_name="キャンセル対象",
        start_date=date(2026, 8, 2),
        end_date=date(2026, 8, 12),
        reason="商談",
    )
    expected_values = {
        "id": loan_request.id,
        "asset_id": loan_request.asset_id,
        "user_id": loan_request.user_id,
        "requester_name": loan_request.requester_name,
        "start_date": loan_request.start_date,
        "end_date": loan_request.end_date,
        "reason": loan_request.reason,
        "quantity": loan_request.quantity,
        "returned_at": loan_request.returned_at,
    }
    db_session.commit()

    cancelled = cancel_asset_loan_request(db_session, expected_values["id"], 1)
    persisted = db_session.get(AssetLoanRequest, expected_values["id"])

    assert isinstance(cancelled, AssetLoanRequest)
    assert cancelled.status == AssetLoanRequestStatus.cancelled
    assert persisted is not None
    assert persisted.status == AssetLoanRequestStatus.cancelled
    for field_name, expected_value in expected_values.items():
        assert getattr(cancelled, field_name) == expected_value
        assert getattr(persisted, field_name) == expected_value


@pytest.mark.parametrize(
    ("setup_request", "request_id", "user_id"),
    [
        pytest.param(None, 41, 1, id="B-MR-018"),
        pytest.param(
            make_loan_request_record(
                request_id=41,
                asset_id=1,
                user_id=2,
                status=AssetLoanRequestStatus.pending,
            ),
            41,
            1,
            id="B-MR-019",
        ),
    ],
)
def test_cancel_asset_loan_request_raises_not_found_for_missing_or_other_users_request(
    db_session,
    setup_request: AssetLoanRequest | None,
    request_id: int,
    user_id: int,
) -> None:
    if setup_request is not None:
        db_session.add(setup_request)
        db_session.commit()

    with pytest.raises(ActiveAssetLoanRequestNotFoundError) as exc_info:
        cancel_asset_loan_request(db_session, request_id, user_id)

    assert exc_info.value.status_code == HTTPStatus.NOT_FOUND
    assert exc_info.value.code == "ACTIVE_REQUEST_NOT_FOUND"
    assert exc_info.value.message == "対象の貸出申請が見つかりません。"


def test_cancel_asset_loan_request_raises_conflict_when_status_is_not_pending_or_rejected(
    db_session,
    loan_request_factory,
) -> None:
    loan_request = loan_request_factory(
        asset_id=1,
        quantity=1,
        status=AssetLoanRequestStatus.loaned,
        user_id=1,
    )
    request_id = loan_request.id
    db_session.commit()

    with pytest.raises(AssetLoanRequestCancelError) as exc_info:
        cancel_asset_loan_request(db_session, request_id, 1)

    assert exc_info.value.status_code == HTTPStatus.CONFLICT
    assert exc_info.value.code == "ASSET_LOAN_REQUEST_NOT_CANCELABLE"
    assert exc_info.value.message == "承認待ちまたは承認却下の申請のみキャンセルできます。"


def test_cancel_request_returns_success_response_with_asset_loan_request_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    asset_loan_request = make_loan_request_record(
        request_id=41,
        asset_id=4,
        user_id=1,
        status=AssetLoanRequestStatus.cancelled,
        requester_name="山田太郎",
        start_date=date(2026, 8, 2),
        end_date=date(2026, 8, 12),
        reason="商談",
        quantity=2,
        returned_at=None,
    )
    monkeypatch.setattr(request_routes, "cancel_asset_loan_request", lambda db, request_id, user_id: asset_loan_request)

    response = request_routes.cancel_request(41, db=None, current_user=make_current_user())

    assert response["success"] is True
    assert response["error"] is None
    data = response["data"]
    assert isinstance(data, AssetLoanRequestRead)
    assert data.id == 41
    assert data.asset_id == 4
    assert data.user_id == 1
    assert data.requester_name == "山田太郎"
    assert data.quantity == 2
    assert data.status == AssetLoanRequestStatus.cancelled
    assert data.returned_at is None


@pytest.mark.parametrize(
    ("raised_error", "expected_status", "expected_code", "expected_message"),
    [
        pytest.param(
            ActiveAssetLoanRequestNotFoundError("対象の貸出申請が見つかりません。"),
            HTTPStatus.NOT_FOUND,
            "ACTIVE_REQUEST_NOT_FOUND",
            "対象の貸出申請が見つかりません。",
            id="B-MR-022",
        ),
        pytest.param(
            AssetLoanRequestCancelError("承認待ちの申請のみキャンセルできます。"),
            HTTPStatus.CONFLICT,
            "ASSET_LOAN_REQUEST_NOT_CANCELABLE",
            "承認待ちの申請のみキャンセルできます。",
            id="B-MR-023",
        ),
    ],
)
def test_cancel_request_converts_business_errors_to_json_response(
    monkeypatch: pytest.MonkeyPatch,
    raised_error: Exception,
    expected_status: HTTPStatus,
    expected_code: str,
    expected_message: str,
) -> None:
    def raise_error(db, request_id, user_id):
        raise raised_error

    monkeypatch.setattr(request_routes, "cancel_asset_loan_request", raise_error)

    response = request_routes.cancel_request(41, db=None, current_user=make_current_user())

    assert response.status_code == expected_status
    assert response_json(response) == {
        "success": False,
        "data": None,
        "error": {
            "code": expected_code,
            "message": expected_message,
            "details": None,
        },
    }


@pytest.mark.parametrize(
    ("raised_error", "expected_exception_type", "expected_status", "expected_message"),
    [
        pytest.param(
            TimeoutError("timeout"),
            GatewayTimeoutError,
            HTTPStatus.GATEWAY_TIMEOUT,
            ERROR_504_CANCEL_REQUEST_FAILED,
            id="B-MR-024",
        ),
        pytest.param(
            ConnectionError("connection"),
            ServiceUnavailableError,
            HTTPStatus.SERVICE_UNAVAILABLE,
            ERROR_503_CANCEL_REQUEST_FAILED,
            id="B-MR-025",
        ),
    ],
)
def test_cancel_request_raises_http_exceptions_for_timeout_and_connection_errors(
    monkeypatch: pytest.MonkeyPatch,
    raised_error: Exception,
    expected_exception_type: type[Exception],
    expected_status: HTTPStatus,
    expected_message: str,
) -> None:
    def raise_error(db, request_id, user_id):
        raise raised_error

    monkeypatch.setattr(request_routes, "cancel_asset_loan_request", raise_error)

    with pytest.raises(expected_exception_type) as exc_info:
        request_routes.cancel_request(41, db=None, current_user=make_current_user())

    assert exc_info.value.status_code == expected_status
    assert exc_info.value.message == expected_message


def test_cancel_request_returns_json_error_for_unexpected_exception(monkeypatch: pytest.MonkeyPatch) -> None:
    def raise_error(db, request_id, user_id):
        raise Exception("unexpected")

    monkeypatch.setattr(request_routes, "cancel_asset_loan_request", raise_error)

    response = request_routes.cancel_request(41, db=None, current_user=make_current_user())

    assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
    assert response_json(response) == {
        "success": False,
        "data": None,
        "error": {
            "code": "CANCEL_REQUEST_FAILED",
            "message": ERROR_500_CANCEL_REQUEST_FAILED,
            "details": None,
        },
    }
