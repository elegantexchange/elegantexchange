# The Elegant Exchange — Back of Haus · PRD

## Problem Statement (verbatim summary)
Build a staff-only internal operations portal for The Elegant Exchange, a boutique consignment store launching Thursday, June 12, 2026. Single store. JWT auth with owner + staff roles. Square OAuth sync. 50/50 commission split. 60-day consignment period. Modules: Dashboard, Consignors, Inventory, Sales, Payouts, Analytics, Settings.

Brand: Montserrat font, magenta accent `#8B1F6B`, white background, generous spacing, no math for staff.

## User Personas
- **Owner** (single account, info@elegantexchange.co) — full access including payouts, settings, analytics.
- **Staff** (any number of floor employees) — intake, inventory, sales logging. No payouts/settings.

## Core Requirements (static)
- JWT login + persistent session.
- Auto-generated `EE-###` consignor IDs and `EE-###-NN` item IDs.
- 60-day auto-expiry of items past `date_in + 60 days`.
- 50/50 split auto-computed on sale entry. Staff never do math.
- Square OAuth + sync (orders/payments matched by EE item ID in sale note).
- Printable 3-across item tags on letter paper.
- Per-consignor running balance + payout history.
- CSV export of analytics.

## Architecture
- **Backend**: FastAPI, MongoDB (Motor), Pydantic, JWT (PyJWT) + bcrypt.
- **Frontend**: React 19, React Router 7, shadcn/ui, recharts, sonner, axios.
- **Auth**: localStorage `ee_token` + httpOnly `access_token` cookie fallback.
- **Brand**: Montserrat (Google), magenta `#8B1F6B`, custom CSS tokens in `index.css`.

## Implemented (Feb 2026)
**Backend** (`/app/backend`)
- `server.py` lifespan that creates indexes + seeds admin + demo data.
- `auth.py` JWT helpers, `get_current_user`, `require_owner`.
- Routes: `auth_routes`, `consignors`, `inventory`, `sales`, `payouts`, `analytics`, `dashboard`, `square_routes`.
- `seed.py` creates 2 users + 7 consignors + 18 items + ~9 sales + 1 historical payout.

**Frontend** (`/app/frontend/src`)
- `App.js` with `OwnerOnly` guard.
- `AuthContext`, `Layout`, `Sidebar`, `MobileTabBar`, `IntakeDialog`, `StatusPill`, `StatCard`, `PageHeader`.
- Pages: `Login`, `Dashboard`, `Consignors`, `ConsignorDetail`, `Inventory`, `Sales`, `Payouts`, `Analytics`, `Settings`, `TagPrint` (3-across printable tags).

**Testing**
- 19/19 backend pytests pass · all key frontend flows smoke-tested.

## Prioritized Backlog
**P1 (post-launch refinement)**
- Square credentials wiring (user must provide `SQUARE_APPLICATION_ID`, `SQUARE_APPLICATION_SECRET`, `SQUARE_REDIRECT_URI` in `backend/.env`).
- Document upload (signed agreement / intake form) on Consignor Profile > Documents tab.
- Partial payouts UX polish + per-sale payout selection.

**P2 (V2)**
- Consignor-facing self-serve portal (already deferred per spec).
- Webhook from Square for real-time sale push.
- Per-period auto-expiry email/SMS notifications to consignors.

## Test Credentials
- Owner: `info@elegantexchange.co` / `ElegantExchange2026!`
- Staff: `staff@elegantexchange.co` / `Staff2026!`
