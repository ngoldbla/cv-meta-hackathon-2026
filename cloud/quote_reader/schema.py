"""The Quote schema (task 046/047), mirrored from lowkey/app/lib/quote/schema.ts.

The reader is forced to emit exactly this JSON (grammar-constrained
decoding), so its output is always schema-valid. Every field is
nullable: the model must say "not on the page" instead of guessing.
"""

from typing import Literal

from pydantic import BaseModel, Field


class Fee(BaseModel):
    label: str
    amount: float | None = None
    kind: Literal["government", "dealer", "addon", "unknown"]


class ReadQuote(BaseModel):
    doc_type: Literal["window_sticker", "buyers_order", "payment_offer", "listing_sheet", "other"]
    vin: str | None = Field(None, description="17 characters exactly as printed, else null")
    year: int | None = None
    make: str | None = None
    model: str | None = None
    trim: str | None = None
    used: bool | None = None
    mileage: int | None = None
    dealer_name: str | None = None
    selling_price: float | None = None
    msrp: float | None = None
    rebates: float | None = None
    trade_in: float | None = None
    down: float | None = None
    out_the_door: float | None = None
    stated_monthly: float | None = None
    apr: float | None = Field(None, description="percent, e.g. 5.9")
    term_months: int | None = None
    fees: list[Fee] = []
    epa_combined_mpg: int | None = None
