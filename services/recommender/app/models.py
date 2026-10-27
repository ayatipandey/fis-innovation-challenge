"""Request and response models. Field names match the Node API's camelCase JSON."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class Loose(BaseModel):
    model_config = ConfigDict(extra="ignore")


class Benefit(Loose):
    kind: str
    value: Optional[float] = None
    unit: Optional[str] = None
    summary: str = ""


class ValueEstimate(Loose):
    amount: Optional[float] = None
    basis: str = ""


class Nearby(Loose):
    label: str
    distanceMeters: int


class Redemption(Loose):
    url: Optional[str] = None


class YouPay(Loose):
    knownFees: list[str] = Field(default_factory=list)
    feesUnknown: bool = False


class Valid(Loose):
    channels: list[str] = Field(default_factory=list)


class RewardIn(Loose):
    """The subset of an offer the scorer needs."""

    id: str
    brandId: str
    brandName: str
    category: str
    headline: str = ""
    benefit: Benefit
    valueEstimate: ValueEstimate
    minSpend: Optional[float] = None
    maxBenefit: Optional[float] = None
    validFrom: str
    expiresAt: str
    redemption: Redemption = Field(default_factory=Redemption)
    youPay: YouPay = Field(default_factory=YouPay)
    valid: Valid = Field(default_factory=Valid)
    nearby: Optional[Nearby] = None
    routine: list[str] = Field(default_factory=list)
    sponsored: bool = False


class Spending(Loose):
    share: dict[str, float] = Field(default_factory=dict)
    typicalSpend: dict[str, float] = Field(default_factory=dict)
    source: str = "none"


class UserSummary(Loose):
    """Only what the user has permitted Perkly to use."""

    categories: list[str] = Field(default_factory=list)
    favoriteBrands: list[str] = Field(default_factory=list)
    spending: Optional[Spending] = None
    brandHistory: dict[str, int] = Field(default_factory=dict)
    personalization: bool = True


class TimeContext(Loose):
    now: str
    weekday: int = Field(ge=0, le=6, description="0 = Monday")
    hour: int = Field(ge=0, le=23)


class LocationContext(Loose):
    permitted: bool = False
    label: Optional[str] = None


class RecommendationRequest(Loose):
    user: UserSummary
    rewards: list[RewardIn] = Field(max_length=500)
    time: TimeContext
    location: Optional[LocationContext] = None
    limit: int = Field(default=20, ge=1, le=100)


class RankedReward(BaseModel):
    offerId: str
    score: float
    reasons: list[str]
    warnings: list[str]


class RecommendationResponse(BaseModel):
    items: list[RankedReward]
    engine: Literal["perkly-scorer-v1"] = "perkly-scorer-v1"
    generatedAt: str
    note: str


class CopilotRequest(Loose):
    message: str = Field(min_length=1, max_length=1000)
    user: UserSummary
    rewards: list[RewardIn] = Field(max_length=500)
    time: TimeContext
    location: Optional[LocationContext] = None


class Table(BaseModel):
    columns: list[str]
    rows: list[list[str]]


class CopilotResponse(BaseModel):
    reply: str
    cards: list[str]
    table: Optional[Table] = None
    notes: list[str]
    followUps: list[str]
    engine: Literal["rule-based-v1"] = "rule-based-v1"
