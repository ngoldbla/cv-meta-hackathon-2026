"""The Quote schema (task 046/047), mirrored from lowkey/app/lib/quote/schema.ts.

The reader is forced to emit exactly this JSON (grammar-constrained
decoding), so its output is always schema-valid. Every field is
nullable: the model must say "not on the page" instead of guessing.
`transcript` comes first on purpose: the model copies the page's text
before it fills fields (a read-then-extract pass inside one response).
"""

from typing import Literal

from pydantic import BaseModel, Field


class Fee(BaseModel):
    label: str = Field(description="The fee's name as printed")
    amount: float | None = Field(None, description="Dollar amount printed next to it")
    kind: Literal["government", "dealer", "addon", "unknown"] = Field(
        description="government = tax/title/registration; dealer = doc or dealer fee; "
        "addon = optional or dealer-installed product; unknown otherwise"
    )


class ReadQuote(BaseModel):
    transcript: list[str] = Field(description="Every line of text on the page, top to bottom, copied exactly")
    doc_type: Literal["window_sticker", "buyers_order", "payment_offer", "listing_sheet", "other"]
    vin: str | None = Field(None, description="The 17-character VIN printed on the page, copied exactly")
    year: int | None = Field(None, description="Model year, e.g. 2026")
    make: str | None = None
    model: str | None = None
    trim: str | None = None
    used: bool | None = None
    mileage: int | None = None
    dealer_name: str | None = None
    selling_price: float | None = Field(None, description="Vehicle price / cash price before fees")
    msrp: float | None = Field(None, description="Total MSRP on a window sticker")
    rebates: float | None = None
    trade_in: float | None = None
    down: float | None = Field(None, description="Down payment / cash down")
    out_the_door: float | None = Field(None, description="Total out-the-door price")
    stated_monthly: float | None = Field(None, description="The monthly payment the document states")
    apr: float | None = Field(
        None, description="Annual percentage rate as a percent, e.g. 'APR 7.25%' -> 7.25"
    )
    term_months: int | None = Field(None, description="Loan length in months")
    fees: list[Fee] = Field(
        default_factory=list,
        description="Only fee and charge lines. NOT the vehicle price, down payment, total, APR or term.",
    )
    epa_combined_mpg: int | None = None


class Pair(BaseModel):
    label: str = Field(description="A label printed on the page, copied exactly, e.g. 'Selling price'")
    value: str = Field(description="The value printed for that label, copied exactly, e.g. '$28,450.00'")


class RawRead(BaseModel):
    """What the model is forced to emit. normalize.py turns it into a quote."""

    transcript: list[str] = Field(
        min_length=1,
        description="Top to bottom, copied exactly: every line with a number, price, fee, tax, rate, "
        "term, payment, VIN, the vehicle's year and name, or the dealer. Skip lists of standard "
        "features or equipment and legal fine print.",
    )
    doc_type: Literal["window_sticker", "buyers_order", "payment_offer", "listing_sheet", "other"]
    pairs: list[Pair] = Field(
        min_length=1,
        description="Every printed label with its printed value (price, fees, down payment, "
        "total, payment...). Pair by meaning, not by position: on a tilted photo a value "
        "can sit on a different line than its label.",
    )
    fees: list[Fee] = Field(
        default_factory=list,
        description="Only fee and charge lines. NOT the vehicle price, down payment, total, APR or term.",
    )


class TermPair(BaseModel):
    kind: Literal["price", "msrp", "down", "apr", "term", "monthly", "out_the_door", "mileage", "vin"]
    label: str = Field(description="The label printed on the page, copied exactly")
    value: str = Field(description="The value printed for that label, copied exactly")


class TermsRead(BaseModel):
    """Task 057: the small read. Only the money terms, the mileage and the VIN."""

    pairs: list[TermPair] = Field(
        min_length=1,
        description="Only the listed kinds, each as printed. Skip everything else.",
    )
