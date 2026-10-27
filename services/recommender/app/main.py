"""Perkly recommendation service.

Internal API called by the Node backend only. When RECOMMENDER_SERVICE_KEY is
set, every request must carry it in the X-Service-Key header.
"""

from __future__ import annotations

import hmac
import os
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, Header, HTTPException

from . import copilot, scoring
from .models import CopilotRequest, CopilotResponse, RecommendationRequest, RecommendationResponse

app = FastAPI(
    title="Perkly recommendation service",
    version="2.0.0",
    description="Transparent rule-based ranking of partner rewards, with explanations, and a rule-based Copilot.",
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


@app.post("/api/copilot", response_model=CopilotResponse, dependencies=[Depends(require_service_key)])
def copilot_answer(req: CopilotRequest) -> CopilotResponse:
    return copilot.answer(req)
