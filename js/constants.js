/**
 * constants.js
 * Shared constants used across all simulation engines.
 */

const SimConstants = {
    // Japan Population & Economy
    POPULATION: 124000000,           // Japan population 2024
    GDP_NOMINAL_TRILLION: 550,       // Trillion JPY (approx)
    NATIONAL_DEBT_TRILLION: 1130,    // Trillion JPY

    // Tax Revenue Baselines (per 1% rate)
    CONSUMPTION_TAX_BASE: 2500000000000,  // 2.5T JPY per 1% consumption tax
    INCOME_TAX_BASE: 1000000000000,       // 1.0T JPY per 1% income tax hike

    // Unit Conversion
    TRILLION: 1000000000000,

    // Social Parameters
    POVERTY_LINE: 200000,            // Monthly household poverty line (JPY)
    BASIC_NEED: 150000,              // Monthly basic living cost (JPY)

    // Simulation Defaults
    BASE_UNEMPLOYMENT_RATE: 0.025,   // 2.5%
    DEFAULT_SIM_YEARS: 10,
};
