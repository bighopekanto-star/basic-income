# config/policy.py
from dataclasses import dataclass

@dataclass
class Policy:
    ubi_amount: float = 100_000
    income_tax_rate: float = 0.2
