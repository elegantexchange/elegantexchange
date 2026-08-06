"""Authentication routes."""
from fastapi import APIRouter, HTTPException, Request, Response, Depends
from datetime import datetime, timezone
import uuid

from models import LoginReq, UserCreate, UserOut, UserUpdate, OnboardingReq, ProfileUpdate
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    require_roles,
    public_user,
    normalize_role,
)
from mail import build_invite_email, send_email

router = APIRouter(prefix="/api/auth", tags=["auth"])

PREFERRED_TEAM_DOMAIN = "elegantexchange.co"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.post("/login")
async def login(req: LoginReq, request: Request, response: Response):
    db = request.app.state.db
    email = req.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    role = normalize_role(user.get("role"))
    if user.get("role") != role:
        await db.users.update_one({"id": user["id"]}, {"$set": {"role": role}})
        user["role"] = role

    token = create_access_token(user["id"], user["email"], role)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=60 * 60 * 24 * 7,
        path="/",
    )
    return {"token": token, "user": public_user(user)}


@router.post("/logout")
async def logout(response: Response, _user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut(**public_user(user))


@router.put("/me", response_model=UserOut)
async def update_me(
    body: ProfileUpdate,
    request: Request,
    user: dict = Depends(get_current_user),
):
    db = request.app.state.db
    updates = {}
    if body.name is not None:
        name = body.name.strip()
        if len(name) < 1:
            raise HTTPException(status_code=400, detail="Name is required")
        updates["name"] = name
    if body.phone is not None:
        updates["phone"] = body.phone.strip()
    if body.password is not None:
        if len(body.password) < 8:
            raise HTTPException(
                status_code=400, detail="Password must be at least 8 characters"
            )
        updates["password_hash"] = hash_password(body.password)
        updates["must_change_password"] = False
    if not updates:
        return UserOut(**public_user(user))
    await db.users.update_one({"id": user["id"]}, {"$set": updates})
    fresh = await db.users.find_one({"id": user["id"]})
    return UserOut(**public_user(fresh))


@router.post("/onboarding", response_model=UserOut)
async def complete_onboarding(
    body: OnboardingReq,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if len(body.password) < 8:
        raise HTTPException(
            status_code=400, detail="Password must be at least 8 characters"
        )
    name = body.name.strip()
    if len(name) < 1:
        raise HTTPException(status_code=400, detail="Name is required")
    db = request.app.state.db
    updates = {
        "password_hash": hash_password(body.password),
        "name": name,
        "phone": (body.phone or "").strip(),
        "must_change_password": False,
        "onboarding_completed_at": _now(),
        # Tour starts in-app after essentials — leave incomplete for new members
    }
    await db.users.update_one({"id": user["id"]}, {"$set": updates})
    fresh = await db.users.find_one({"id": user["id"]})
    return UserOut(**public_user(fresh))


@router.post("/tour/complete", response_model=UserOut)
async def complete_product_tour(
    request: Request,
    user: dict = Depends(get_current_user),
):
    db = request.app.state.db
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"product_tour_completed_at": _now()}},
    )
    fresh = await db.users.find_one({"id": user["id"]})
    return UserOut(**public_user(fresh))


@router.get("/users")
async def list_users(request: Request, _admin: dict = Depends(require_roles("admin"))):
    db = request.app.state.db
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [public_user(u) for u in users]


@router.post("/users")
async def create_user(
    body: UserCreate, request: Request, _admin: dict = Depends(require_roles("admin"))
):
    db = request.app.state.db
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    role = normalize_role(body.role)
    warn_domain = not email.endswith(f"@{PREFERRED_TEAM_DOMAIN}")
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": body.name.strip(),
        "role": role,
        "phone": "",
        "password_hash": hash_password(body.password),
        "must_change_password": True,
        "onboarding_completed_at": None,
        "product_tour_completed_at": None,
        "created_at": _now(),
    }
    await db.users.insert_one(doc)

    subject, text, html = build_invite_email(
        name=doc["name"],
        email=email,
        password=body.password,
        role=role,
        invited_by=_admin.get("name") or _admin.get("email"),
    )
    mail_result = send_email(to=email, subject=subject, text=text, html=html)

    out = public_user(doc)
    out["invite_email"] = {
        "delivered": bool(mail_result.get("delivered")),
        "reason": mail_result.get("reason"),
    }
    if mail_result.get("preview_text"):
        out["invite_email"]["preview_text"] = mail_result["preview_text"]
    if warn_domain:
        out["domain_warning"] = (
            f"Team emails are usually @{PREFERRED_TEAM_DOMAIN}"
        )
    return out


@router.patch("/users/{user_id}")
async def update_user(
    user_id: str,
    body: UserUpdate,
    request: Request,
    admin: dict = Depends(require_roles("admin")),
):
    db = request.app.state.db
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    updates = {}
    if body.name is not None:
        name = body.name.strip()
        if len(name) < 1:
            raise HTTPException(status_code=400, detail="Name is required")
        updates["name"] = name
    if body.phone is not None:
        updates["phone"] = body.phone.strip()
    if body.role is not None:
        new_role = normalize_role(body.role)
        old_role = normalize_role(target.get("role"))
        if old_role == "admin" and new_role != "admin":
            all_users = await db.users.find({}, {"role": 1}).to_list(1000)
            admin_count = sum(
                1 for u in all_users if normalize_role(u.get("role")) == "admin"
            )
            if admin_count <= 1:
                raise HTTPException(
                    status_code=400, detail="Cannot demote the last admin"
                )
        updates["role"] = new_role
    if not updates:
        return public_user(target)
    await db.users.update_one({"id": user_id}, {"$set": updates})
    fresh = await db.users.find_one({"id": user_id})
    return public_user(fresh)


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str, request: Request, admin: dict = Depends(require_roles("admin"))
):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    db = request.app.state.db
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if normalize_role(target.get("role")) == "admin":
        all_users = await db.users.find({}, {"role": 1}).to_list(1000)
        admin_count = sum(1 for u in all_users if normalize_role(u.get("role")) == "admin")
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last admin")
    await db.users.delete_one({"id": user_id})
    return {"ok": True}
