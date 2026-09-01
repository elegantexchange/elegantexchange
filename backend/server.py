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
    raw = os.environ.get("CORS_ORIGINS", "")
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    return origins or ["*"]


async def _boot_mongo(app: FastAPI) -> None:
    """Connect Mongo after the HTTP server is already listening (Railway healthcheck)."""
    mongo_url = (os.environ.get("MONGO_URL") or "").strip()
    db_name = (os.environ.get("DB_NAME") or "").strip()
    if not mongo_url or not db_name:
        logger.error(
            "Missing MONGO_URL or DB_NAME — API will stay unavailable until set"
        )
        return

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
# Application — CORS middleware must be registered first so it wraps every
# other middleware and route handler, including the OPTIONS preflight path.
# ---------------------------------------------------------------------------

app = FastAPI(title="The Elegant Exchange", lifespan=lifespan)

_cors = _cors_origins()
_wildcard = _cors == ["*"]
logger.info("CORS allow_origins: %s", _cors)

# Per the Fetch spec, a wildcard origin is incompatible with
# allow_credentials=True — browsers will reject such responses.
# When no explicit origins are configured we fall back to wildcard + no
# credentials; once CORS_ORIGINS is set to real origins credentials work.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors,
    allow_credentials=not _wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.middleware("http")
async def db_ready_gate(request, call_next):
    """Avoid AttributeError while Mongo is still booting; keep health open."""
    path = request.url.path.rstrip("/") or "/"
    if path in ("/", "/health", "/api/health", "/api"):
        return await call_next(request)
    if not getattr(request.app.state, "db_ready", False):
        from fastapi.responses import JSONResponse

        return JSONResponse(
            {"detail": "Database starting up — retry in a moment"},
            status_code=503,
        )
    return await call_next(request)


# Routers — included after middleware so the CORS layer is outermost
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
    return {
        "ok": True,
        "db": bool(getattr(app.state, "db_ready", False)),
    }


@app.get("/api")
async def root():
    return {
        "app": "The Elegant Exchange",
        "ok": True,
        "db": bool(getattr(app.state, "db_ready", False)),
    }
