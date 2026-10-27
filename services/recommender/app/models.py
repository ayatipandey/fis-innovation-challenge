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


class SplitRules(Loose):
    programId: str
    unitValue: float
    minUnits: int
    step: int
    maxUnits: Optional[int] = None


class Redemption(Loose):
    methods: list[str] = Field(default_factory=list)
    split: Optional[SplitRules] = None
    providerOnly: bool = False


class YouPay(Loose):
    knownFees: list[str] = Field(default_factory=list)
    feesUnknown: bool = False


class Valid(Loose):
    channels: list[str] = Field(default_factory=list)
    paymentMethods: list[str] = Field(default_factory=list)
    accounts: list[str] = Field(default_factory=list)


class RewardIn(Loose):
    """The subset of an offer the scorer needs."""

    id: str
    brandId: str
    brandName: str
    programId: Optional[str] = None
    category: str
    headline: str = ""
    benefit: Benefit
    valueEstimate: ValueEstimate
    minSpend: Optional[float] = None
    maxBenefit: Optional[float] = None
    validFrom: str
    expiresAt: str
    redemption: Redemption
    youPay: YouPay = Field(default_factory=YouPay)
    valid: Valid = Field(default_factory=Valid)
    nearby: Optional[Nearby] = None
    routine: list[str] = Field(default_factory=list)
    sponsored: bool = False
    demoPurchaseTotal: Optional[float] = None


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
    paymentMethods: list[str] = Field(default_factory=list)
    personalization: bool = True
    balances: dict[str, float] = Field(default_factory=dict)


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


class RedemptionOption(Loose):
    label: str
    unitsRequired: float = Field(gt=0)
    unit: Literal["points", "miles"] = "miles"
    cashPrice: Optional[float] = Field(default=None, ge=0)
    fees: float = Field(default=0, ge=0)
    restrictions: list[str] = Field(default_factory=list)
    expiresAt: Optional[str] = None
    flexibility: Optional[str] = None


class CompareRequest(Loose):
    options: list[RedemptionOption] = Field(min_length=1, max_length=10)
    balance: Optional[float] = None


class ComparedOption(BaseModel):
    label: str
    unitsRequired: float
    cashPrice: Optional[float]
    fees: float
    valuePerUnitCents: Optional[float]
    affordable: Optional[bool]
    restrictions: list[str]
    expiresAt: Optional[str]
    flexibility: Optional[str]


class CompareResponse(BaseModel):
    options: list[ComparedOption]
    formula: str
    summary: str
    assumptions: list[str]
    limitations: list[str]


class EligibilityConditions(Loose):
    channels: list[str] = Field(default_factory=list)
    paymentMethods: list[str] = Field(default_factory=list)
    minSpend: Optional[float] = None
    validFrom: Optional[str] = None
    expiresAt: Optional[str] = None
    requiresProgram: Optional[str] = None
    activationRequired: bool = False
    excludedTransactions: list[str] = Field(default_factory=list)


class EligibilityContext(Loose):
    now: str
    channel: Optional[str] = None
    paymentMethod: Optional[str] = None
    purchaseTotal: Optional[float] = None
    connectedPrograms: Optional[list[str]] = None
    activated: Optional[bool] = None


class EligibilityRequest(Loose):
    conditions: EligibilityConditions
    context: EligibilityContext


class EligibilityCheck(BaseModel):
    rule: str
    result: Literal["pass", "fail", "unknown"]
    reason: str


class EligibilityResponse(BaseModel):
    status: Literal["eligible", "ineligible", "unknown"]
    checks: list[EligibilityCheck]
    summary: str


class Program(Loose):
    id: str
    name: str
    unit: str
    unitValue: Optional[float] = None


class CopilotRequest(Loose):
    message: str = Field(min_length=1, max_length=1000)
    user: UserSummary
    rewards: list[RewardIn] = Field(max_length=500)
    programs: list[Program] = Field(default_factory=list)
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
