# config/policy.py
from dataclasses import dataclass


@dataclass
class Policy:
    ubi_amount: float = 70_000
    income_tax_rate: float = 0.0
    consumption_tax_rate: float = 0.10
    use_progressive_tax: bool = True
    welfare_replacement_rate: float = 0.0  # 0.0=なし, 1.0=完全代替
