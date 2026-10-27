"""Generate a synthetic notification experiment and train Perkly's uplift model.

The data is invented: each row is a "moment" (a member near a merchant at a time,
with a reward they can afford). A random 90% of members are notified and 10% are
held back as a control group. Redemption depends on habit, distance, expiry and
more, and the effect of notifying differs by person: big for members near a
merchant with points about to expire, close to zero for members who would redeem
anyway, and negative for members who have rated similar notifications "Bad".

We train a T-learner: one logistic regression for P(redeem | notified) and one
for P(redeem | not notified). Uplift is the difference. The models, a holdout
evaluation and the chart data for the partner insights page are written to
app/model/.

Run:  python training/train_uplift.py
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.features import FEATURES, Moment, vector  # noqa: E402

SEED = 20261027
N = 60_000
CONTROL_SHARE = 0.10
THRESHOLD = 0.05  # notify only when the predicted uplift is at least 5 points


def synth(rng: np.random.Generator) -> tuple[np.ndarray, np.ndarray]:
    rows = []
    for _ in range(N):
        has_loc = rng.random() < 0.65
        dist = float(np.exp(rng.normal(6.2, 1.0))) if has_loc else None  # median ~500 m
        m = Moment(
            distance_m=dist,
            hour_share=float(min(0.35, rng.beta(0.6, 30) if rng.random() < 0.55 else rng.beta(2.5, 10))),  # off-hour or usual hour
            visits_per_week=float(rng.gamma(1.6, 1.4)),
            days_to_expiry=float(rng.uniform(0, 60)) if rng.random() < 0.7 else None,
            value=float(rng.uniform(2, 30)),
            extra_spend=float(rng.uniform(0, 30)) if rng.random() < 0.35 else 0.0,
            velocity=float(np.exp(rng.normal(0, 0.35))),
            open_now=bool(rng.random() < 0.82),
            bad_ratings=int(rng.choice([0] * 17 + [1, 1, 3])),
        )
        rows.append(vector(m))
    X = np.array(rows)
    return X, true_effects(X)


def true_effects(X: np.ndarray) -> np.ndarray:
    f = {name: X[:, i] for i, name in enumerate(FEATURES)}
    base = -4.6 + 3.2 * f["habit_now"] + 2.4 * f["visit_rate"] + 0.5 * f["velocity"] + 0.9 * f["near_x_habit"] - 1.1 * f["extra_spend"] + 0.3 * f["open_now"]
    # A reminder helps less the stronger the existing habit ("sure things" would redeem anyway),
    # and hurts members who have rated similar notifications "Bad" ("do not disturb").
    helpful = 0.1 + 2.1 * f["near"] + 1.6 * f["expiry_urgency"] + 0.9 * f["value"] + 0.5 * f["open_now"] - 0.9 * f["extra_spend"]
    tau = helpful * (1 - 0.9 * f["habit_x_rate"]) - 2.6 * f["bad_ratings"]
    return np.stack([base, tau], axis=1)


def sig(z):
    return 1 / (1 + np.exp(-z))


def fit_logistic(X: np.ndarray, y: np.ndarray, l2: float = 1.0, iters: int = 30) -> dict:
    mean = X.mean(axis=0)
    std = X.std(axis=0)
    std[std == 0] = 1
    Z = np.hstack([np.ones((len(X), 1)), (X - mean) / std])
    w = np.zeros(Z.shape[1])
    reg = np.eye(Z.shape[1]) * l2
    reg[0, 0] = 0
    for _ in range(iters):  # Newton–Raphson (IRLS)
        p = sig(Z @ w)
        g = Z.T @ (p - y) + reg @ w
        H = (Z * (p * (1 - p))[:, None]).T @ Z + reg
        step = np.linalg.solve(H, g)
        w -= step
        if np.abs(step).max() < 1e-6:
            break
    return {"bias": float(w[0]), "coef": [float(c) for c in w[1:]], "mean": [float(m) for m in mean], "std": [float(s) for s in std]}


def predict(model: dict, X: np.ndarray) -> np.ndarray:
    Z = (X - np.array(model["mean"])) / np.array(model["std"])
    return sig(model["bias"] + Z @ np.array(model["coef"]))


def auc(y: np.ndarray, p: np.ndarray) -> float:
    order = np.argsort(p)
    ranks = np.empty(len(p))
    ranks[order] = np.arange(1, len(p) + 1)
    pos = y == 1
    n1, n0 = pos.sum(), (~pos).sum()
    return float((ranks[pos].sum() - n1 * (n1 + 1) / 2) / (n1 * n0))


def rate(y, mask):
    return float(y[mask].mean()) if mask.any() else 0.0


def main() -> None:
    rng = np.random.default_rng(SEED)
    X, effects = synth(rng)
    treated = rng.random(N) >= CONTROL_SHARE
    p0_true = sig(effects[:, 0])
    p1_true = sig(effects[:, 0] + effects[:, 1])
    y = (rng.random(N) < np.where(treated, p1_true, p0_true)).astype(float)

    test = rng.random(N) < 0.3
    train = ~test
    m1 = fit_logistic(X[train & treated], y[train & treated])
    m0 = fit_logistic(X[train & ~treated], y[train & ~treated])

    Xt, yt, tt = X[test], y[test], treated[test]
    p1 = predict(m1, Xt)
    p0 = predict(m0, Xt)
    uplift = p1 - p0
    true_uplift = (p1_true - p0_true)[test]

    notified_rate = rate(yt, tt)
    control_rate = rate(yt, ~tt)
    target = uplift >= THRESHOLD
    targeted_lift = rate(yt, target & tt) - rate(yt, target & ~tt)
    untargeted_lift = rate(yt, ~target & tt) - rate(yt, ~target & ~tt)

    deciles = []
    edges = np.quantile(uplift, np.linspace(0, 1, 11))
    for i in range(10):
        lo, hi = edges[9 - i], edges[10 - i]
        mask = (uplift >= lo) & (uplift <= hi) if i == 0 else (uplift >= lo) & (uplift < hi)
        deciles.append({
            "decile": i + 1,
            "predictedUplift": round(float(uplift[mask].mean()), 4),
            "notifiedRate": round(rate(yt, mask & tt), 4),
            "controlRate": round(rate(yt, mask & ~tt), 4),
            "actualLift": round(rate(yt, mask & tt) - rate(yt, mask & ~tt), 4),
            "members": int(mask.sum()),
        })

    seg = {
        "persuadables": target,
        "sureThings": (~target) & (p0 >= 0.4) & (uplift >= 0),
        "doNotDisturb": uplift < 0,
    }
    seg["lostCauses"] = ~(seg["persuadables"] | seg["sureThings"] | seg["doNotDisturb"])
    segments = {
        k: {"share": round(float(v.mean()), 4), "notifiedRate": round(rate(yt, v & tt), 4), "controlRate": round(rate(yt, v & ~tt), 4), "lift": round(rate(yt, v & tt) - rate(yt, v & ~tt), 4)}
        for k, v in seg.items()
    }

    model = {
        "version": "uplift-tlearner-v1",
        "features": FEATURES,
        "threshold": THRESHOLD,
        "treated": m1,
        "control": m0,
        "trainedOn": {"rows": int(train.sum()), "seed": SEED, "controlShare": CONTROL_SHARE, "synthetic": True},
    }
    report = {
        "synthetic": True,
        "method": "Randomized holdout. 90% of members can be notified, 10% are a control group that never is. Lift = redemption rate of notified members minus the control group's.",
        "holdoutRows": int(test.sum()),
        "overall": {"notifiedRate": round(notified_rate, 4), "controlRate": round(control_rate, 4), "liftPoints": round((notified_rate - control_rate) * 100, 1)},
        "targeting": {
            "threshold": THRESHOLD,
            "shareTargeted": round(float(target.mean()), 4),
            "targetedLiftPoints": round(targeted_lift * 100, 1),
            "untargetedLiftPoints": round(untargeted_lift * 100, 1),
            "causedPer1000Blanket": round((notified_rate - control_rate) * 1000),
            "causedPer1000Targeted": round(targeted_lift * 1000),
        },
        "deciles": deciles,
        "segments": segments,
        "modelQuality": {
            "aucNotified": round(auc(yt[tt], p1[tt]), 3),
            "aucControl": round(auc(yt[~tt], p0[~tt]), 3),
            "upliftCorrelationWithTruth": round(float(np.corrcoef(uplift, true_uplift)[0, 1]), 3),
        },
        "features": FEATURES,
        "treatedCoefficients": dict(zip(FEATURES, [round(c, 3) for c in m1["coef"]])),
        "controlCoefficients": dict(zip(FEATURES, [round(c, 3) for c in m0["coef"]])),
    }

    out = ROOT / "app" / "model"
    out.mkdir(parents=True, exist_ok=True)
    (out / "uplift_model.json").write_text(json.dumps(model, indent=1))
    (out / "report.json").write_text(json.dumps(report, indent=1))
    print(json.dumps({k: report[k] for k in ["overall", "targeting", "modelQuality"]}, indent=1))
    print("segments", json.dumps(segments))


if __name__ == "__main__":
    main()
