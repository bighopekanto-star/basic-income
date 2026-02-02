# main.py
import sys
import os

# パスを通す（簡易的）
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sim.runner import run_sim
import matplotlib.pyplot as plt

import json

def main():
    print("Starting UBI Agent-Based Simulation...")
    years = 10
    print(f"Running for {years} years...")
    
    # Custom run_sim modification to return environment or history
    # For now, let's instantiate Environment directly here or modify runner to return it.
    # To keep runner cleaner, let's just use Environment here directly or update runner.
    # Let's import Environment directly for full control and access to history.
    from sim.environment import Environment
    
    env = Environment()
    total_steps = years * 12
    
    poverty_rates = []
    
    for t in range(total_steps):
        env.step()
        # Poverty logic (duplicated from runner for now to keep main simple, or just use what we need)
        poor_count = sum(1 for h in env.households.values() if h.is_poor)
        poverty_rate = poor_count / len(env.households)
        poverty_rates.append(poverty_rate)
        
    print("Simulation completed.")
    print(f"Final Poverty Rate: {poverty_rates[-1]:.2%}")

    # Save JSON Data for Frontend
    print("Exporting JSON data...")
    history_data = {
        "summary": {
            "final_poverty_rate": poverty_rates[-1],
            "total_steps": total_steps
        },
        "timeline": env.get_history()
    }
    
    json_path = '../simulation_data.json' # Save to parent dir (root of web app)
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(history_data, f, ensure_ascii=False) # standard json dump
    
    print(f"Data saved to {json_path}")

    # Check file size! If it's huge, we might need optimization (200 agents * 120 steps = 24000 records. Small enough.)

    # グラフ描画 (Optional)
    plt.figure(figsize=(10, 6))
    plt.plot(poverty_rates, label='Poverty Rate')
    plt.title("Poverty Rate over Time (UBI Scenario)")
    plt.xlabel("Months")
    plt.ylabel("Poverty Rate")
    plt.grid(True)
    plt.legend()
    
    output_path = 'simulation_result.png'
    plt.savefig(output_path)
    print(f"Result saved to {output_path}")

if __name__ == "__main__":
    main()
