# sim/environment.py
import numpy as np
from config.jobs import JOB_DEFINITIONS
from models.person import Person
from models.household import Household
from config.policy import Policy

class Environment:
    def __init__(self, n_households=200, persons_per_household=2): # Adjusted n_agents to n_households context
        self.policy = Policy()
        self.persons = {}
        self.households = {}
        self.steps = 0
        self.ai_intensity = 0.0 # 0.0 -> 1.0 (10年で最大)
        self.history = [] # Store full history
        
        # エージェント生成
        # Job Distribution: Specialist: 25%, Admin: 35%, Service: 25%, Manual: 15%
        job_probs = [0.25, 0.35, 0.25, 0.15]
        
        pid = 0
        for hid in range(n_households):
            member_ids = []
            for _ in range(persons_per_household):
                
                # Select Job
                job = np.random.choice(JOB_DEFINITIONS, p=job_probs)
                
                p = Person(
                    id=pid,
                    job_profile=job,
                    hourly_wage=np.random.normal(job.base_wage, job.base_wage*0.2),
                    work_hours=40,
                    alpha=np.random.beta(6, 4),    # 労働選好パラメータ (Mean 0.6)
                    adaptability=np.random.beta(5, 5), # 適応力 (Mean 0.5)
                    household_id=hid # Added to match Person signature
                )
                
                # Wage lower bound check
                if p.hourly_wage < 800: p.hourly_wage = 800
                
                self.persons[pid] = p
                member_ids.append(pid)
                pid += 1
            
            self.households[hid] = Household(id=hid, member_ids=member_ids)

    def step(self):
        self.steps += 1
        # AI普及率の上昇 (線形 10年=120ヶ月でMAX)
        self.ai_intensity = min(1.0, self.steps / 120.0) 

        # マクロ状態計算
        # Calculate Average Income based on previous step values or current state approximation?
        # Using current values implies strict sync, but acceptable.
        total_income_sum = sum(p.total_income for p in self.persons.values())
        avg_income = total_income_sum / len(self.persons) if self.persons else 0
        
        env_state = {
            'ai_intensity': self.ai_intensity, 
            'avg_income': avg_income
        }

        # Step Agents
        for p in self.persons.values():
            p.step(self.policy, env_state)
            
        # Aggregate Households
        for h in self.households.values():
            h.aggregate(self.persons)

        # Collect History (Snapshot)
        snapshot = {
            "step": self.steps,
            "year": self.steps // 12, # Integer division for year
            "agents": []
        }
        for p in self.persons.values():
            agent_data = {
                "id": p.id,
                "job": p.job_profile.name,
                "income": p.total_income,
                "happiness": p.happiness,
                "is_unemployed": p.is_unemployed,
                "work_hours": p.work_hours,
                "hourly_wage": p.hourly_wage
            }
            snapshot["agents"].append(agent_data)
        
        self.history.append(snapshot)

    def get_history(self):
        return self.history
