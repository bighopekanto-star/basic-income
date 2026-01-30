# UBIエージェント実装クイックガイド

作成日：2026-01-30  
目的：上記仕様を「最低限動くコード」にするための実装手順メモ

---

## 0. 前提

- 言語：Python 3.11+
- ライブラリ：
  - `numpy`, `pydantic`（型定義用）, `matplotlib or plotly`（可視化）
- このガイドは
  - 「1〜2日でプロトタイプ」を作るための最短ルートを意識

---

## 1. プロジェクト構成（例）

```text
ubi_agent_sim/
  ├─ main.py
  ├─ models/
  │    ├─ person.py
  │    ├─ household.py
  │    └─ firm.py
  ├─ sim/
  │    ├─ environment.py
  │    └─ runner.py
  ├─ config/
  │    └─ policy.yaml
  └─ notebooks/
       └─ quick_test.ipynb
```

## 2. 最小実装ステップ

### Step 1：Personクラス
```python
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
        gap = max(0, basic_need - policy.ubi_amount)
        target_hours = gap / (self.hourly_wage * 4 + 1e-6)
        self.work_hours = max(0, min(60, 0.7 * self.work_hours + 0.3 * target_hours))

        # 2. 収入更新
        income_labor = self.hourly_wage * self.work_hours * 4
        income_total = income_labor + policy.ubi_amount
        # 税はとりあえず無視 or 定率
        self.saving += income_total * 0.2

        # 3. 幸福度を簡易更新
        self.happiness = 5 + 0.001 * income_total - 0.05 * max(0, self.work_hours - 40)
```

### Step 2：Householdクラス（簡略）
```python
# models/household.py
from dataclasses import dataclass, field
from typing import List

@dataclass
class Household:
    id: int
    member_ids: List[int] = field(default_factory=list)
    income: float = 0.0
    poverty_line: float = 200_000  # 月

    def aggregate(self, persons: dict[int, "Person"]):
        self.income = sum(persons[pid].hourly_wage * persons[pid].work_hours * 4
                          + persons[pid].saving * 0
                          for pid in self.member_ids)

    @property
    def is_poor(self) -> bool:
        return self.income < self.poverty_line
```

### Step 3：Policyクラス
```python
# config/policy.py
from dataclasses import dataclass

@dataclass
class Policy:
    ubi_amount: float = 100_000
    income_tax_rate: float = 0.2
```

### Step 4：Environment & Runner
```python
# sim/environment.py
import numpy as np
from models.person import Person
from models.household import Household
from config.policy import Policy

class Environment:
    def __init__(self, n_households=1000, persons_per_household=2):
        self.policy = Policy()
        self.persons = {}
        self.households = {}
        pid = 0
        for hid in range(n_households):
            member_ids = []
            for _ in range(persons_per_household):
                p = Person(
                    id=pid,
                    age=np.random.randint(20, 60),
                    hourly_wage=np.random.normal(1200, 300),
                    work_hours=40,
                    saving=0,
                    household_id=hid,
                )
                self.persons[pid] = p
                member_ids.append(pid)
                pid += 1
            self.households[hid] = Household(id=hid, member_ids=member_ids)

    def step(self):
        basic_need = 150_000
        macro_state = {}
        for p in self.persons.values():
            p.step(self.policy, macro_state, basic_need)

        for h in self.households.values():
            h.aggregate(self.persons)
```

```python
# sim/runner.py
from sim.environment import Environment
import numpy as np

def run_sim(years=5, steps_per_year=12):
    env = Environment()
    poverty_rates = []

    for t in range(years * steps_per_year):
        env.step()
        poor = sum(1 for h in env.households.values() if h.is_poor)
        poverty_rates.append(poor / len(env.households))

    return np.array(poverty_rates)
```

## 3. 実験の回し方
```python
# main.py
from sim.runner import run_sim
import matplotlib.pyplot as plt

if __name__ == "__main__":
    poverty = run_sim()
    plt.plot(poverty)
    plt.title("Poverty rate over time with UBI")
    plt.xlabel("Months")
    plt.ylabel("Poverty rate")
    plt.show()
```

## 4. 拡張の方向性メモ
- **税金ロジックの追加**
- **起業状態** `occupation_type = self_employed` の追加
- **幸福度**に「UBIレポート」で整理した指標（メンタルヘルス、教育投資）を反映
- フロントエンドから `policy.ubi_amount` を操作できるようにして**インタラクティブ化**
