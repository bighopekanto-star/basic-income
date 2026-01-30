/**
 * timeline_engine.js
 * Handles multi-year time-series simulation incorporating AI impacts and behavioral economics parameters.
 */

// const Decimal = window.Decimal; // Access directly in classes to avoid load order issues


/**
 * Represents a job/skill category with specific AI exposure characteristics.
 * Based on OECD/ILO reports logic.
 */
class JobGroup {
    /**
     * @param {string} id - 'high_skill', 'mid_skill', 'low_service', 'manual'
     * @param {string} label - Display label
     * @param {number} share - Share of the labor force (0.0 - 1.0)
     * @param {number} aiExposure - Exposure to AI automation (0.0 - 1.0)
     * @param {number} displacementFactor - Sensitivity to substitution (negative impact on employment)
     * @param {number} productivityFactor - Sensitivity to augmentation (positive impact on wages/output)
     */
    constructor({ id, label, share, aiExposure, displacementFactor, productivityFactor }) {
        this.id = id;
        this.label = label;
        this.share = new window.Decimal(share);
        this.aiExposure = new window.Decimal(aiExposure);
        this.displacementFactor = new window.Decimal(displacementFactor); // Risk of job loss
        this.productivityFactor = new window.Decimal(productivityFactor); // Potential for wage gain

        // Dynamic state
        this.currentEmploymentRate = new window.Decimal(1.0); // Starts at full employment relative to share
        this.currentWageIndex = new window.Decimal(1.0); // Starts at 1.0 baseline
    }
}

/**
 * Engine to run the time-series simulation.
 */
class TimelineEngine {
    constructor() {
        // Define base job groups based on the User's AI report
        this.jobGroups = [
            // 1. High Skill / High Exposure (Knowledge Workers: Engineers, Law, Finance)
            // High exposure but high complementarity (Productivity > Displacement)
            new JobGroup({
                id: 'high_skill',
                label: '高度専門職 (知識労働)',
                share: 0.25,
                aiExposure: 0.8,
                displacementFactor: 0.1, // Low displacement (augmentation)
                productivityFactor: 0.8  // High productivity gain
            }),
            // 2. Mid Skill / High Exposure (Clerical, Admin)
            // High exposure and high substitution risk
            new JobGroup({
                id: 'mid_admin',
                label: '中技能 (事務・管理)',
                share: 0.35,
                aiExposure: 0.7,
                displacementFactor: 0.6, // High displacement
                productivityFactor: 0.3
            }),
            // 3. Low Skill / Low Exposure (Service, Manual, Care)
            // Low exposure, low productivity gain, stable demand
            new JobGroup({
                id: 'service_care',
                label: '対人サービス・ケア',
                share: 0.25,
                aiExposure: 0.2,
                displacementFactor: 0.05,
                productivityFactor: 0.1
            }),
            // 4. Low Skill / Mid Exposure (Routine Manual/Sales)
            // Moderate risk from robotics/AI kiosks
            new JobGroup({
                id: 'routine_manual',
                label: '定型業務 (販売・軽作業)',
                share: 0.15,
                aiExposure: 0.4,
                displacementFactor: 0.4,
                productivityFactor: 0.2
            })
        ];
    }

    /**
     * Runs a 10-year simulation.
     * @param {Object} params - EconomyParameters from Base Model
     * @param {Object} aiScenario - { pace: 'slow'|'base'|'fast', investment: number }
     * @returns {Array} - Array of yearly result objects
     */
    runSimulation(baseParams, aiScenario) {
        const years = 10;
        const results = [];

        // Scenario Multipliers
        // Pace determines the speed of AI adoption (Annual increase in effective exposure impact)
        let adoptionRate = 0.0;
        switch (aiScenario.pace) {
            case 'slow': adoptionRate = 0.01; break; // 1% adoption spread per year
            case 'base': adoptionRate = 0.03; break; // 3%
            case 'fast': adoptionRate = 0.06; break; // 6% (Disruptive)
        }

        // Reinstatement Rate: How many new jobs are created per displaced job?
        // Higher investment in education/tech leads to higher reinstatement.
        // Base 0.4 (4 new jobs for 10 lost), adjusted by investment level (0-100)
        // If investment is high, reinstatement approaches 0.8 or 0.9
        const educationInvestment = aiScenario.investment || 50; // 0-100 scale
        const reinstatementRate = 0.4 + (educationInvestment / 200); // 0.4 to 0.9

        // Initial State
        let currentGdp = new window.Decimal(550); // Trillion JPY (approx)
        let currentDebt = new window.Decimal(1200); // Trillion JPY
        let cumulativeInflation = new window.Decimal(1.0);
        let unemploymentRate = new window.Decimal(0.025); // 2.5% base

        // Clone Job Groups for local mutation
        let groups = this.jobGroups.map(g => ({
            ...g,
            currentEmploymentRate: new window.Decimal(1.0),
            currentWageIndex: new window.Decimal(1.0)
        }));

        const biAmountMonthly = new window.Decimal(baseParams.monthlyUBI);
        const annualBiCost = biAmountMonthly.times(12).times(126000000).div(1000000000000); // Trillion JPY

        for (let year = 0; year <= years; year++) {
            if (year === 0) {
                // Year 0: Baseline
                results.push({
                    year: year,
                    gdp: currentGdp.toNumber(),
                    debt: currentDebt.toNumber(),
                    unemployment: unemploymentRate.toNumber() * 100,
                    avgWageIndex: 100
                });
                continue;
            }

            // --- 1. AI Impact Calculation ---

            // Current AI Pressure = Adoption Rate * Year
            // This pressure is applied to Exposure to generate shocks
            const aiPressure = new window.Decimal(adoptionRate).times(year);

            let totalLaborDemandChange = new window.Decimal(0);
            let totalProductivityChange = new window.Decimal(0);

            groups.forEach(group => {
                // Displacement Channel: Jobs lost = Exposure * Pressure * DisplacementFactor
                const displacement = group.aiExposure.times(aiPressure).times(group.displacementFactor);

                // Productivity Channel: Wage/Output Gain = Exposure * Pressure * ProductivityFactor
                const productivity = group.aiExposure.times(aiPressure).times(group.productivityFactor);

                // Update Group State
                // Employment = 1.0 - Displacement + Reinstatement (New tasks)
                // We assume Reinstatement fills a portion of the "gap" or adds to it
                // Logic: Net Job Change = -Displacement + (Displacement * ReinstatementRate)
                // Simplified: Net Loss = Displacement * (1 - ReinstatementRate)

                const netJobLoss = displacement.times(new window.Decimal(1).minus(reinstatementRate));
                group.currentEmploymentRate = new window.Decimal(1).minus(netJobLoss);

                // Wage Index increases with productivity
                group.currentWageIndex = new window.Decimal(1).plus(productivity);

                // Aggregate effects (weighted by share)
                totalLaborDemandChange = totalLaborDemandChange.plus(group.currentEmploymentRate.times(group.share));
                totalProductivityChange = totalProductivityChange.plus(productivity.times(group.share));
            });

            // --- 2. Macro Calculation ---

            // Unemployment Rate Update
            // Base Unemployment + (1 - Total Labor Demand)
            // Note: Total Labor Demand starts at 1.0. If it drops to 0.95, unemp adds 5%.
            const structuralUnemployment = new window.Decimal(1).minus(totalLaborDemandChange);
            unemploymentRate = new window.Decimal(0.025).plus(structuralUnemployment).clamp(0, 0.5); // Cap at 50%

            // GDP Calculation
            // GDP = BaseGDP * LaborInput * Productivity
            // LaborInput ~ TotalLaborDemand
            // Productivity ~ (1 + TotalProductivityChange)
            const growthFactor = totalLaborDemandChange.times(new window.Decimal(1).plus(totalProductivityChange));
            currentGdp = new window.Decimal(550).times(growthFactor);

            // --- 3. Fiscal Calculation (Debt) ---

            // Revenue: Assume tax revenue scales with GDP
            // Base Tax Revenue ~ 100 Trillion (approx) -> scales with GDP ratio
            const baseTaxRevenue = new window.Decimal(100).times(currentGdp.div(550));

            // Expenditure: Social Security (Variable) + BI Cost (Fixed) + Others
            // We assume Base Expenditure matches Base Revenue initially for simplicity
            let annualDeficit = annualBiCost.minus(baseTaxRevenue.times(0.1)); // Rough placeholder: assume 10% of revenue gap is deficit?
            // BETTER: User defined funding gap.
            // From Base Model, we know "govBondIssue" for the single year.
            // Let's rely on the baseParams tax hikes.

            // Calculate funding gap roughly using the Base Model logic scaled
            // For MVP time-series, let's assume the "Net Cost" from the main simulation 
            // is the Structural Deficit added each year, adjusted for GDP growth/shrink.

            // If GDP shrinks, tax revenue shrinks, deficit grows.
            // If GDP grows, tax revenue grows, deficit shrinks.

            // Let's take the user's defined "GovBond" preference from the main logic as the starting deficit.
            // If the user selected "Tax Funded", starting deficit is 0.
            // We need to pass the "Initial Deficit" from the main view logic ideally.
            // For now, let's approximate: 
            // Deficit_t = (Annual_BI_Cost - Tax_Hike_Revenue) * (Assessment based on GDP)
            // But simplify: Deficit adds to debt.

            // Note: We need to know how much was funded by bonds in the main inputs.
            // We will calculate a "Primary Balance" impact.
            // Assume the user chose parameters that result in X Trillion deficit in Year 1.
            const initialDeficit = new Decimal(baseParams.govBondIssue || 0); // User input bond amount

            // Deficit scales inversely with GDP growth (Automatic stabilizers logic simplified)
            // If GDP drops 10%, Deficit might increase due to lower tax receipt.
            const gdpRatio = currentGdp.div(550);
            const dynamicDeficit = initialDeficit.plus(annualBiCost.times(new window.Decimal(1).minus(gdpRatio).times(0.5))); // Sensitivity

            currentDebt = currentDebt.plus(dynamicDeficit);

            // --- 4. BI Mitigating Effect ---
            // If BI is high (> 100k), Reinstatement Rate increases slightly (entrepreneurship effect)
            if (biAmountMonthly.gte(100000)) {
                // minor boost to next year's logic could be added here
            }

            // Store Results
            results.push({
                year: year,
                gdp: currentGdp.toNumber(),
                debt: currentDebt.toNumber(),
                unemployment: unemploymentRate.toNumber() * 100,
                avgWageIndex: new window.Decimal(100).times(new window.Decimal(1).plus(totalProductivityChange)).toNumber(),
                // Breakdown for charts
                groups: groups.map(g => ({
                    id: g.id,
                    label: g.label,
                    employment: g.currentEmploymentRate.toNumber(),
                    wage: g.currentWageIndex.toNumber()
                }))
            });
        }

        return results;
    }
}

// Export for use
// In browser environment, we attach to window
window.TimelineEngine = TimelineEngine;
