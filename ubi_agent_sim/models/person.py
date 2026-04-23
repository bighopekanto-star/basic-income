# models/person.py
import numpy as np
from dataclasses import dataclass
from config.jobs import JobDef

@dataclass
class Person:
    id: int
    job_profile: JobDef 
    household_id: int
    hourly_wage: float
    work_hours: float
    alpha: float         # 余暇選好パラメータ (0.0-1.0)
    adaptability: float  # AI適応力 (0.0-1.0)
    is_unemployed: bool = False
    unemployed_duration: int = 0
    happiness: float = 0.0
    total_income: float = 0.0
    saving: float = 0.0
    tax_paid: float = 0.0
    disposable_income: float = 0.0

    def calculate_progressive_tax(self, annual_income):
        """
        Japan 2025 National Income Tax + Resident Tax (Simplified)
        National:
        - 1.95M: 5%
        - 3.3M: 10%
        - 6.95M: 20%
        - 9.0M: 23%
        - 18.0M: 33%
        - 40.0M: 40%
        - >40M: 45%
        Resident Tax: Flat 10% (simplified)
        
        * Deductions are simplified or ignored for this macro-model, 
          assuming 'annual_income' is taxable income for simplicity 
          or applying a standard rough deduction factor implicitly.
        """
        # 1. National Income Tax
        taxable = max(0, annual_income - 480000) # Basic deduction proxy
        
        brackets = [
            (1950000, 0.05),
            (3300000, 0.10),
            (6950000, 0.20),
            (9000000, 0.23),
            (18000000, 0.33),
            (40000000, 0.40),
            (float('inf'), 0.45)
        ]
        
        national_tax = 0
        previous_limit = 0
        
        remaining = taxable
        
        for limit, rate in brackets:
            if taxable <= previous_limit:
                break
            
            bracket_width = limit - previous_limit
            taxable_in_bracket = min(remaining, bracket_width)
            
            national_tax += taxable_in_bracket * rate
            remaining -= taxable_in_bracket
            previous_limit = limit
            
            if remaining <= 0:
                break
                
        # 2. Resident Tax (Local) ~10%
        resident_tax = taxable * 0.10
        
        return national_tax + resident_tax

    def step(self, policy, env_state):
        # --- Phase 1: AI Impact (Dr. Singularity & Dr. Augment) ---
        ai_pressure = env_state['ai_intensity'] * self.job_profile.ai_exposure
        
        if not self.is_unemployed:
            # 代替判定: 圧力 * リスク > 適応力 + ランダム要素
            risk_threshold = ai_pressure * self.job_profile.displacement_risk
            prob_fire = risk_threshold - (self.adaptability * 0.3)
            
            if np.random.random() < prob_fire:
                self.is_unemployed = True
                self.unemployed_duration = 0
                self.work_hours = 0
            else:
                # 補完判定: 賃金上昇
                gain_prob = ai_pressure * self.job_profile.augmentation_potential * self.adaptability
                if np.random.random() < gain_prob:
                    self.hourly_wage *= (1 + 0.02) # 生産性向上 2%
        
        # --- Phase 2: Labor Supply (Prof. Neoclassical & Institutional) ---
        if self.is_unemployed:
            # 再就職活動
            self.unemployed_duration += 1
            if np.random.random() < 0.1: # 10% chance
                self.is_unemployed = False
                self.hourly_wage *= 0.9 # ブランクによるペナルティ
            else:
                self.work_hours = 0
        
        if not self.is_unemployed:
            # 効用最大化: H* = alpha * T - (1-alpha) * (NonLaborIncome / Wage)
            T_max = 60
            non_labor_income_weekly = policy.ubi_amount / 4.0
            wage = max(self.hourly_wage, 1.0)
            
            # Tax impact on labor supply? 
            # Ideally should use net wage, but keeping simplified gross wage for H decision 
            # to avoid circular dependency or complex numerical optimization for now.
            # Or assume marginal tax rate ~30% for optimization intuition
            
            optimal_h = self.alpha * T_max - (1 - self.alpha) * (non_labor_income_weekly / wage)
            self.work_hours = max(0, min(T_max, optimal_h))

        # --- Phase 3: Utility (Dr. Behavior) ---
        monthly_labor_income = self.hourly_wage * self.work_hours * 4
        annual_est_income = monthly_labor_income * 12 # Approximate for tax bracket
        
        # Calculate Tax
        if policy.use_progressive_tax:
            annual_tax = self.calculate_progressive_tax(annual_est_income)
            monthly_tax = annual_tax / 12
        else:
            monthly_tax = monthly_labor_income * policy.income_tax_rate

        self.total_income = monthly_labor_income + policy.ubi_amount
        disposable_income = self.total_income - monthly_tax
        self.tax_paid = monthly_tax
        self.disposable_income = disposable_income

        self.saving += disposable_income * 0.2

        # Real Consumption (Deflated by Consumption Tax + Inflation)
        price_level = env_state.get('price_level', 1.0)
        real_consumption = disposable_income / (price_level * (1 + policy.consumption_tax_rate))
        
        basic_need = 150000
        
        # 幸福度 = 所得効用(対数) - 労働不効用(指数) + 相対的地位
        val_income = max(real_consumption - basic_need * 0.5, 100) 
        utility_income = np.log(val_income) 
        
        utility_leisure = -0.01 * (self.work_hours ** 1.5)
        
        avg_inc = env_state.get('avg_income', 300000)
        utility_status = 0.5 * np.log(self.total_income / (avg_inc + 1))
        
        self.happiness = utility_income + utility_leisure + utility_status
