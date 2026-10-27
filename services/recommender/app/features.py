"""Feature definitions for the uplift model.

Used by both the training script and live scoring, so a moment is described to
the model the same way it was during training. Pure Python: no numpy at runtime.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

FEATURES = [
    "near",            # closeness to the merchant, 1 = on the doorstep, 0 = far or unknown
    "habit_now",       # how typical this hour is for the member in this category
    "visit_rate",      # visits per week in this category (log-scaled)
    "expiry_urgency",  # how soon the points expire, 1 = today
    "value",           # dollar value of the reward (scaled)
    "extra_spend",     # spend a minimum forces above the usual order (scaled)
    "velocity",        # recent spend in the category vs the prior two weeks
    "open_now",        # the merchant is open
    "bad_ratings",     # recent "Bad" ratings for this kind of notification
    "near_x_habit",    # near and at a usual time: the moment of intent
    "habit_x_rate",    # strong existing habit: likely to redeem anyway
]


@dataclass
class Moment:
    distance_m: float | None
    hour_share: float          # share of the member's category visits in this hour, 0-1
    visits_per_week: float
    days_to_expiry: float | None
    value: float
    extra_spend: float
    velocity: float
    open_now: bool
    bad_ratings: int


def vector(m: Moment) -> list[float]:
    near = 0.0 if m.distance_m is None else math.exp(-m.distance_m / 250)
    habit = min(1.0, m.hour_share * 24 / 3)  # 3x a uniform hour counts as fully habitual
    rate = math.log1p(max(0.0, m.visits_per_week)) / math.log1p(14)
    urgency = 0.0 if m.days_to_expiry is None else math.exp(-max(0.0, m.days_to_expiry) / 7)
    value = min(1.0, m.value / 25)
    extra = min(1.0, max(0.0, m.extra_spend) / 30)
    velocity = min(3.0, max(0.0, m.velocity)) / 3
    bad = min(3, max(0, m.bad_ratings)) / 3
    return [near, habit, rate, urgency, value, extra, velocity, 1.0 if m.open_now else 0.0, bad, near * habit, habit * rate]


def sigmoid(z: float) -> float:
    if z < -35:
        return 0.0
    if z > 35:
        return 1.0
    return 1 / (1 + math.exp(-z))


def predict(model: dict, x: list[float]) -> float:
    mean, std, coef, bias = model["mean"], model["std"], model["coef"], model["bias"]
    z = bias + sum(c * (xi - mu) / sd for c, xi, mu, sd in zip(coef, x, mean, std))
    return sigmoid(z)
