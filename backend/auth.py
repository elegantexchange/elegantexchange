"""JWT auth utilities and role guards."""
import os
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import Callable, Iterable

from fastapi import HTTPException, Request, Depends

JWT_ALGORITHM = "HS256"

ROLES = ("admin", "manager", "retail")
ROLE_ALIASES = {
    "owner": "admin",
    "staff": "retail",
    "admin": "admin",
    "manager": "manager",
    "retail": "retail",
}


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def normalize_role(role: str | None) -> str:
    key = (role or "").lower().strip()
    return ROLE_ALIASES.get(key, "retail")


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": normalize_role(role),
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def public_user(user: dict) -> dict:
    """Strip secrets and normalize role / onboarding fields for API responses."""
    role = normalize_role(user.get("role"))
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user.get("name") or "",
        "role": role,
        "phone": user.get("phone") or "",
        "must_change_password": bool(user.get("must_change_password")),
        "onboarding_completed_at": user.get("onboarding_completed_at"),
        "product_tour_completed_at": user.get("product_tour_completed_at"),
    }


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        token = request.query_params.get("token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    db = request.app.state.db
    user = await db.users.find_one({"id": payload["sub"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user.pop("_id", None)
    user.pop("password_hash", None)
    user["role"] = normalize_role(user.get("role"))
    return user


def has_role(user: dict, *roles: str) -> bool:
    role = normalize_role(user.get("role"))
    allowed = {normalize_role(r) for r in roles}
    return role in allowed


def is_admin(user: dict) -> bool:
    return has_role(user, "admin")


def is_manager_or_admin(user: dict) -> bool:
    return has_role(user, "admin", "manager")


def require_roles(*roles: str) -> Callable:
    """FastAPI dependency factory: user must have one of the given roles."""

    async def _dependency(user: dict = Depends(get_current_user)) -> dict:
        if not has_role(user, *roles):
            labels = ", ".join(roles)
            raise HTTPException(
                status_code=403, detail=f"Requires one of: {labels}"
            )
        return user

    return _dependency


# Back-compat aliases used during migration
def is_owner(user: dict) -> bool:
    return is_admin(user)


async def require_owner(user: dict = Depends(get_current_user)) -> dict:
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def migrate_user_roles(db) -> None:
    """Normalize legacy owner/staff roles and grandfather existing accounts."""
    now = datetime.now(timezone.utc).isoformat()
    async for doc in db.users.find({}):
        updates = {}
        raw = doc.get("role")
        normalized = normalize_role(raw)
        if raw != normalized:
            updates["role"] = normalized
        # Existing accounts without onboarding flags skip the wizard once
        if doc.get("onboarding_completed_at") is None and not doc.get(
            "must_change_password"
        ):
            updates["onboarding_completed_at"] = now
            updates["must_change_password"] = False
        # Grandfather product tour for existing accounts
        if (
            doc.get("product_tour_completed_at") is None
            and not doc.get("must_change_password")
            and (doc.get("onboarding_completed_at") or updates.get("onboarding_completed_at"))
        ):
            updates["product_tour_completed_at"] = now
        if updates:
            await db.users.update_one({"id": doc["id"]}, {"$set": updates})
