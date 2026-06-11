"""Backend API regression tests for Elegant Exchange Back-of-Haus.
Covers: auth, RBAC, dashboard, consignors, inventory, sales, payouts,
analytics, square status.
"""
import os
import datetime as dt
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fall back to reading frontend .env
    try:
        with open("/app/frontend/.env") as f:
            for ln in f:
                if ln.startswith("REACT_APP_BACKEND_URL"):
                    BASE_URL = ln.split("=", 1)[1].strip().strip('"').rstrip("/")
    except Exception:
        pass

OWNER_EMAIL = "info@elegantexchange.co"
OWNER_PASSWORD = "ElegantExchange2026!"
STAFF_EMAIL = "staff@elegantexchange.co"
STAFF_PASSWORD = "Staff2026!"


# ---------- Fixtures ----------
def _new_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="function")
def api():
    """Per-test session so cookies don't leak across tests."""
    return _new_session()


def _login(api, email, pw):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    return r


@pytest.fixture(scope="session")
def owner_token():
    s = _new_session()
    r = _login(s, OWNER_EMAIL, OWNER_PASSWORD)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def staff_token():
    s = _new_session()
    r = _login(s, STAFF_EMAIL, STAFF_PASSWORD)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture
def owner_h(owner_token):
    return {"Authorization": f"Bearer {owner_token}"}


@pytest.fixture
def staff_h(staff_token):
    return {"Authorization": f"Bearer {staff_token}"}


# ---------- Auth ----------
class TestAuth:
    def test_owner_login(self, api):
        r = _login(api, OWNER_EMAIL, OWNER_PASSWORD)
        assert r.status_code == 200
        d = r.json()
        assert "token" in d and "user" in d
        assert d["user"]["role"] == "owner"
        assert d["user"]["email"] == OWNER_EMAIL

    def test_staff_login(self, api):
        r = _login(api, STAFF_EMAIL, STAFF_PASSWORD)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "staff"

    def test_invalid_login(self, api):
        r = _login(api, OWNER_EMAIL, "badpw")
        assert r.status_code in (400, 401, 403)

    def test_me_with_bearer(self, api, owner_h):
        r = api.get(f"{BASE_URL}/api/auth/me", headers=owner_h)
        assert r.status_code == 200
        assert r.json()["email"] == OWNER_EMAIL

    def test_me_no_auth(self, api):
        s = requests.Session()  # fresh, no headers
        r = s.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code in (401, 403)


# ---------- RBAC: payouts ----------
class TestRBAC:
    def test_staff_cannot_post_payout(self, api, staff_h):
        r = api.post(
            f"{BASE_URL}/api/payouts",
            headers=staff_h,
            json={"consignor_id": "EE-001", "amount": 1, "method": "Cash"},
        )
        assert r.status_code == 403, r.text


# ---------- Dashboard ----------
class TestDashboard:
    def test_dashboard_week(self, api, owner_h):
        r = api.get(f"{BASE_URL}/api/dashboard?period=week", headers=owner_h)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in [
            "sales_today",
            "active_items",
            "payouts_owed",
            "total_consignors",
            "alerts",
            "trend",
            "activity",
        ]:
            assert k in d, f"missing {k}"
        for ak in ("expiring_soon", "expired", "stale_balances"):
            assert ak in d["alerts"], f"alert missing {ak}"
        # trend should contain this & previous arrays
        assert "this" in d["trend"] and "previous" in d["trend"]
        assert isinstance(d["trend"]["this"], list)


# ---------- Consignors ----------
class TestConsignors:
    def test_list(self, api, owner_h):
        r = api.get(f"{BASE_URL}/api/consignors", headers=owner_h)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 7
        sample = data[0]
        assert "active_items" in sample and "total_owed" in sample

    def test_get_ee_001(self, api, owner_h):
        r = api.get(f"{BASE_URL}/api/consignors/EE-001", headers=owner_h)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("items", "sales", "payouts"):
            assert k in d, f"missing {k}"

    def test_create_consignor(self, api, owner_h):
        payload = {
            "full_name": "TEST_Auto Consignor",
            "email": "test_auto@example.com",
            "phone": "555-0100",
            "payout_method": "Cash",
        }
        r = api.post(f"{BASE_URL}/api/consignors", headers=owner_h, json=payload)
        assert r.status_code in (200, 201), r.text
        d = r.json()
        cid = d.get("consignor_id") or d.get("id")
        assert cid and cid.startswith("EE-"), f"bad id: {d}"
        # store on class for next test
        TestConsignors._new_id = cid

    def test_inventory_batch_create(self, api, owner_h):
        cid = getattr(TestConsignors, "_new_id", "EE-001")
        payload = {
            "consignor_id": cid,
            "items": [
                {"description": "TEST_Jacket", "category": "Outerwear", "asking_price": 80},
                {"description": "TEST_Shirt", "category": "Tops", "asking_price": 30},
            ],
        }
        r = api.post(f"{BASE_URL}/api/inventory/batch", headers=owner_h, json=payload)
        assert r.status_code in (200, 201), r.text
        d = r.json()
        items = d if isinstance(d, list) else d.get("items", [])
        assert len(items) == 2
        for it in items:
            iid = it.get("item_id")
            assert iid and iid.startswith("EE-") and len(iid) == 7 and iid[3:].isdigit(), iid
            pe = it.get("period_end")
            di = it.get("date_in")
            assert pe and di, it
            d1 = dt.date.fromisoformat(di[:10])
            d2 = dt.date.fromisoformat(pe[:10])
            assert (d2 - d1).days == 60
        TestConsignors._test_item_id = items[0].get("item_id")


# ---------- Sales ----------
class TestSales:
    def test_create_sale_5050(self, api, owner_h):
        item_id = getattr(TestConsignors, "_test_item_id", None)
        assert item_id, "need a test item from inventory batch"
        r = api.post(
            f"{BASE_URL}/api/sales",
            headers=owner_h,
            json={"item_id": item_id, "sale_price": 100},
        )
        assert r.status_code in (200, 201), r.text
        d = r.json()
        assert float(d["store_cut"]) == 50.0
        assert float(d["consignor_cut"]) == 50.0
        # verify item is now Sold
        inv = api.get(f"{BASE_URL}/api/inventory", headers=owner_h).json()
        items = inv if isinstance(inv, list) else inv.get("items", [])
        match = [i for i in items if i.get("item_id") == item_id]
        assert match and match[0].get("status") == "Sold"


# ---------- Payouts ----------
class TestPayouts:
    def test_queue(self, api, owner_h):
        r = api.get(f"{BASE_URL}/api/payouts/queue", headers=owner_h)
        assert r.status_code == 200, r.text
        q = r.json()
        assert isinstance(q, list)
        balances = [float(x.get("balance_owed", 0)) for x in q]
        assert balances == sorted(balances, reverse=True)

    def test_overpay_returns_400(self, api, owner_h):
        q = api.get(f"{BASE_URL}/api/payouts/queue", headers=owner_h).json()
        if not q:
            pytest.skip("empty queue")
        top = q[0]
        cid = top.get("consignor_id")
        bal = float(top.get("balance_owed", 0))
        r = api.post(
            f"{BASE_URL}/api/payouts",
            headers=owner_h,
            json={"consignor_id": cid, "amount": bal + 100, "method": "Cash"},
        )
        assert r.status_code == 400, r.text

    def test_pay_valid_amount(self, api, owner_h):
        q = api.get(f"{BASE_URL}/api/payouts/queue", headers=owner_h).json()
        if not q:
            pytest.skip("empty queue")
        top = q[0]
        cid = top.get("consignor_id")
        bal = float(top.get("balance_owed", 0))
        if bal <= 0:
            pytest.skip("zero balance")
        amount = min(bal, 5.0) if bal >= 5 else bal
        r = api.post(
            f"{BASE_URL}/api/payouts",
            headers=owner_h,
            json={"consignor_id": cid, "amount": amount, "method": "Cash"},
        )
        assert r.status_code in (200, 201), r.text


# ---------- Analytics ----------
class TestAnalytics:
    def test_analytics_month(self, api, owner_h):
        r = api.get(f"{BASE_URL}/api/analytics?period=month", headers=owner_h)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in (
            "total_sales",
            "store_revenue",
            "items_sold",
            "avg_sale_price",
            "trend",
            "revenue_by_category",
            "active_by_category",
            "sell_through_rate",
            "top_consignors",
            "pending_obligations",
            "total_paid_out",
        ):
            assert k in d, f"missing key {k}"


# ---------- Square ----------
class TestSquare:
    def test_square_status_not_configured(self, api, owner_h):
        r = api.get(f"{BASE_URL}/api/square/status", headers=owner_h)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("configured") is False
        assert d.get("connected") is False

    def test_square_sync_blocked(self, api, owner_h):
        r = api.post(f"{BASE_URL}/api/square/sync", headers=owner_h, json={})
        assert r.status_code == 400, r.text


# ---------- Inventory auto-expiry ----------
class TestInventoryExpiry:
    def test_expired_present(self, api, owner_h):
        r = api.get(f"{BASE_URL}/api/inventory", headers=owner_h)
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get("items", [])
        today = dt.date.today()
        flagged_ok = True
        for it in items:
            pe = it.get("period_end")
            status = it.get("status")
            if not pe or status in ("Sold", "Donated", "Returned"):
                continue
            try:
                d_pe = dt.date.fromisoformat(pe[:10])
            except Exception:
                continue
            if d_pe <= today and status != "Expired":
                flagged_ok = False
                break
        assert flagged_ok, "some past-period items are not flagged Expired"
