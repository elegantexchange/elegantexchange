"""Authentication routes."""
from fastapi import APIRouter, HTTPException, Request, Response, Depends
from datetime import datetime, timezone
import uuid

from models import LoginReq, UserCreate, UserOut
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    require_owner,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
async def login(req: LoginReq, request: Request, response: Response):
    db = request.app.state.db
    email = req.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user["id"], user["email"], user["role"])
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=60 * 60 * 24 * 7,
        path="/",
    )
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
        },
    }


@router.post("/logout")
async def logout(response: Response, _user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut(
        id=user["id"], email=user["email"], name=user["name"], role=user["role"]
    )


@router.get("/users")
async def list_users(request: Request, _owner: dict = Depends(require_owner)):
    db = request.app.state.db
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users


@router.post("/users")
async def create_user(
    body: UserCreate, request: Request, _owner: dict = Depends(require_owner)
):
    db = request.app.state.db
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": body.name,
        "role": body.role,
        "password_hash": hash_password(body.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str, request: Request, owner: dict = Depends(require_owner)
):
    if user_id == owner["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    db = request.app.state.db
    await db.users.delete_one({"id": user_id})
    return {"ok": True}
