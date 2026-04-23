# models/household.py
from dataclasses import dataclass, field
from typing import List


@dataclass
class Household:
    id: int
    member_ids: List[int] = field(default_factory=list)
    income: float = 0.0
    poverty_line: float = 200_000
    children_count: int = 0
    welfare_received: float = 0.0
    welfare_eligible: bool = False

    def aggregate(self, persons):
        self.income = sum(persons[pid].total_income for pid in self.member_ids)

    def calculate_welfare(self, policy):
        """簡易福祉計算: 生活保護 + 児童手当"""
        base_welfare = 0.0
        # 生活保護: 所得が貧困線未満の場合
        self.welfare_eligible = self.income < self.poverty_line
        if self.welfare_eligible:
            base_welfare = 130_000 * len(self.member_ids)
        # 児童手当: 子供1人あたり15,000円/月
        child_allowance = self.children_count * 15_000
        self.welfare_received = base_welfare + child_allowance

    @property
    def is_poor(self) -> bool:
        return self.income < self.poverty_line
