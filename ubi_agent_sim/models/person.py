# models/person.py
from dataclasses import dataclass

@dataclass
class Person:
    id: int
    age: int
    hourly_wage: float
    work_hours: float
    saving: float
    household_id: int
    happiness: float = 5.0

    def step(self, policy, macro_state, basic_need):
        # 1. 労働時間決定
        # UBI額が基礎的ニーズに届かない分を労働で稼ぐという単純化モデル
        gap = max(0, basic_need - policy.ubi_amount)
        target_hours = gap / (self.hourly_wage * 4 + 1e-6)
        
        # 慣性を持たせて急激な変化を防ぐ
        self.work_hours = max(0, min(60, 0.7 * self.work_hours + 0.3 * target_hours))

        # 2. 収入更新
        income_labor = self.hourly_wage * self.work_hours * 4
        income_total = income_labor + policy.ubi_amount
        
        # 税は簡易的に定率で引いて貯蓄へ (消費はこのモデルでは省略されているが、残余が貯蓄となる)
        # 実際には消費関数を入れるべきだが、プロトタイプなので簡易化
        disposable_income = income_total * (1 - policy.income_tax_rate) # 税を引く実装を追加
        self.saving += disposable_income * 0.2 # 可処分所得の2割を貯蓄と仮定

        # 3. 幸福度を簡易更新
        # 所得が高いほど高いが、長時間労働はマイナス
        self.happiness = 5 + 0.00001 * income_total - 0.05 * max(0, self.work_hours - 40)
