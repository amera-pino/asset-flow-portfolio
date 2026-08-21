from http import HTTPStatus
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.constants.enums import AssetLoanRequestStatus
from app.constants.error_messages import (
    ERROR_500_ASSET_CREATE_FAILED,
    ERROR_500_ASSET_DETAIL_FETCH_FAILED,
    ERROR_500_ASSET_LIST_FETCH_FAILED,
    ERROR_500_CATEGORY_LIST_FETCH_FAILED,
    ERROR_ASSET_NOT_FOUND,
)
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.asset import Asset
from app.models.asset_loan_request import AssetLoanRequest
from app.models.user import User
from app.schemas.asset import AssetCreate, AssetPage, AssetRow
from app.schemas.response import ApiResponse, error_response, success_response

router = APIRouter(prefix="/assets", tags=["assets"])
ASSET_PAGE_SIZE = 20
CONSUMING_STATUSES = (
    AssetLoanRequestStatus.pending,
    AssetLoanRequestStatus.approved,
    AssetLoanRequestStatus.loaned,
)


# 消費中数量集計サブクエリ作成
def build_consuming_quantity_subquery():
    return (
        select(
            AssetLoanRequest.asset_id,
            func.coalesce(func.sum(AssetLoanRequest.quantity), 0).label("consuming_quantity"),
        )
        .where(AssetLoanRequest.status.in_(CONSUMING_STATUSES))
        .group_by(AssetLoanRequest.asset_id)
        .subquery()
    )


# 備品一覧表示用データ作成
def build_asset_row(asset: Asset, consuming_quantity: int | None) -> AssetRow:
    consuming_quantity_value = int(consuming_quantity or 0)

    return AssetRow(
        id=asset.id,
        name=asset.name,
        category=asset.category,
        status=asset.status,
        total_stock=asset.total_stock,
        consuming_quantity=consuming_quantity_value,
        effective_stock=max(asset.total_stock - consuming_quantity_value, 0),
        created_at=asset.created_at,
        updated_at=asset.updated_at,
    )


@router.post("", response_model=ApiResponse[AssetRow], status_code=HTTPStatus.CREATED)
def create_asset(
    payload: AssetCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict | JSONResponse:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=HTTPStatus.FORBIDDEN,
            detail="管理者権限が必要です。",
        )

    try:
        existing_asset = db.scalar(
            select(Asset).where(
                Asset.name == payload.name.strip(),
                Asset.category == payload.category.strip(),
            )
        )
        if existing_asset is not None:
            return JSONResponse(
                status_code=HTTPStatus.CONFLICT,
                content=error_response(
                    "ASSET_ALREADY_EXISTS",
                    "同じカテゴリ・同じ備品名の備品は登録できません。",
                ),
            )

        asset = Asset(
            name=payload.name.strip(),
            category=payload.category.strip(),
            total_stock=payload.total_stock,
            status=payload.status,
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)
    except SQLAlchemyError:
        db.rollback()
        return JSONResponse(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            content=error_response(
                "ASSET_CREATE_FAILED",
                ERROR_500_ASSET_CREATE_FAILED,
            ),
        )

    return success_response(build_asset_row(asset, 0))


# 備品一覧取得
@router.get("", response_model=ApiResponse[AssetPage])
def list_assets(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    category: Annotated[str | None, Query(min_length=1, max_length=80)] = None,
    q: Annotated[str | None, Query(min_length=1, max_length=60)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    sort: Annotated[str | None, Query(pattern="^(name_asc|name_desc)$")] = None,
) -> dict | JSONResponse:
    try:
        # SQL 組み立てブロック
        filters = []
        if category:
            filters.append(Asset.category == category)

        if q:
            filters.append(Asset.name.ilike(f"%{q}%"))

        consuming_quantity_subquery = build_consuming_quantity_subquery()
        consuming_quantity = func.coalesce(consuming_quantity_subquery.c.consuming_quantity, 0)
        order_by_columns = (
            [Asset.name.asc(), Asset.id.asc()]
            if sort == "name_asc"
            else [Asset.name.desc(), Asset.id.desc()]
            if sort == "name_desc"
            else [Asset.created_at.desc(), Asset.id.desc()]
        )

        statement = (
            select(
                Asset,
                consuming_quantity.label("consuming_quantity"),
            )
            .outerjoin(consuming_quantity_subquery, consuming_quantity_subquery.c.asset_id == Asset.id)
            .where(*filters)
            .order_by(*order_by_columns)
            .limit(ASSET_PAGE_SIZE)
            .offset((page - 1) * ASSET_PAGE_SIZE)
        )

        # 件数計算ブロック
        filtered_item_count = db.scalar(select(func.count()).select_from(Asset).where(*filters)) or 0
        total_item_count = db.scalar(select(func.count()).select_from(Asset)) or 0
        total_item_stock = db.scalar(select(func.coalesce(func.sum(Asset.total_stock), 0)).select_from(Asset)) or 0
        total_effective_stock = (
            db.scalar(
                select(func.coalesce(func.sum(Asset.total_stock - consuming_quantity), 0))
                .select_from(Asset)
                .outerjoin(consuming_quantity_subquery, consuming_quantity_subquery.c.asset_id == Asset.id)
            )
            or 0
        )
        low_stock_item_count = (
            db.scalar(
                select(func.count())
                .select_from(Asset)
                .outerjoin(consuming_quantity_subquery, consuming_quantity_subquery.c.asset_id == Asset.id)
                .where((Asset.total_stock - consuming_quantity) <= 5)
            )
            or 0
        )
        total_pages = max((filtered_item_count + ASSET_PAGE_SIZE - 1) // ASSET_PAGE_SIZE, 1)

        # 一覧データ取得・レスポンス生成ブロック
        assets = []
        for asset, consuming_quantity_value in db.execute(statement).all():
            assets.append(build_asset_row(asset, consuming_quantity_value))

        return success_response(
            AssetPage(
                items=assets,
                filtered_item_count=filtered_item_count,
                total_item_count=total_item_count,
                total_item_stock=total_item_stock,
                total_effective_stock=int(total_effective_stock),
                low_stock_item_count=low_stock_item_count,
                page=page,
                page_size=ASSET_PAGE_SIZE,
                total_pages=total_pages,
            )
        )
    except SQLAlchemyError:
        return JSONResponse(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            content=error_response(
                "ASSET_LIST_FETCH_FAILED",
                ERROR_500_ASSET_LIST_FETCH_FAILED,
            ),
        )


# 備品カテゴリ一覧取得
@router.get("/categories", response_model=ApiResponse[list[str]])
def list_asset_categories(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict | JSONResponse:
    try:
        categories = db.scalars(select(Asset.category).distinct().order_by(Asset.category.asc())).all()
    except SQLAlchemyError:
        return JSONResponse(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            content=error_response(
                "CATEGORY_LIST_FETCH_FAILED",
                ERROR_500_CATEGORY_LIST_FETCH_FAILED,
            ),
        )

    return success_response(list(categories))


# 備品詳細取得
@router.get("/{asset_id}", response_model=ApiResponse[AssetRow])
def get_asset(
    asset_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict | JSONResponse:
    try:
        consuming_quantity_subquery = build_consuming_quantity_subquery()
        consuming_quantity = func.coalesce(consuming_quantity_subquery.c.consuming_quantity, 0)

        statement = (
            select(
                Asset,
                consuming_quantity.label("consuming_quantity"),
            )
            .outerjoin(consuming_quantity_subquery, consuming_quantity_subquery.c.asset_id == Asset.id)
            .where(Asset.id == asset_id)
        )

        row = db.execute(statement).one_or_none()
        if row is None:
            return JSONResponse(
                status_code=HTTPStatus.NOT_FOUND,
                content=error_response("ASSET_NOT_FOUND", ERROR_ASSET_NOT_FOUND),
            )
    except SQLAlchemyError:
        return JSONResponse(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            content=error_response(
                "ASSET_DETAIL_FETCH_FAILED",
                ERROR_500_ASSET_DETAIL_FETCH_FAILED,
            ),
        )

    asset, consuming_quantity_value = row
    return success_response(build_asset_row(asset, consuming_quantity_value))
