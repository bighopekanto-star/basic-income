from dataclasses import dataclass

@dataclass
class JobDef:
    name: str
    base_wage: float
    ai_exposure: float        # AIの影響度 (0.0-1.0)
    displacement_risk: float  # 代替リスク係数
    augmentation_potential: float # 補完（賃上げ）期待値

# OECDレポート等に基づく定義
JOB_DEFINITIONS = [
    JobDef("Specialist", 3500, 0.8, 0.2, 0.8), # 高露出だが補完効果高い
    JobDef("Admin",      1800, 0.7, 0.7, 0.2), # 高露出で代替リスク高い
    JobDef("Service",    1200, 0.2, 0.1, 0.1), # 低露出
    JobDef("Manual",     1100, 0.4, 0.4, 0.1), # 中露出
]
