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
                    hourly_wage=np.random.normal(1500, 500), # 少し現実的な賃金に調整
                    work_hours=40,
                    saving=0,
                    household_id=hid,
                )
                # 賃金が負にならないように補正
                if p.hourly_wage < 600: p.hourly_wage = 600
                
                self.persons[pid] = p
                member_ids.append(pid)
                pid += 1
            self.households[hid] = Household(id=hid, member_ids=member_ids)

    def step(self):
        basic_need = 150_000
        macro_state = {}
        
        # 個人エージェントの更新
        for p in self.persons.values():
            p.step(self.policy, macro_state, basic_need)

        # 世帯エージェントの更新（集計）
        for h in self.households.values():
            h.aggregate(self.persons)
