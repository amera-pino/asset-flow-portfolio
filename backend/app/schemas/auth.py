from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    login_id: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=120)


class LoginUser(BaseModel):
    id: int
    name: str
    login_id: str
    role: str
    session_token: str | None = None


class AuthStatus(BaseModel):
    status: str
