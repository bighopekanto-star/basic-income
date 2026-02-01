# sim/environment.py
import numpy as np
from models.person import Person, OccupationProfile
from models.household import Household
from config.policy import Policy

class Environment:
    def __init__(self, n_households=1000, persons_per_household=2):
        self.policy = Policy()
        self.persons = {}
        self.households = {}
        self.time_step = 0
        self.ai_intensity = 0.0 # 0.0 to 1.0 (Full adoption)
        
        # Define Occupation Profiles
        self.occupations = [
            OccupationProfile(
                name="High Skill / Knowledge",
                base_wage_mean=3500, # High wage
                ai_exposure=0.8,
                displacement_risk=0.2, # Low risk, AI complements
                productivity_gain=1.5  # High gain
            ),
            OccupationProfile(
                name="Mid Skill / Admin",
                base_wage_mean=2000,
                ai_exposure=0.9,
                displacement_risk=0.8, # High risk of replacement
                productivity_gain=0.8
            ),
            OccupationProfile(
                name="Service / Care",
                base_wage_mean=1400,
                ai_exposure=0.3, # Low exposure (physical interaction)
                displacement_risk=0.1,
                productivity_gain=0.3
            ),
            OccupationProfile(
                name="Routine Manual",
                base_wage_mean=1200,
                ai_exposure=0.6,
                displacement_risk=0.9, # Robotics replacement
                productivity_gain=0.5
            )
        ]
        # Distribution Ratios
        self.occupation_probs = [0.25, 0.35, 0.25, 0.15]
        
        pid = 0
        for hid in range(n_households):
            member_ids = []
            for _ in range(persons_per_household):
                # Assign Occupation
                occ_idx = np.random.choice(len(self.occupations), p=self.occupation_probs)
                profile = self.occupations[occ_idx]
                
                p = Person(
                    pid=pid,
                    profile=profile,
                    household_id=hid,
                )
                self.persons[pid] = p
                member_ids.append(pid)
                pid += 1
            self.households[hid] = Household(id=hid, member_ids=member_ids)

    def step(self):
        self.time_step += 1
        
        # Update AI Intensity (Sigmoid-like S-curve or Linear for verification)
        # Assume 10 years (120 steps) to reach max
        # Simple logistic: 1 / (1 + exp(-k(t - t0)))
        # Let's make it go 0 -> 0.8 over 120 steps
        progress = self.time_step / 120.0
        self.ai_intensity = min(1.0, progress * 1.5) # accelerate slightly
        
        basic_need = 150_000
        
        # Calculate Macro State for Agents (e.g. Average Income for logic)
        total_income_sum = sum(p.hourly_wage * p.current_hours * 4 for p in self.persons.values())
        avg_income = total_income_sum / len(self.persons) if self.persons else 0
        
        macro_state = {
            'ai_intensity': self.ai_intensity,
            'avg_income': avg_income
        }
        
        # Step Agents
        for p in self.persons.values():
            p.step(self.policy, macro_state, basic_need)

        # Aggregate Households
        for h in self.households.values():
            h.aggregate(self.persons)
