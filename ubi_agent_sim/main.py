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
    gini_history = []
    unemployment_history = []
    inflation_history = []
    debt_history = []
    deficit_history = []

    for t in range(total_steps):
        env.step()
        macro = env.history[-1]["macro"]
        poverty_rates.append(macro["poverty_rate"])
        gini_history.append(macro["gini"])
        unemployment_history.append(macro["unemployment_rate"])
        inflation_history.append(macro["inflation_rate"])
        debt_history.append(macro["gov_debt"])
        deficit_history.append(macro["gov_deficit"])

    print("Simulation completed.")
    print(f"Final Poverty Rate: {poverty_rates[-1]:.2%}")
    print(f"Final Gini: {gini_history[-1]:.4f}")
    print(f"Final Unemployment: {unemployment_history[-1]:.2%}")
    print(f"Final Annual Inflation: {inflation_history[-1] * 12:.2f}%")
    print(f"Final Gov Debt: {debt_history[-1]:,.0f} JPY")

    # Save JSON Data for Frontend
    print("Exporting JSON data...")
    history_data = {
        "summary": {
            "final_poverty_rate": poverty_rates[-1],
            "final_gini": gini_history[-1],
            "final_unemployment_rate": unemployment_history[-1],
            "final_inflation_rate": inflation_history[-1],
            "final_gov_debt": debt_history[-1],
            "total_steps": total_steps
        },
        "timeline": env.get_history()
    }
    
    json_path = '../simulation_data.json' # Save to parent dir (root of web app)
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(history_data, f, ensure_ascii=False) # standard json dump
    
    print(f"Data saved to {json_path}")

    # Check file size! If it's huge, we might need optimization (200 agents * 120 steps = 24000 records. Small enough.)

    # グラフ描画
    fig, axes = plt.subplots(3, 2, figsize=(14, 14))

    axes[0, 0].plot(poverty_rates, color='#8B5CF6')
    axes[0, 0].set_title("Poverty Rate")
    axes[0, 0].set_ylabel("Rate")
    axes[0, 0].grid(True, alpha=0.3)

    axes[0, 1].plot(gini_history, color='#3B82F6')
    axes[0, 1].set_title("Gini Coefficient")
    axes[0, 1].set_ylabel("Gini")
    axes[0, 1].grid(True, alpha=0.3)

    axes[1, 0].plot(unemployment_history, color='#F59E0B')
    axes[1, 0].set_title("Unemployment Rate")
    axes[1, 0].set_ylabel("Rate")
    axes[1, 0].grid(True, alpha=0.3)

    happiness_history = [h["macro"]["avg_happiness"] for h in env.history]
    axes[1, 1].plot(happiness_history, color='#10B981')
    axes[1, 1].set_title("Average Happiness")
    axes[1, 1].set_ylabel("Score")
    axes[1, 1].grid(True, alpha=0.3)

    axes[2, 0].plot(inflation_history, color='#EF4444')
    axes[2, 0].set_title("Monthly Inflation Rate (%)")
    axes[2, 0].set_ylabel("%")
    axes[2, 0].set_xlabel("Months")
    axes[2, 0].grid(True, alpha=0.3)

    axes[2, 1].plot(deficit_history, color='#F97316', label='Monthly Deficit')
    ax2 = axes[2, 1].twinx()
    ax2.plot(debt_history, color='#DC2626', linestyle='--', label='Cumulative Debt')
    axes[2, 1].set_title("Government Fiscal Balance")
    axes[2, 1].set_ylabel("Monthly Deficit (JPY)")
    ax2.set_ylabel("Cumulative Debt (JPY)")
    axes[2, 1].set_xlabel("Months")
    axes[2, 1].grid(True, alpha=0.3)
    axes[2, 1].legend(loc='upper left')
    ax2.legend(loc='upper right')

    fig.suptitle("UBI Simulation Results (10 Years)", fontsize=14, fontweight='bold')
    fig.tight_layout()

    output_path = 'simulation_result.png'
    plt.savefig(output_path)
    print(f"Result saved to {output_path}")

if __name__ == "__main__":
    main()
