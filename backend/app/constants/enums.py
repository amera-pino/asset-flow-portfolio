from enum import StrEnum


class AssetStatus(StrEnum):
    available = "available"


class AssetLoanRequestStatus(StrEnum):
    pending = "pending"
    approved = "approved"
    loaned = "loaned"
    rejected = "rejected"
    returned = "returned"
    cancelled = "cancelled"
