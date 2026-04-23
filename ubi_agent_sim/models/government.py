# models/government.py
from dataclasses import dataclass


@dataclass
class Government:
    """政府の財政収支を追跡 — UBI支出 vs 税収"""
    income_tax_revenue: float = 0.0
    consumption_tax_revenue: float = 0.0
    ubi_spending: float = 0.0
    welfare_spending: float = 0.0
    welfare_savings: float = 0.0
    debt: float = 0.0

    @property
    def total_revenue(self) -> float:
        return self.income_tax_revenue + self.consumption_tax_revenue + self.welfare_savings

    @property
    def total_expenditure(self) -> float:
        return self.ubi_spending + self.welfare_spending

    @property
    def deficit(self) -> float:
        return self.total_expenditure - self.total_revenue

    def reset_monthly(self):
        self.income_tax_revenue = 0.0
        self.consumption_tax_revenue = 0.0
        self.ubi_spending = 0.0
        self.welfare_spending = 0.0
        self.welfare_savings = 0.0
