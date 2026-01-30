class SimulationEngine {
    constructor(parameters, households) {
        this.params = parameters; // EconomyParameters instance
        this.households = households; // Array of Household instances
        this.results = {
            totalAnnualCost: new Decimal(0),
            fundingBreakdown: {},
            shortfall: new Decimal(0),
            gdpImpact: 0, // %
            povertyRateChange: 0, // % points
        };
    }

    /**
     * Main execution method to update all calculations
     */
    run() {
        this.calculateTotalCost();
        this.calculateHouseholdImpacts();
        this.calculateMacroIndicators();
        return this.results;
    }

    /**
     * Calculates the total gross cost of the UBI program.
     */
    calculateTotalCost() {
        const monthly = new Decimal(this.params.monthlyUBI);
        const pop = new Decimal(this.params.targetPopulation);

        // Simple calculation: Cost = Monthly * 12 * Population
        // In Phase 2, we might adjust for child vs adult amounts
        this.results.totalAnnualCost = monthly.times(12).times(pop);

        // Calculate available funding from sources
        // Note: This is a simplified revenue model for MVP

        // 1. Consumption Tax Revenue Calculation (Simplified)
        // Assume 1% consumption tax = ~2.5 Trillion JPY (approx rule of thumb for Japan)
        const consumptionTaxRevenueBase = new Decimal(2500000000000); // 2.5T
        const consumptionTaxRevenueNew = consumptionTaxRevenueBase.times(this.params.consumptionTaxRateIncrease * 100);

        // 2. Income Tax Revenue Impact (Simplified)
        // Assume 1% income tax increase measures = ~1.0 Trillion JPY revenue (highly variable, but using simple multiple for MVP)
        const incomeTaxRevenueNew = new Decimal(1000000000000).times(this.params.incomeTaxRateIncrease * 100);

        // 3. Other sources
        const bondIssue = new Decimal(this.params.govBondIssue);
        const welfareCuts = new Decimal(this.params.welfareReduction);

        this.results.fundingBreakdown = {
            consumptionTax: consumptionTaxRevenueNew,
            incomeTax: incomeTaxRevenueNew,
            bonds: bondIssue,
            welfareCuts: welfareCuts
        };

        const totalFunding = consumptionTaxRevenueNew
            .plus(incomeTaxRevenueNew)
            .plus(bondIssue)
            .plus(welfareCuts);

        this.results.shortfall = this.results.totalAnnualCost.minus(totalFunding);
    }

    /**
     * Calculates impact for each household type.
     */
    calculateHouseholdImpacts() {
        const annualUBI = new Decimal(this.params.monthlyUBI).times(12);

        this.households.forEach(hh => {
            // 1. Money received (UBI)
            // Assuming everyone gets UBI for now (Universal)
            const biReceived = annualUBI.times(hh.totalMembers);

            // 2. Tax Increases
            // Income Tax Increase: AnnualIncome * rate_increase
            const incomeTaxIncrease = hh.annualIncome.times(this.params.incomeTaxRateIncrease);

            // Consumption Tax Increase: (AnnualIncome - CurrentTax) * propensity * rate_increase / (1 + current_rate)
            // Simplified: Disposable Income * Propensity * RateIncrease
            const disposableIncome = hh.annualIncome.minus(hh.currentTax);
            const spending = disposableIncome.times(hh.consumptionPropensity);
            const consumptionTaxIncrease = spending.times(this.params.consumptionTaxRateIncrease);

            const totalTaxIncrease = incomeTaxIncrease.plus(consumptionTaxIncrease);

            // 3. Net Impact
            const netChange = biReceived.minus(totalTaxIncrease);

            // 4. Real Income Change Rate
            // (New Net - Old Net) / Old Net
            // New Net = Disposable + NetChange
            let changeRate = new Decimal(0);
            if (!disposableIncome.isZero()) {
                changeRate = netChange.div(disposableIncome).times(100);
            }

            // Update Household model
            hh.simulationResults.biReceived = biReceived;
            hh.simulationResults.newTax = hh.currentTax.plus(totalTaxIncrease);
            hh.simulationResults.netChange = netChange;
            hh.simulationResults.realIncomeChangeRate = changeRate;
        });
    }

    /**
     * Estimates Macro Indicators (Simplified for Phase 1)
     */
    calculateMacroIndicators() {
        // GDP Impact: Multiplier effect simulation
        // Very basic: Net Injection * Multiplier
        // Net Injection = Total UBI - Total Tax Increases (roughly the Shortfall/Bonds)

        // If funded by taxes, multiplier is low (balanced budget multiplier ~1)
        // If funded by bonds, multiplier is higher

        // This is a placeholder for the advanced logic in Phase 2
        const injection = this.results.shortfall.div(500000000000000); // Ratio to GDP (550T)
        this.results.gdpImpact = injection.times(0.8).toNumber(); // 0.8 multiplier assumption

        // Poverty Rate: Heuristic based on low-income gains
        const lowIncomeGain = this.households
            .filter(h => h.incomeLevel === 'low')
            .reduce((sum, h) => sum + h.simulationResults.netChange.toNumber(), 0);

        if (lowIncomeGain > 0) {
            this.results.povertyRateChange = -2.0; // Placeholder: improves by 2%
        } else {
            this.results.povertyRateChange = 0.5; // Worsens
        }
    }
}
