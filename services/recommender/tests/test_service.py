from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
NOW = datetime(2026, 10, 27, 8, 15, tzinfo=timezone.utc)  # a Tuesday morning


def iso(days: float) -> str:
    return (NOW + timedelta(days=days)).isoformat()


def reward(id, category, brand, **kw):
    base = {
        "id": id,
        "brandId": brand,
        "brandName": brand.title(),
        "category": category,
        "headline": id,
        "benefit": {"kind": "amount_off", "value": 5, "summary": "$5 off"},
        "valueEstimate": {"amount": 5, "basis": "fixed"},
        "minSpend": None,
        "validFrom": iso(-5),
        "expiresAt": iso(20),
        "redemption": {"methods": ["apple_pay", "saved_card", "in_store"]},
    }
    base.update(kw)
    return base


COFFEE_USER = {
    "categories": ["coffee", "groceries"],
    "favoriteBrands": ["ember"],
    "spending": {
        "share": {"coffee": 0.3, "groceries": 0.4, "food": 0.2},
        "typicalSpend": {"coffee": 6, "groceries": 48, "food": 30},
        "source": "synthetic_demo",
    },
    "paymentMethods": ["apple_pay"],
}
TIME = {"now": NOW.isoformat(), "weekday": 1, "hour": 8}


def rank(user, rewards, location=None):
    res = client.post("/api/recommendations", json={"user": user, "rewards": rewards, "time": TIME, "location": location})
    assert res.status_code == 200, res.text
    return res.json()["items"]


def test_relevant_categories_outrank_irrelevant_ones():
    items = rank(COFFEE_USER, [
        reward("watch", "watches", "horologe", valueEstimate={"amount": 50, "basis": "x"}),
        reward("coffee", "coffee", "ember", routine=["weekday_morning"]),
    ])
    assert [i["offerId"] for i in items] == ["coffee", "watch"]
    coffee = items[0]
    assert any("frequently buy coffee" in r for r in coffee["reasons"])
    assert any("favorite" in r for r in coffee["reasons"])


def test_extra_spend_is_penalized_and_warned():
    items = rank(COFFEE_USER, [
        reward("big-min", "groceries", "greenleaf", minSpend=150, valueEstimate={"amount": 10, "basis": "x"}),
        reward("no-min", "groceries", "harvest", valueEstimate={"amount": 4, "basis": "x"}),
    ])
    by_id = {i["offerId"]: i for i in items}
    assert by_id["no-min"]["score"] > by_id["big-min"]["score"]
    assert any("$150 minimum" in w for w in by_id["big-min"]["warnings"])


def test_expired_and_future_offers_are_excluded():
    items = rank(COFFEE_USER, [
        reward("expired", "coffee", "ember", expiresAt=iso(-1)),
        reward("future", "coffee", "ember", validFrom=iso(2)),
        reward("live", "coffee", "ember"),
    ])
    assert [i["offerId"] for i in items] == ["live"]


def test_location_only_counts_when_permitted():
    near = reward("near", "coffee", "ember", nearby={"label": "Mercer St", "distanceMeters": 180})
    off = rank(COFFEE_USER, [near], location={"permitted": False})[0]
    on = rank(COFFEE_USER, [near], location={"permitted": True})[0]
    assert on["score"] > off["score"]
    assert not any("nearby" in r for r in off["reasons"])
    assert any("nearby" in r for r in on["reasons"])


def test_sponsorship_does_not_change_score():
    a = rank(COFFEE_USER, [reward("x", "tech", "circuit", sponsored=False)])[0]["score"]
    b = rank(COFFEE_USER, [reward("x", "tech", "circuit", sponsored=True)])[0]["score"]
    assert a == b


def test_personalization_off_ignores_spending_and_favorites():
    user = {**COFFEE_USER, "personalization": False}
    items = rank(user, [reward("coffee", "coffee", "ember")])
    assert not any("favorite" in r or "coffee" in r for r in items[0]["reasons"])


def test_compare_uses_the_formula_and_flags_missing_prices():
    res = client.post("/api/compare-redemptions", json={
        "options": [
            {"label": "Upgrade", "unitsRequired": 12000, "cashPrice": 150, "fees": 0},
            {"label": "Ticket", "unitsRequired": 18500, "cashPrice": 240, "fees": 5.6},
            {"label": "Mystery", "unitsRequired": 5000},
        ],
        "balance": 15000,
    }).json()
    up, tk, mystery = res["options"]
    assert up["valuePerUnitCents"] == 1.25
    assert tk["valuePerUnitCents"] == round((240 - 5.6) / 18500 * 100, 2)
    assert mystery["valuePerUnitCents"] is None
    assert tk["affordable"] is False
    assert any("Mystery" in a for a in res["assumptions"])


def test_eligibility_unknown_is_not_eligible():
    res = client.post("/api/eligibility-check", json={
        "conditions": {"minSpend": 75, "paymentMethods": ["apple_pay"], "expiresAt": iso(3)},
        "context": {"now": NOW.isoformat()},
    }).json()
    assert res["status"] == "unknown"
    res = client.post("/api/eligibility-check", json={
        "conditions": {"minSpend": 75, "paymentMethods": ["apple_pay"], "expiresAt": iso(3)},
        "context": {"now": NOW.isoformat(), "purchaseTotal": 60, "paymentMethod": "apple_pay"},
    }).json()
    assert res["status"] == "ineligible"
    assert any("15.00 short" in c["reason"] for c in res["checks"])


def test_copilot_labels_illustrative_miles_maths():
    res = client.post("/api/copilot", json={
        "message": "Should I use miles for a seat upgrade or save them for a ticket?",
        "user": {**COFFEE_USER, "balances": {"northwind-miles": 48500}},
        "rewards": [], "programs": [], "time": TIME,
    }).json()
    assert res["engine"] == "rule-based-v1"
    assert res["table"]["columns"][4] == "Value per mile"
    assert any("illustrative" in n for n in res["notes"])
    assert "illustrative" in res["reply"]


def test_copilot_uses_given_prices():
    res = client.post("/api/copilot", json={
        "message": "The upgrade costs $210 and the ticket costs $260.",
        "user": COFFEE_USER, "rewards": [], "programs": [], "time": TIME,
    }).json()
    assert res["table"]["rows"][0][2] == "$210"
    assert not any("illustrative" in n for n in res["notes"])


def test_service_key_is_enforced(monkeypatch):
    monkeypatch.setenv("RECOMMENDER_SERVICE_KEY", "secret")
    body = {"options": [{"label": "a", "unitsRequired": 1, "cashPrice": 1}]}
    assert client.post("/api/compare-redemptions", json=body).status_code == 401
    assert client.post("/api/compare-redemptions", json=body, headers={"X-Service-Key": "secret"}).status_code == 200
