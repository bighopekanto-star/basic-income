# UBIシミュレーター用 エージェント仕様書

作成日：2026-01-30  
対象：UBIエージェント・ベース拡張のコア仕様

---

## 1. 共通仕様

### 1.1 シミュレーション環境

- 時間：離散タイムステップ t = 0,1,2,...（単位：月）
- 空間：日本全体（地域はオプションで Prefecture を持たせる）
- 政策パラメータ：
  - ubi_amount（月額）
  - income_tax_rate
  - consumption_tax_rate
  - corporate_tax_rate
  - welfare_replacement_rate（既存福祉をどの程度UBIに置き換えるか）

### 1.2 エージェントID

- すべてのエージェントは一意の `id` を持つ
- `Person`, `Household`, `Firm` でID空間を分けるか、type付きIDを採用

---

## 2. Person Agent 仕様

### 2.1 状態変数

```text
Person:
- id: string
- age: int
- gender: {male, female, other}
- education_level: {low, medium, high}
- skill_level: float (0.0 - 1.0)
- occupation_type: {unemployed, blue_collar, white_collar, self_employed, student, retired}
- hourly_wage: float
- work_hours: float (per week)
- income_labor: float (per month)
- income_ubi: float (per month)
- income_other: float
- tax_paid: float
- disposable_income: float
- saving: float
- household_id: string
- stress_level: float (0 - 10)
- health_risk: float (0 - 1)
- happiness: float (0 - 10)
- risk_tolerance: float (0 - 1)
- entrepreneurship: float (0 - 1)
- unemployment_duration: int (months)
```

### 2.2 行動ルール（疑似コード）

#### 労働供給決定
```python
def decide_work_hours(person, policy, macro_state):
    # 必要生活費の推定
    basic_need = estimate_basic_need(person.household_id)

    # 現在の所得予測
    current_expected_income = person.hourly_wage * person.work_hours * 4 \
                              + policy.ubi_amount \
                              + person.income_other

    # UBI後の「最低確保額」
    safety_net = policy.ubi_amount

    # 不足額
    gap = max(0, basic_need - safety_net)

    # 労働供給の目標時間
    target_hours = gap / (person.hourly_wage * 4 + 1e-6)

    # ストレス・年齢・健康で調整
    target_hours = adjust_by_stress_and_health(target_hours, person)

    # 慣性効果
    new_hours = (1 - lambda_inertia) * target_hours + lambda_inertia * person.work_hours

    return clamp(new_hours, 0, 60)
```

#### 消費・貯蓄・教育投資
```python
def allocate_budget(person, household, policy):
    y = person.disposable_income

    # リスク回避度と貯蓄水準で割合を決定
    base_necessity_ratio = 0.6
    base_education_ratio = 0.1
    base_saving_ratio = 0.3

    if person.stress_level > 7:
        base_saving_ratio += 0.1
        base_education_ratio -= 0.05

    if person.entrepreneurship > 0.7:
        base_education_ratio += 0.1

    necessity = y * base_necessity_ratio
    education = y * base_education_ratio
    saving   = y * base_saving_ratio

    return necessity, education, saving
```

#### 起業・転職
```python
def decide_career_transition(person, labor_market, policy):
    if person.entrepreneurship > 0.8 and policy.ubi_amount > threshold:
        if person.saving + policy.ubi_amount * 6 > startup_buffer:
            return "start_business"

    # 転職は「期待賃金 - ストレス」で評価
    better_offer = search_labor_market(person, labor_market)
    if better_offer and expected_utility(better_offer) > expected_utility(current_job):
        return "change_job"

    return "stay"
```

---

## 3. Household Agent 仕様

### 3.1 状態変数
```text
Household:
- id: string
- members: list[Person.id]
- total_income: float
- rent: float
- children_count: int
- region: {urban, suburban, rural}
- housing_status: {rent, own}
- poverty_status: {poor, non_poor}
- subjective_wellbeing: float
```

### 3.2 行動ルール
- 所得と子どもの数から教育支出（塾・習い事）を決定
- 住宅のグレード変更（長期シミュレーションで）
- 世帯レベルの主観的幸福度をメンバーの幸福度の加重平均として計算

---

## 4. Firm Agent 仕様（簡略）

### 4.1 状態変数
```text
Firm:
- id: string
- industry: {manufacturing, service, it, care, etc.}
- productivity: float
- employees: list[Person.id]
- base_wage: float
- price_level: float
- demand: float
```

### 4.2 行動ルール（概要）
- 需要に応じて雇用数と賃金を調整
- インフレ期待に応じて価格を調整
- 政策（法人税）に応じて投資水準を変える（今回は定数近似でもよい）

---

## 5. マクロ指標の集計
- **GDP近似**：Σ（各Firmの売上）または Σ（労働所得＋企業利益）
- **貧困率**：poverty_status == poor の世帯比率
- **ジニ係数**：世帯所得分布から計算
- **失業率**：occupation_type == unemployed の労働力人口比
- **平均幸福度**：全Person.happiness の平均

---

## 6. 実装インターフェース

### 6.1 Pythonクラス構造（イメージ）
```python
class Person:
    def step(self, policy, macro_state, household, labor_market):
        self.decide_work_hours(...)
        self.update_income(policy)
        self.allocate_budget(...)
        self.update_happiness(...)

class Household:
    def step(self, policy, macro_state):
        self.update_income()
        self.update_poverty_status()
        self.update_wellbeing()

class Firm:
    def step(self, policy, macro_state, labor_market):
        self.update_demand(...)
        self.update_employment(...)
        self.update_wage_and_price(...)
```
