# config/policy.py
from dataclasses import dataclass

@dataclass
class Policy:
    ubi_amount: float = 70_000 # Monthly
    income_tax_rate: float = 0.0 # Used for flat tax if progressive is False
    consumption_tax_rate: float = 0.10 # 10%
    use_progressive_tax: bool = True # Enable Japan 2025 Progressive Tax logic
