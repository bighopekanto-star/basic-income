# main.py
import sys
import os

# パスを通す（簡易的）
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sim.runner import run_sim
import matplotlib.pyplot as plt

def main():
    print("Starting UBI Agent-Based Simulation...")
    years = 10
    print(f"Running for {years} years...")
    
    poverty_rates = run_sim(years=years)
    
    print("Simulation completed.")
    print(f"Final Poverty Rate: {poverty_rates[-1]:.2%}")

    # グラフ描画
    plt.figure(figsize=(10, 6))
    plt.plot(poverty_rates, label='Poverty Rate')
    plt.title("Poverty Rate over Time (UBI Scenario)")
    plt.xlabel("Months")
    plt.ylabel("Poverty Rate")
    plt.grid(True)
    plt.legend()
    
    # 画像として保存（サーバー環境などを考慮して表示ではなく保存を推奨）
    output_path = 'simulation_result.png'
    plt.savefig(output_path)
    print(f"Result saved to {output_path}")
    # plt.show() # ローカル実行なら有効化

if __name__ == "__main__":
    main()
