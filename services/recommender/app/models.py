"""Request and response models. Field names match the Node API's camelCase JSON."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class Loose(BaseModel):
    model_config = ConfigDict(extra="ignore")


class Habits(Loose):
    visitsPerWeek: dict[str, float] = Field(default_factory=dict)
    typicalSpend: dict[str, float] = Field(default_factory=dict)
    hourShare: dict[str, list[float]] = Field(default_factory=dict)
    spendVelocity: dict[str, float] = Field(default_factory=dict)


class MerchantIn(Loose):
    id: str
    name: str
    lat: float
    lng: float
    opens: int
    closes: int
    category: str


class Candidate(Loose):
    """One reward the member can afford right now."""

    optionId: str
    programId: str
    programName: str
    unit: str = "points"
    title: str
    cost: float
    value: float
    minSpend: Optional[float] = None
    channels: list[str] = Field(default_factory=list)
    available: float
    expiringPoints: float = 0
    daysToExpiry: Optional[float] = None
    category: Optional[str] = None
    merchants: list[MerchantIn] = Field(default_factory=list)


class Context(Loose):
    now: str
    hour: int = Field(ge=0, le=23)
    minute: int = Field(default=0, ge=0, le=59)
    weekday: int = Field(ge=0, le=6)
    lat: Optional[float] = None
    lng: Optional[float] = None
    source: Literal["simulated", "device"] = "simulated"


class QuietHours(Loose):
    enabled: bool = False
    start: str = "21:00"
    end: str = "08:00"


class Prefs(Loose):
    quietHours: QuietHours = Field(default_factory=QuietHours)
    dailyLimit: int = 3
    sentToday: int = 0
    locationAllowed: bool = False
    personalization: bool = True


class RatingCounts(Loose):
    good: int = 0
    fine: int = 0
    bad: int = 0


class MomentRequest(Loose):
    context: Context
    prefs: Prefs = Field(default_factory=Prefs)
    habits: Habits = Field(default_factory=Habits)
    ratings: dict[str, RatingCounts] = Field(default_factory=dict)
    candidates: list[Candidate] = Field(max_length=200)


class Scored(BaseModel):
    optionId: str
    programId: str
    merchantId: Optional[str]
    merchantName: Optional[str]
    distanceM: Optional[int]
    pIfNotified: float
    pIfNot: float
    uplift: float
    expectedExtraValue: float


class MomentDecision(BaseModel):
    sent: bool
    optionId: Optional[str]
    programId: Optional[str]
    merchantId: Optional[str]
    title: str
    body: str
    reasons: list[str]
    suppressedBecause: Optional[str]
    uplift: float
    pIfNotified: float
    pIfNot: float
    distanceM: Optional[int]
    bucket: str
    category: Optional[str]


class MomentResponse(BaseModel):
    decision: MomentDecision
    considered: list[Scored]
    model: str
    threshold: float


class PlanIn(Loose):
    label: str
    totalValue: float
    pointsUsed: float
    leftover: float
    visits: int
    extraSpend: float
    valueAtRisk: float
    score: float
    reasons: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    optionIds: list[str] = Field(default_factory=list)


class ExpiryIn(Loose):
    points: float
    days: float


class ProgramIn(Loose):
    programId: str
    name: str
    unit: str = "points"
    available: float
    expiries: list[ExpiryIn] = Field(default_factory=list)
    plans: list[PlanIn] = Field(default_factory=list)


class PilotRequest(Loose):
    message: str = Field(min_length=1, max_length=1000)
    context: Context
    prefs: Prefs = Field(default_factory=Prefs)
    habits: Habits = Field(default_factory=Habits)
    ratings: dict[str, RatingCounts] = Field(default_factory=dict)
    programs: list[ProgramIn] = Field(default_factory=list)
    candidates: list[Candidate] = Field(default_factory=list, max_length=200)


class Table(BaseModel):
    columns: list[str]
    rows: list[list[str]]


class PilotResponse(BaseModel):
    reply: str
    cards: list[str]
    table: Optional[Table] = None
    notes: list[str]
    followUps: list[str]
    engine: Literal["perkly-pilot-v1"] = "perkly-pilot-v1"
