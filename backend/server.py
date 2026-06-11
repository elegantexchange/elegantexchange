"""The Elegant Exchange · FastAPI server."""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
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
from seed import seed_admin, seed_demo


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("elegant_exchange")


def _cors_origins() -> list[str]:
    raw = os.environ.get("CORS_ORIGINS", "")
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    return origins or ["*"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    mongo_url = os.environ.get("MONGO_URL", "")
    db_name = os.environ.get("DB_NAME", "")
    if not mongo_url or not db_name:
        logger.error("Missing MONGO_URL or DB_NAME — check Railway variables")
        raise RuntimeError("MONGO_URL and DB_NAME are required")

    logger.info("Connecting to MongoDB database=%s", db_name)
    client = AsyncIOMotorClient(
        mongo_url,
        serverSelectionTimeoutMS=10000,
    )
    db = client[db_name]
    app.state.mongo_client = client
    app.state.db = db
    try:
        await client.admin.command("ping")
        logger.info("MongoDB ping OK")
    except Exception as e:
        logger.exception("MongoDB ping failed — check MONGO_URL and Atlas Network Access")
        raise RuntimeError(f"MongoDB ping failed: {e}") from e

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
    except Exception as e:
        logger.warning("Index setup warning: %s", e)
    await seed_admin(db)
    if os.environ.get("SEED_DEMO", "").lower() in ("1", "true", "yes"):
        await seed_demo(db)
    logger.info(
        "Startup complete · PORT=%s · CORS=%s",
        os.environ.get("PORT", "unset"),
        _cors_origins(),
    )
    yield
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
):
    app.include_router(r)


@app.get("/api")
async def root():
    return {"app": "The Elegant Exchange", "ok": True}
