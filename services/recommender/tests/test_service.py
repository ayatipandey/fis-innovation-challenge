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
        "redemption": {"url": None},
        "valid": {"channels": ["online", "in_store"]},
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


def copilot(message, rewards=(), user=COFFEE_USER):
    res = client.post("/api/copilot", json={"message": message, "user": user, "rewards": list(rewards), "time": TIME})
    assert res.status_code == 200, res.text
    return res.json()


def test_copilot_works_out_savings_for_a_given_amount():
    rewards = [
        reward("big", "groceries", "greenleaf", minSpend=75, benefit={"kind": "amount_off", "value": 10, "summary": "$10 off"}),
        reward("pct", "groceries", "harvest", benefit={"kind": "percent_off", "value": 10, "summary": "10% off"}, maxBenefit=15),
    ]
    res = copilot("How much would I save on a $90 grocery shop?", rewards)
    rows = {r[0]: r for r in res["table"]["rows"]}
    assert rows["Greenleaf"][3] == "$10"
    assert rows["Harvest"][3] == "$9"
    below = copilot("How much would I save on a $50 grocery shop?", rewards)
    rows = {r[0]: r for r in below["table"]["rows"]}
    assert rows["Greenleaf"][3] == "$0" and "minimum" in rows["Greenleaf"][4]
    assert any("estimates" in n for n in res["notes"])


def test_copilot_is_honest_that_perkly_has_no_points():
    res = copilot("Should I use miles for a seat upgrade?")
    assert res["engine"] == "rule-based-v1"
    assert "doesn’t hold or redeem points or miles" in res["reply"]


def test_copilot_minimum_spend_uses_usual_spend():
    rewards = [reward("big", "groceries", "greenleaf", minSpend=150, valueEstimate={"amount": 10, "basis": "Fixed discount."})]
    res = copilot("Is the Greenleaf offer worth the minimum spend?", rewards)
    assert "$102" in res["reply"] and res["cards"] == ["big"]


def test_service_key_is_enforced(monkeypatch):
    monkeypatch.setenv("RECOMMENDER_SERVICE_KEY", "secret")
    body = {"user": COFFEE_USER, "rewards": [], "time": TIME}
    assert client.post("/api/recommendations", json=body).status_code == 401
    assert client.post("/api/recommendations", json=body, headers={"X-Service-Key": "secret"}).status_code == 200
