# sim/runner.py
from sim.environment import Environment
import numpy as np

def run_sim(years=5, steps_per_year=12):
    env = Environment()
    poverty_rates = []
    
    total_steps = years * steps_per_year

    for t in range(total_steps):
        env.step()
        
        # 貧困率の計算
        poor_count = sum(1 for h in env.households.values() if h.is_poor)
        poverty_rate = poor_count / len(env.households)
        poverty_rates.append(poverty_rate)

    return np.array(poverty_rates)
