# models/household.py
from dataclasses import dataclass, field
from typing import List, Dict

@dataclass
class Household:
    id: int
    member_ids: List[int] = field(default_factory=list)
    income: float = 0.0
    poverty_line: float = 200_000  # 月

    # 型ヒントのために文字列参照を使用しないように修正、または実行時解決
    def aggregate(self, persons):
        # personsは {id: Person} の辞書を想定
        self.income = sum(persons[pid].hourly_wage * persons[pid].work_hours * 4
                          for pid in self.member_ids)
        # UBIなどの合算ロジックはPerson側で計算したincome_totalを集計するのが望ましいが
        # ここでは労働所得の合算例として実装

    @property
    def is_poor(self) -> bool:
        return self.income < self.poverty_line
