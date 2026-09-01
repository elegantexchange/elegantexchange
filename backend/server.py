"""The Elegant Exchange · FastAPI server."""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from routes.auth_routes import router as auth_router
from routes.consignors import router as consignors_router
from routes.inventory import router as inventory_router
from routes.sales import router as sales_router
from routes.payouts import router as payouts_router
from routes.analytics import router as analytics_router
from routes.dashboard import router as dashboard_router
from routes.square_routes import router as square_router
from routes.admin import router as admin_router
from routes.settings import router as settings_router
from routes.drop_offs import router as drop_offs_router
from seed import seed_admin, seed_demo


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("elegant_exchange")


def _cors_origins() -> list[str]:
    """Merge env CORS_ORIGINS with known production frontends (credentials require explicit origins)."""
    known = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://one.elegantexchange.co",
        "https://elegantexchange.co",
        "https://www.elegantexchange.co",
    ]
    raw = os.environ.get("CORS_ORIGINS", "")
    from_env = [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]
    frontend = (os.environ.get("FRONTEND_URL") or "").strip().rstrip("/")
    merged: list[str] = []
    for o in from_env + ([frontend] if frontend else []) + known:
        if o and o not in merged and o != "*":
            merged.append(o)
    # Only fall back to wildcard when nothing explicit is configured at all
    if not from_env and not frontend:
        # still include known production hosts; never use * with credentials
        return merged or known
    return merged


async def _boot_mongo(app: FastAPI) -> None:
    """Connect Mongo after the HTTP server is already listening (Railway healthcheck)."""
    mongo_url = (os.environ.get("MONGO_URL") or "").strip()
    db_name = (os.environ.get("DB_NAME") or "").strip()
    if not mongo_url or not db_name:
        logger.error(
            "Missing MONGO_URL or DB_NAME — set both in Railway Variables. "
            "Login and API will stay unavailable until they are set."
        )
        return

    if "localhost" in mongo_url or "127.0.0.1" in mongo_url:
        logger.error(
            "MONGO_URL points at localhost — Railway cannot reach it. "
            "Use your MongoDB Atlas connection string (mongodb+srv://...)."
        )

    attempt = 0
    while True:
        attempt += 1
        client = None
        try:
            logger.info(
                "MongoDB connect attempt %s · database=%s", attempt, db_name
            )
            client = AsyncIOMotorClient(
                mongo_url,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=5000,
            )
            db = client[db_name]
            await client.admin.command("ping")

            try:
                await db.users.create_index("email", unique=True)
                await db.consignors.create_index("consignor_id", unique=True)
                await db.inventory.create_index("item_id", unique=True)
                await db.inventory.create_index("consignor_id")
                await db.inventory.create_index("status")
                await db.sales.create_index("item_id")
                await db.sales.create_index("consignor_id")
                await db.sales.create_index("sale_date")
                await db.payouts.create_index("consignor_id")
                await db.square_sync_log.create_index("transaction_id", unique=True)
                await db.drop_offs.create_index("status")
                await db.drop_offs.create_index("consignor_id")
                await db.drop_offs.create_index("created_at")
            except Exception as e:
                logger.warning("Index setup warning: %s", e)

            await seed_admin(db)
            if os.environ.get("SEED_DEMO", "").lower() in ("1", "true", "yes"):
                await seed_demo(db)

            app.state.mongo_client = client
            app.state.db = db
            app.state.db_ready = True
            logger.info("MongoDB ready (attempt %s)", attempt)
            return
        except asyncio.CancelledError:
            if client is not None:
                client.close()
            raise
        except Exception as e:
            if client is not None:
                client.close()
            logger.warning(
                "MongoDB attempt %s failed: %s — retrying. "
                "If this persists, allow 0.0.0.0/0 in Atlas Network Access.",
                attempt,
                e,
            )
            await asyncio.sleep(min(2 ** min(attempt, 4), 20))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Critical for Railway: do not await Mongo (or anything slow) before yield.
    # Uvicorn only accepts connections after lifespan startup finishes.
    app.state.mongo_client = None
    app.state.db = None
    app.state.db_ready = False

    boot_task = asyncio.create_task(_boot_mongo(app))
    logger.info(
        "HTTP ready · PORT=%s · CORS=%s · mongo booting in background",
        os.environ.get("PORT", "unset"),
        _cors_origins(),
    )
    yield

    boot_task.cancel()
    try:
        await boot_task
    except asyncio.CancelledError:
        pass
    client = getattr(app.state, "mongo_client", None)
    if client is not None:
        client.close()


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(title="The Elegant Exchange", lifespan=lifespan)

_cors = _cors_origins()
logger.info("CORS allow_origins: %s", _cors)


class DbReadyMiddleware(BaseHTTPMiddleware):
    """Return 503 while Mongo boots — never block OPTIONS (CORS preflight)."""

    async def dispatch(self, request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)
        path = request.url.path.rstrip("/") or "/"
        if path in ("/", "/health", "/api/health", "/api"):
            return await call_next(request)
        if not getattr(request.app.state, "db_ready", False):
            return JSONResponse(
                {
                    "detail": "Database starting up — retry in a moment",
                    "db": False,
                },
                status_code=503,
            )
        return await call_next(request)


# Inner first, then CORS last so it is outermost (headers on every response).
app.add_middleware(DbReadyMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

for r in (
    auth_router,
    consignors_router,
    inventory_router,
    sales_router,
    payouts_router,
    analytics_router,
    dashboard_router,
    square_router,
    admin_router,
    settings_router,
    drop_offs_router,
):
    app.include_router(r)


@app.get("/")
@app.get("/health")
@app.get("/api/health")
async def health():
    """Liveness for Railway — always 200 once the process is listening."""
    mongo_configured = bool(
        (os.environ.get("MONGO_URL") or "").strip()
        and (os.environ.get("DB_NAME") or "").strip()
    )
    return {
        "ok": True,
        "db": bool(getattr(app.state, "db_ready", False)),
        "mongo_configured": mongo_configured,
    }


@app.get("/api")
async def root():
    return {
        "app": "The Elegant Exchange",
        "ok": True,
        "db": bool(getattr(app.state, "db_ready", False)),
    }
