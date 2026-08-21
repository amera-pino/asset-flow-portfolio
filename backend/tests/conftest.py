import sys
from collections.abc import Callable, Generator
from datetime import date, datetime
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.constants.enums import AssetLoanRequestStatus, AssetStatus  # noqa: E402
from app.core.database import Base  # noqa: E402
from app.models.asset import Asset  # noqa: E402
from app.models.asset_loan_request import AssetLoanRequest  # noqa: E402
from app.models.user import User  # noqa: E402


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    session = session_local()

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture
def asset_factory(db_session: Session) -> Callable[..., Asset]:
    def factory(
        *,
        name: str,
        category: str,
        total_stock: int,
        status: AssetStatus = AssetStatus.available,
        created_at: datetime,
        updated_at: datetime,
    ) -> Asset:
        asset = Asset(
            name=name,
            category=category,
            total_stock=total_stock,
            status=status,
            created_at=created_at,
            updated_at=updated_at,
        )
        db_session.add(asset)
        db_session.flush()
        return asset

    return factory


@pytest.fixture
def loan_request_factory(db_session: Session) -> Callable[..., AssetLoanRequest]:
    def factory(
        *,
        asset_id: int,
        quantity: int,
        status: AssetLoanRequestStatus,
        requester_name: str = "テスト申請者",
        user_id: int = 1,
        start_date: date = date(2026, 7, 31),
        end_date: date = date(2026, 8, 1),
        reason: str = "テスト理由",
    ) -> AssetLoanRequest:
        loan_request = AssetLoanRequest(
            asset_id=asset_id,
            requester_name=requester_name,
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
            reason=reason,
            quantity=quantity,
            status=status,
        )
        db_session.add(loan_request)
        db_session.flush()
        return loan_request

    return factory


@pytest.fixture
def user_factory(db_session: Session) -> Callable[..., User]:
    def factory(
        *,
        id: int,
        name: str,
        login_id: str,
        password_hash: str,
        role: str = "user",
        department: str | None = None,
    ) -> User:
        user = User(
            id=id,
            name=name,
            login_id=login_id,
            password_hash=password_hash,
            role=role,
            department=department,
        )
        db_session.add(user)
        db_session.flush()
        return user

    return factory
