# sim/environment.py
import numpy as np
from config.jobs import JOB_DEFINITIONS
from models.person import Person
from models.household import Household
from models.government import Government
from config.policy import Policy


class Environment:
    def __init__(self, n_households=200, persons_per_household=2):
        self.policy = Policy()
        self.persons = {}
        self.households = {}
        self.government = Government()
        self.steps = 0
        self.ai_intensity = 0.0
        self.history = []
        self.price_level = 1.0
        self.inflation_rate = 0.0

        # Base demand reference (computed after agent creation)
        self._base_demand = 0.0

        job_probs = [0.25, 0.35, 0.25, 0.15]

        pid = 0
        for hid in range(n_households):
            member_ids = []
            for _ in range(persons_per_household):
                job = np.random.choice(JOB_DEFINITIONS, p=job_probs)
                p = Person(
                    id=pid,
                    job_profile=job,
                    hourly_wage=np.random.normal(job.base_wage, job.base_wage * 0.2),
                    work_hours=40,
                    alpha=np.random.beta(6, 4),
                    adaptability=np.random.beta(5, 5),
                    household_id=hid
                )
                if p.hourly_wage < 800:
                    p.hourly_wage = 800
                self.persons[pid] = p
                member_ids.append(pid)
                pid += 1

            # Children: 0 (60%), 1 (25%), 2 (15%)
            children = int(np.random.choice([0, 1, 2], p=[0.60, 0.25, 0.15]))
            self.households[hid] = Household(id=hid, member_ids=member_ids, children_count=children)

        # Compute base demand (labor income without UBI)
        self._base_demand = sum(
            p.hourly_wage * p.work_hours * 4 for p in self.persons.values()
        )

    def step(self):
        self.steps += 1
        self.ai_intensity = min(1.0, self.steps / 120.0)

        total_income_sum = sum(p.total_income for p in self.persons.values())
        avg_income = total_income_sum / len(self.persons) if self.persons else 0

        env_state = {
            'ai_intensity': self.ai_intensity,
            'avg_income': avg_income,
            'price_level': self.price_level,
        }

        # Step Agents
        for p in self.persons.values():
            p.step(self.policy, env_state)

        # Aggregate Households (includes welfare calculation)
        for h in self.households.values():
            h.aggregate(self.persons)
            h.calculate_welfare(self.policy)

        # --- Government Fiscal ---
        self.government.reset_monthly()
        for p in self.persons.values():
            self.government.income_tax_revenue += p.tax_paid
            consumption = p.disposable_income * 0.8
            self.government.consumption_tax_revenue += consumption * self.policy.consumption_tax_rate
            self.government.ubi_spending += self.policy.ubi_amount

        # Welfare replacement savings
        for h in self.households.values():
            replaced = h.welfare_received * self.policy.welfare_replacement_rate
            self.government.welfare_savings += replaced
            self.government.welfare_spending += h.welfare_received - replaced

        # Debt accumulation
        deficit = self.government.deficit
        if deficit > 0:
            self.government.debt += deficit

        # --- Inflation Model ---
        total_disposable = sum(p.disposable_income for p in self.persons.values())
        excess_ratio = (total_disposable - self._base_demand) / (self._base_demand + 1) if self._base_demand > 0 else 0

        n_persons = len(self.persons)
        unemployed_count = sum(1 for p in self.persons.values() if p.is_unemployed)
        unemployment_rate = unemployed_count / n_persons if n_persons > 0 else 0.0
        supply_tightness = max(0, 1.0 - (1.0 - unemployment_rate))

        base_monthly = 0.001  # ~1.2% annual (Japan target)
        demand_inflation = excess_ratio * 0.002
        supply_inflation = supply_tightness * 0.001
        self.inflation_rate = min(base_monthly + demand_inflation + supply_inflation, 0.02)
        self.price_level *= (1 + self.inflation_rate)

        # --- Macro Statistics ---
        incomes = sorted(h.income for h in self.households.values())
        n_hh = len(incomes)
        total_inc = sum(incomes)

        if n_hh > 0 and total_inc > 0:
            cum = 0
            gini_sum = 0
            for i, y in enumerate(incomes):
                cum += y
                gini_sum += (2 * (i + 1) - n_hh - 1) * y
            gini = gini_sum / (n_hh * cum)
        else:
            gini = 0.0

        avg_happiness = sum(p.happiness for p in self.persons.values()) / n_persons if n_persons > 0 else 0.0
        avg_work_hours = sum(p.work_hours for p in self.persons.values()) / n_persons if n_persons > 0 else 0.0
        avg_income_new = sum(p.total_income for p in self.persons.values()) / n_persons if n_persons > 0 else 0.0

        poor_count = sum(1 for h in self.households.values() if h.is_poor)
        poverty_rate = poor_count / n_hh if n_hh > 0 else 0.0

        # --- Snapshot ---
        snapshot = {
            "step": self.steps,
            "year": self.steps // 12,
            "macro": {
                "gini": round(gini, 4),
                "unemployment_rate": round(unemployment_rate, 4),
                "avg_happiness": round(avg_happiness, 2),
                "avg_work_hours": round(avg_work_hours, 2),
                "avg_income": round(avg_income_new, 0),
                "poverty_rate": round(poverty_rate, 4),
                "inflation_rate": round(self.inflation_rate * 100, 4),
                "price_level": round(self.price_level, 4),
                "real_ubi_value": round(self.policy.ubi_amount / self.price_level, 0),
                "gov_revenue": round(self.government.total_revenue, 0),
                "gov_ubi_cost": round(self.government.ubi_spending, 0),
                "gov_deficit": round(deficit, 0),
                "gov_debt": round(self.government.debt, 0),
            },
            "agents": []
        }
        for p in self.persons.values():
            snapshot["agents"].append({
                "id": p.id,
                "job": p.job_profile.name,
                "income": p.total_income,
                "happiness": p.happiness,
                "is_unemployed": p.is_unemployed,
                "work_hours": p.work_hours,
                "hourly_wage": p.hourly_wage,
            })

        self.history.append(snapshot)

    def get_history(self):
        return self.history
