# models/person.py
import numpy as np
from dataclasses import dataclass

@dataclass
class OccupationProfile:
    name: str
    base_wage_mean: float
    ai_exposure: float
    displacement_risk: float  # 1.0 = High risk of firing
    productivity_gain: float  # 1.0 = High wage growth potential

class Person:
    def __init__(self, pid, profile: OccupationProfile, household_id):
        self.id = pid
        self.profile = profile
        self.household_id = household_id
        
        # Initial wage based on profile
        self.hourly_wage = np.random.normal(profile.base_wage_mean, profile.base_wage_mean * 0.2)
        if self.hourly_wage < 800: self.hourly_wage = 800
        
        # Preferences
        self.alpha = np.random.beta(5, 2) # Preference for Income vs Leisure (mean ~0.71)
        
        # State
        self.current_hours = 40.0
        self.is_unemployed = False
        self.unemployed_months = 0
        self.happiness = 0.0
        self.saving = 0.0
        self.total_income = 0.0

    def step(self, policy, macro_state, basic_need):
        """
        Execute one simulation step (1 month) for the person agent.
        """
        # --- Phase 1: AI Impact Check ---
        ai_intensity = macro_state.get('ai_intensity', 0.0)
        
        if not self.is_unemployed:
            # 1. Wage Growth (Productivity Gain)
            # Wage increases based on AI intensity and occupation's productivity potential
            growth_factor = 1 + (ai_intensity * self.profile.ai_exposure * self.profile.productivity_gain * 0.05) # Scaling factor 0.05 for monthly step? Maybe too high if applied every step. Let's assume annual adjustment distributed or small step.
            # adjusting scaling factor to be very small per month, or assume this is annual?
            # User instruction: "w_{i, t+1} = w_{i, t} * (1 + ...)"
            # Let's assume the coefficients are calibrated for the step size. If step is monthly, factors should be small.
            # "AI_Pressure_t" likely increases slowly. 
            self.hourly_wage *= (1 + (ai_intensity * self.profile.ai_exposure * self.profile.productivity_gain * 0.002)) # 0.002 * 12 ~ 2.4% max boost per year if intense

            # 2. Unemployment Risk
            # Probability increases with AI intensity and displacement risk
            # P(JobLoss) = Sigmoid(...) 
            # Simplified logistic probability
            risk_score = (ai_intensity * self.profile.ai_exposure * self.profile.displacement_risk) - (self.profile.productivity_gain * 0.5) 
            # Start risk low, increase as ai_intensity goes 0->1
            # Base probability
            prob_loss = 0.001 # Natural turnover
            if risk_score > 0.2:
                 prob_loss += 0.02 * (risk_score - 0.2)
            
            if np.random.random() < prob_loss:
                self.is_unemployed = True
                self.unemployed_months = 0
                self.hourly_wage = 0 # Wage becomes 0
        else:
            # Unemployed state
            self.unemployed_months += 1
            # Simple re-employment logic
            prob_find_job = 0.1 # 10% chance per month to find job
            if np.random.random() < prob_find_job:
                self.is_unemployed = False
                self.hourly_wage = np.random.normal(self.profile.base_wage_mean * 0.8, self.profile.base_wage_mean * 0.1) # Re-employed at lower wage potentially

        # --- Phase 2: Labor Supply Decision ---
        w_potential = self.hourly_wage if not self.is_unemployed else 0
        
        if self.is_unemployed:
            self.current_hours = 0
        else:
             # Cobb-Douglas derived supply
            T = 112 # Total awake hours/week (16*7)
            
            # H* = alpha * T - (1 - alpha) * (UBI / wage)
            # UBI is monthly, wage is hourly. Convert UBI to weekly equivalent for formula consistency?
            # Or convert wage to monthly? Formula: C = wH + UBI. 
            # Usually H is defined over a period. If H is weekly hours, w is hourly wage.
            # UBI (monthly) needs to be weekly: UBI_weekly = UBI / 4. 
            
            ubi_weekly = policy.ubi_amount / 4.0
            denom = max(w_potential, 1.0)
            
            optimal_hours = self.alpha * T - (1 - self.alpha) * (ubi_weekly / denom)
            
            # Clamping and Inertia
            target = max(0, min(60, optimal_hours))
            self.current_hours = 0.8 * self.current_hours + 0.2 * target

        # --- Phase 3: Income & Happiness ---
        monthly_labor_income = self.current_hours * 4 * w_potential
        self.total_income = monthly_labor_income + policy.ubi_amount # Stored for aggregation
        
        # Tax
        tax = self.total_income * policy.income_tax_rate
        disposable_income = self.total_income - tax
        self.saving += disposable_income * 0.2
        
        # Relative Poverty Penalty
        avg_income = macro_state.get('avg_income', 300_000)
        relative_status = self.total_income / (avg_income + 1e-6)
        
        # Utility Calculation (Log Utility)
        # U = alpha * ln(C) + (1-alpha) * ln(Leisure)
        # C = disposable_income (simplified coverage of basics)
        # Leisure = T*4 - WorkHours*4 (Monthly leisure)
        
        # To avoid log(0) or negative
        c_val = max(disposable_income, 1000) 
        l_val = max((112 * 4) - (self.current_hours * 4), 10)
        
        utility = self.alpha * np.log(c_val) + (1 - self.alpha) * np.log(l_val)
        
        # Happiness score mapping (0-10)
        # Adjusting scale to fit roughly 0-10 based on typical values
        # log(200000) ~ 12.2. log(400) ~ 6. 
        # base score around 5. 
        self.happiness = utility * 0.5 
        
        # Apply penalties logic requested
        if relative_status < 0.5:
            self.happiness -= 1.5 # Poverty penalty
        
        if self.is_unemployed:
            self.happiness -= 2.0 # Unemployment Stigma
            
        self.happiness = max(0, min(10, self.happiness))
