"""Perkly recommendation service.

Internal API called by the Node backend only. When RECOMMENDER_SERVICE_KEY is
set, every request must carry it in the X-Service-Key header.
"""

from __future__ import annotations

import hmac
import os
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, Header, HTTPException

from . import compare as compare_mod
from . import copilot, eligibility, scoring
from .models import (
    CompareRequest,
    CompareResponse,
    CopilotRequest,
    CopilotResponse,
    EligibilityRequest,
    EligibilityResponse,
    RecommendationRequest,
    RecommendationResponse,
)

app = FastAPI(
    title="Perkly recommendation service",
    version="1.0.0",
    description="Transparent rule-based reward ranking, eligibility and value calculations.",
)


def require_service_key(x_service_key: str | None = Header(default=None)) -> None:
    expected = os.environ.get("RECOMMENDER_SERVICE_KEY")
    if expected and not (x_service_key and hmac.compare_digest(x_service_key, expected)):
        raise HTTPException(status_code=401, detail="Invalid service key")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "engine": "perkly-scorer-v1", "copilot": "rule-based-v1", "llm": False}


@app.post("/api/recommendations", response_model=RecommendationResponse, dependencies=[Depends(require_service_key)])
def recommendations(req: RecommendationRequest) -> RecommendationResponse:
    items = scoring.score_rewards(req.user, req.rewards, req.time, req.location)[: req.limit]
    note = (
        "Ranked by Perkly’s transparent scoring rules using only the data you’ve allowed."
        if req.user.personalization
        else "Personalization is off, so rewards are ranked by expiry and estimated value only."
    )
    return RecommendationResponse(items=items, generatedAt=datetime.now(timezone.utc).isoformat(), note=note)


@app.post("/api/compare-redemptions", response_model=CompareResponse, dependencies=[Depends(require_service_key)])
def compare_redemptions(req: CompareRequest) -> CompareResponse:
    return compare_mod.compare(req)


@app.post("/api/eligibility-check", response_model=EligibilityResponse, dependencies=[Depends(require_service_key)])
def eligibility_check(req: EligibilityRequest) -> EligibilityResponse:
    return eligibility.check(req)


@app.post("/api/copilot", response_model=CopilotResponse, dependencies=[Depends(require_service_key)])
def copilot_answer(req: CopilotRequest) -> CopilotResponse:
    return copilot.answer(req)
