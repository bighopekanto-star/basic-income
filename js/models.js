/**
 * models.js
 * Defines the data structures for the simulation.
 */

// Using Decimal from the global scope (loaded via CDN)
const Decimal = window.Decimal;

/**
 * Represents a specific household type for micro-simulation.
 */
class Household {
    /**
     * @param {string} id - Unique identifier (e.g., 'single_low')
     * @param {string} label - Human readable label (e.g., '独身・低所得')
     * @param {string} type - 'single', 'couple', 'single_parent', 'family_2kids', 'elderly'
     * @param {string} incomeLevel - 'low', 'middle', 'high'
     * @param {number} annualIncome - Current annual income (JPY)
     * @param {number} adults - Number of adults (18+)
     * @param {number} children - Number of children (<18)
     * @param {number} currentTax - Estimated current annual tax burden (Income + Consumption + Residence)
     * @param {number} consumptionPropensity - Propensity to consume (0.0 - 1.0)
     */
    constructor({ id, label, type, incomeLevel, annualIncome, adults, children, currentTax, consumptionPropensity }) {
        this.id = id;
        this.label = label;
        this.type = type;
        this.incomeLevel = incomeLevel;
        this.annualIncome = new Decimal(annualIncome);
        this.adults = adults;
        this.children = children;
        this.currentTax = new Decimal(currentTax);
        this.consumptionPropensity = new Decimal(consumptionPropensity);

        // Simulation results storage
        this.simulationResults = {
            biReceived: new Decimal(0),
            newTax: new Decimal(0),
            netChange: new Decimal(0),
            realIncomeChangeRate: new Decimal(0)
        };
    }

    /**
     * Get total members in the household.
     */
    get totalMembers() {
        return this.adults + this.children;
    }
}

/**
 * Stores global economic parameters and tax settings.
 */
class EconomyParameters {
    constructor() {
        // Basic Parameters
        this.monthlyUBI = 70000; // JPY
        this.targetPopulation = 126000000; // Total
        this.AdultRatio = 0.82; // Approx ratio of adults

        // Funding Options (Tax Rates)
        // Base rates (approximate current effective rates for simplicity in MVP)
        this.baseIncomeTaxRate = 0.10; // 10% average effective
        this.baseConsumptionTaxRate = 0.10; // 10%
        this.baseCorpTaxRate = 0.23; // 23%

        // Increases (User inputs)
        this.incomeTaxRateIncrease = 0.00;
        this.consumptionTaxRateIncrease = 0.00;
        this.corpTaxRateIncrease = 0.00;

        // Funding amounts (JPY)
        this.govBondIssue = 0;
        this.welfareReduction = 0;
    }
}

/**
 * Generates the extended 32 household models.
 */
function generateHouseholdModels() {
    const models = [];

    // Definitions of base types
    const types = [
        { id: 'single', label: '独身', adults: 1, children: 0 },
        { id: 'couple', label: '夫婦', adults: 2, children: 0 },
        { id: 'parent_1kid', label: 'ひとり親+子1', adults: 1, children: 1 },
        { id: 'parent_2kids', label: 'ひとり親+子2', adults: 1, children: 2 },
        { id: 'fam_1kid', label: '標準+子1', adults: 2, children: 1 },
        { id: 'fam_2kids', label: '標準+子2', adults: 2, children: 2 },
        { id: 'fam_3kids', label: '標準+子3', adults: 2, children: 3 },
        { id: 'elderly_s', label: '高齢単身', adults: 1, children: 0, isElderly: true },
        { id: 'elderly_c', label: '高齢夫婦', adults: 2, children: 0, isElderly: true },
    ];

    // Income Levels configurations
    // Base Income multipliers for types (simplified)
    // taxRate: approximate effective tax rate
    // propensity: consumption propensity
    const levels = [
        { id: 'low', label: '低所得', info: 'Bottom 20%', incomeBase: 2000000, taxRate: 0.05, propensity: 0.95 },
        { id: 'lower_mid', label: '中低所得', info: '20-40%', incomeBase: 3500000, taxRate: 0.10, propensity: 0.85 },
        { id: 'mid', label: '中所得', info: '40-60%', incomeBase: 5000000, taxRate: 0.15, propensity: 0.75 },
        { id: 'upper_mid', label: '中高所得', info: '60-80%', incomeBase: 7500000, taxRate: 0.20, propensity: 0.60 },
        { id: 'high', label: '高所得', info: 'Top 20%', incomeBase: 12000000, taxRate: 0.25, propensity: 0.45 }
    ];

    // Generate combinations
    // We select specific representative combinations to reach approx 30-40 patterns relevant for analysis

    types.forEach(type => {
        levels.forEach(level => {
            // Adjust income based on household size (sqrt equivalence scale approximation for base income generation)
            // This represents the "equivalent standard of living" income for that level
            const equivalence = Math.sqrt(type.adults + type.children * 0.5);
            let annualIncome = level.incomeBase * equivalence;

            // Elderly adjustments (lower income generally)
            if (type.isElderly) {
                annualIncome *= 0.7;
            }

            // Rounding
            annualIncome = Math.round(annualIncome / 10000) * 10000;

            // Approximate current tax (income + consumption + others)
            const currentTax = Math.round(annualIncome * level.taxRate);

            models.push(new Household({
                id: `${type.id}_${level.id}`,
                label: `${type.label}・${level.label}`,
                type: type.id,
                incomeLevel: level.id,
                annualIncome: annualIncome,
                adults: type.adults,
                children: type.children,
                currentTax: currentTax,
                consumptionPropensity: level.propensity
            }));
        });
    });

    // Filtering to keep the list reasonable if needed, but for now returning all generated (~45 types)
    // The user requested ~32, this systematic generation covers them well.
    return models;
}
