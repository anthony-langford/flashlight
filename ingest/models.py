from __future__ import annotations

from datetime import date
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class Source(StrEnum):
    BOC_VALET = "boc_valet"
    FRED = "fred"
    STATCAN = "statcan"
    MANUAL = "manual"


class Frequency(StrEnum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUAL = "annual"


class Layer(StrEnum):
    RATES_CREDIT = "rates_credit"
    TORONTO_MARKET = "toronto_market"
    AFFORDABILITY = "affordability"
    SUPPLY = "supply"
    DEMAND = "demand"
    RENTAL = "rental"
    CANADA_MACRO = "canada_macro"
    US_INPUTS = "us_inputs"


class Explainer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    what: str
    why_it_matters: str
    how_to_read: str
    moves_with: list[str] = Field(default_factory=list)


class SeriesDef(BaseModel):
    """One catalogue entry. `id` is the stable internal slug used everywhere else."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^[a-z0-9_]+(\.[a-z0-9_]+)+$")
    title: str
    source: Source
    source_id: str
    source_ref: str | None = None  # human-readable pointer, e.g. table and coordinate
    frequency: Frequency
    unit: str
    geography: str
    layer: Layer
    seasonal_adj: bool | None = None
    explainer: Explainer | None = None
    licence_note: str | None = None
    verified_on: date | None = None


class Observation(BaseModel):
    obs_date: date
    value: float
