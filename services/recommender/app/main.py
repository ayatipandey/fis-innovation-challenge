"""Perkly AI service: the moment engine, Perkly's Pilot and the insights report.

Internal API called by the Node backend only. When RECOMMENDER_SERVICE_KEY is
set, every request must carry it in the X-Service-Key header. Routes are served
both at the root (local development) and under /api/ai (Vercel).
"""

from __future__ import annotations

import hmac
import json
import os
from pathlib import Path

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException

from . import engine, pilot
from .models import MomentRequest, MomentResponse, PilotRequest, PilotResponse

REPORT = json.loads((Path(__file__).parent / "model" / "report.json").read_text())

app = FastAPI(
    title="Perkly AI service",
    version="3.0.0",
    description="Uplift-based moment engine, Perkly's Pilot and the lift report. Trained on synthetic data.",
)


def require_service_key(x_service_key: str | None = Header(default=None)) -> None:
    expected = os.environ.get("RECOMMENDER_SERVICE_KEY")
    if expected and not (x_service_key and hmac.compare_digest(x_service_key, expected)):
        raise HTTPException(status_code=401, detail="Invalid service key")


router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "model": engine.MODEL["version"], "threshold": engine.THRESHOLD, "pilot": "perkly-pilot-v1", "synthetic": True}


@router.post("/moments/evaluate", response_model=MomentResponse, dependencies=[Depends(require_service_key)])
def moments(req: MomentRequest) -> MomentResponse:
    return engine.evaluate(req)


@router.post("/pilot", response_model=PilotResponse, dependencies=[Depends(require_service_key)])
def pilot_answer(req: PilotRequest) -> PilotResponse:
    return pilot.answer(req)


@router.get("/insights", dependencies=[Depends(require_service_key)])
def insights() -> dict:
    return REPORT


app.include_router(router)
app.include_router(router, prefix="/api/ai")
