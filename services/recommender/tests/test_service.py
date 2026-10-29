from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app import engine
from app.features import FEATURES
from app.main import app

client = TestClient(app)
NOW = datetime(2026, 10, 27, 8, 10, tzinfo=timezone.utc).isoformat()

UNION = {"id": "cc-union", "name": "Campus Coffee, Student Union", "lat": 30.2722, "lng": -81.5079, "opens": 7, "closes": 20, "category": "coffee"}
COFFEE_HOURS = [0.0] * 7 + [0.15, 0.3, 0.2, 0.05] + [0.0] * 3 + [0.05] * 6 + [0.0] * 4

HABITS = {
    "visitsPerWeek": {"coffee": 5.5, "food": 1.3},
    "typicalSpend": {"coffee": 6.1, "food": 20},
    "hourShare": {"coffee": COFFEE_HOURS},
    "spendVelocity": {"coffee": 1.1},
}


def latte(**kw):
    c = {
        "optionId": "cc-latte", "programId": "campus-coffee", "programName": "Campus Coffee Rewards", "title": "A free latte",
        "cost": 25, "value": 5, "channels": ["in_store", "online"], "available": 70, "expiringPoints": 30, "daysToExpiry": 6,
        "category": "coffee", "merchants": [UNION],
    }
    c.update(kw)
    return c


def moment(candidates, lat=30.2723, lng=-81.5081, hour=8, minute=10, prefs=None, ratings=None):
    body = {
        "context": {"now": NOW, "hour": hour, "minute": minute, "weekday": 1, "lat": lat, "lng": lng, "source": "simulated"},
        "prefs": {"locationAllowed": True, "dailyLimit": 3, "sentToday": 0, "quietHours": {"enabled": True, "start": "21:00", "end": "08:00"}, **(prefs or {})},
        "habits": HABITS,
        "ratings": ratings or {},
        "candidates": candidates,
    }
    res = client.post("/moments/evaluate", json=body)
    assert res.status_code == 200, res.text
    return res.json()


def test_model_file_matches_the_feature_definitions():
    assert engine.MODEL["features"] == FEATURES
    assert len(engine.MODEL["treated"]["coef"]) == len(FEATURES)
    assert engine.MODEL["trainedOn"]["synthetic"] is True


def test_near_with_expiring_points_sends_a_specific_notification():
    d = moment([latte()])["decision"]
    assert d["sent"] is True
    assert "ft from Campus Coffee" in d["body"] and "expires in 6 days" in d["body"]
    assert d["uplift"] >= engine.THRESHOLD
    assert d["pIfNotified"] > d["pIfNot"]


def test_quiet_hours_and_daily_limit_hold_it_back():
    quiet = moment([latte(merchants=[{**UNION, "closes": 24}])], hour=22, minute=40)["decision"]
    assert quiet["sent"] is False and "quiet hours" in quiet["suppressedBecause"]
    capped = moment([latte()], prefs={"sentToday": 3})["decision"]
    assert capped["sent"] is False and "limit" in capped["suppressedBecause"]


def test_in_store_rewards_need_the_member_nearby():
    far = moment([latte(channels=["in_store"])], lat=30.32, lng=-81.45)["decision"]
    assert far["sent"] is False and far["optionId"] is None


def test_bad_ratings_lower_the_uplift():
    base = moment([latte()])["decision"]["uplift"]
    rated = moment([latte()], ratings={"coffee:morning": {"bad": 3}})["decision"]
    assert rated["uplift"] < base


def test_unaffordable_rewards_are_skipped():
    res = moment([latte(cost=500)])
    assert res["decision"]["optionId"] is None and res["considered"] == []


def test_location_off_means_no_distance():
    d = moment([latte()], prefs={"locationAllowed": False})["decision"]
    assert d["distanceM"] is None and " ft from" not in d["body"] and " mi from" not in d["body"]


def pilot(message, **extra):
    body = {
        "message": message,
        "context": {"now": NOW, "hour": 8, "minute": 10, "weekday": 1, "lat": 30.2723, "lng": -81.5081},
        "prefs": {"locationAllowed": True},
        "habits": HABITS,
        "programs": [
            {
                "programId": "campus-coffee", "name": "Campus Coffee Rewards", "available": 70,
                "expiries": [{"points": 30, "days": 6}],
                "plans": [
                    {"label": "7 × $2 off any drink", "totalValue": 14, "pointsUsed": 70, "leftover": 0, "visits": 7, "extraSpend": 0, "valueAtRisk": 0, "score": 12.95, "reasons": ["$14.00 of value", "No minimum spend."], "warnings": [], "optionIds": ["cc-2off"]},
                    {"label": "$15 off an order of $20 or more", "totalValue": 15, "pointsUsed": 70, "leftover": 0, "visits": 1, "extraSpend": 13.9, "valueAtRisk": 0, "score": 11.37, "reasons": ["$15.00 of value"], "warnings": ["Needs a $20.00 order; you usually spend about $6.10."], "optionIds": ["cc-15off"]},
                ],
            }
        ],
        "candidates": [latte()],
        **extra,
    }
    res = client.post("/pilot", json=body)
    assert res.status_code == 200, res.text
    return res.json()


def test_pilot_best_use_ranks_plans():
    res = pilot("What’s the best use of my coffee points?")
    assert "7 × $2 off" in res["reply"]
    assert res["table"]["rows"][0][1] == "7 × $2 off any drink"


def test_pilot_explains_the_minimum_spend():
    res = pilot("Is the $15 coffee reward worth the minimum spend?")
    assert "$15 off" in res["reply"] and "more than usual" in res["reply"]


def test_pilot_lists_expiring_points():
    res = pilot("Which points expire soon?")
    assert res["table"]["rows"][0][2] == "6 days"


def test_pilot_uses_the_moment_engine_for_right_now():
    res = pilot("What should I use near me right now?")
    assert "Campus Coffee" in res["reply"] and res["cards"] == ["cc-latte"]


def test_insights_report_is_synthetic_and_has_a_control_group():
    r = client.get("/insights").json()
    assert r["synthetic"] is True
    assert r["overall"]["notifiedRate"] > r["overall"]["controlRate"]
    assert len(r["deciles"]) == 10


def test_routes_are_also_served_under_api_ai():
    assert client.get("/api/ai/health").status_code == 200


def test_service_key_is_enforced(monkeypatch):
    monkeypatch.setenv("RECOMMENDER_SERVICE_KEY", "secret")
    assert client.get("/insights").status_code == 401
    assert client.get("/insights", headers={"X-Service-Key": "secret"}).status_code == 200


def test_online_only_rewards_need_expiring_points_to_be_a_moment():
    credit = {"optionId": "nl-credit", "programId": "sephorra", "programName": "Sephorra Beauty Insider", "title": "$10 off any purchase",
              "cost": 1000, "value": 10, "channels": ["online"], "available": 3150, "expiringPoints": 1200, "daysToExpiry": 21, "category": "shopping", "merchants": []}
    d = moment([credit, latte()])["decision"]
    assert d["optionId"] == "cc-latte"
    alone = moment([credit])["decision"]
    assert alone["optionId"] is None
    soon = moment([{**credit, "daysToExpiry": 5}])["decision"]
    assert soon["optionId"] == "nl-credit"
