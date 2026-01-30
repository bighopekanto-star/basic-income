/**
 * agent_engine.js
 * Client-side implementation of the Agent-Based Simulation (ABS) for UBI.
 * Ported from the Python prototype to run directly in the browser.
 */

// Utility for random normal distribution (Box-Muller transform)
function randomNormal(mean, std) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mean + z * std;
}

class PersonAgent {
    constructor({ id, age, hourlyWage, workHours, householdId }) {
        this.id = id;
        this.age = age;
        this.hourlyWage = hourlyWage;
        this.workHours = workHours; // Weekly
        this.saving = 0;
        this.householdId = householdId;
        this.happiness = 5.0;
        this.stress = 0;
    }

    /**
     * Agent decision step
     * @param {Object} policy - { ubiAmount, incomeTaxRate }
     * @param {number} basicNeed - Monthly basic living cost (e.g., 150000)
     */
    step(policy, basicNeed) {
        // 1. Labor Supply Decision
        // Simple logic: if basic needs are not met by UBI, work to fill the gap.
        // Gap = BasicNeed - UBI
        const gap = Math.max(0, basicNeed - policy.ubiAmount);

        // Target weekly work hours to fill the gap
        // Income = HourlyWage * Hours * 4 weeks
        const targetHours = gap / (this.hourlyWage * 4 + 1e-6);

        // Apply inertia (don't change habits instantly)
        // New = 0.7 * Old + 0.3 * Target
        const inertia = 0.7;
        let newHours = inertia * this.workHours + (1 - inertia) * targetHours;

        // Clamp work hours (0 to 80)
        this.workHours = Math.max(0, Math.min(80, newHours));

        // 2. Income & Consumption
        const incomeLabor = this.hourlyWage * this.workHours * 4;
        const incomeTotal = incomeLabor + policy.ubiAmount;

        // Tax (simplified flat tax on total income for prototype)
        const tax = incomeTotal * policy.incomeTaxRate;
        const disposableIncome = incomeTotal - tax;

        // Saving (Assume 20% saving rate for now)
        this.saving += disposableIncome * 0.2;

        // 3. Happiness Update
        // Positive: Income, Leisure (if not too much work)
        // Negative: Overwork (>40h)
        // Base 5.0
        this.happiness = 5.0
            + (disposableIncome / 100000) * 0.5   // +0.5 per 100k income
            - Math.max(0, this.workHours - 40) * 0.1; // -0.1 per hour over 40h

        // Clamp happiness
        this.happiness = Math.max(0, Math.min(10, this.happiness));
    }
}

class HouseholdAgent {
    constructor({ id, memberIds }) {
        this.id = id;
        this.memberIds = memberIds;
        this.totalIncome = 0;
        this.isPoor = false;
    }

    aggregate(personsMap, povertyLine) {
        this.totalIncome = 0;
        this.memberIds.forEach(pid => {
            const p = personsMap[pid];
            // Re-calculate monthly income for aggregation
            const labor = p.hourlyWage * p.workHours * 4;
            // Note: UBI is not stored in person state in this simple version, 
            // but we should pass it or access it. 
            // For visualization consistency, let's sum labor income here 
            this.totalIncome += labor;
        });

        // Note: This 'isPoor' check is purely based on Labor Income in this proto
        // Ideally should include UBI. Will be fixed in full logic integration.
        // For now, checks if Labor Income < PovertyLine
        this.isPoor = this.totalIncome < povertyLine;
    }
}

class AgentSimulationEnvironment {
    constructor(nHouseholds = 200, personsPerHousehold = 2) {
        this.nHouseholds = nHouseholds;
        this.personsPerHousehold = personsPerHousehold;
        this.policy = {
            ubiAmount: 0,        // Configured at runtime
            incomeTaxRate: 0.2
        };
        this.basicNeed = 150000;
        this.povertyLine = 200000;

        this.persons = {};
        this.households = {};

        this.initAgents();
    }

    initAgents() {
        this.persons = {};
        this.households = {};
        let pid = 0;

        for (let hid = 0; hid < this.nHouseholds; hid++) {
            const currentMemberIds = [];
            for (let i = 0; i < this.personsPerHousehold; i++) {
                // Random wage: Mean 1500, SD 500, Min 850 (Minimum wage proxy)
                let wage = randomNormal(1500, 500);
                if (wage < 850) wage = 850;

                const p = new PersonAgent({
                    id: pid,
                    age: Math.floor(20 + Math.random() * 40),
                    hourlyWage: wage,
                    workHours: 40, // Start full time
                    householdId: hid
                });
                this.persons[pid] = p;
                currentMemberIds.push(pid);
                pid++;
            }
            this.households[hid] = new HouseholdAgent({ id: hid, memberIds: currentMemberIds });
        }
    }

    run(years, ubiMonthly) {
        this.policy.ubiAmount = ubiMonthly;

        const steps = years * 12;
        const history = [];

        for (let t = 0; t < steps; t++) {
            // Step Persons
            Object.values(this.persons).forEach(p => p.step(this.policy, this.basicNeed));

            // Aggregate Households
            let poorCount = 0;
            Object.values(this.households).forEach(h => {
                h.aggregate(this.persons, this.povertyLine);
                // Correct Poverty Check: Income (Labor) + UBI * Members
                // Need to include UBI in household income for poverty check!
                const totalHouseholdIncome = h.totalIncome + (this.policy.ubiAmount * h.memberIds.length);
                h.isPoor = totalHouseholdIncome < this.povertyLine;

                if (h.isPoor) poorCount++;
            });

            // Record Stats
            const povertyRate = poorCount / this.nHouseholds;
            history.push({
                step: t,
                year: Math.floor(t / 12),
                povertyRate: povertyRate * 100,
                avgWorkHours: this.calculateAvgWorkHours()
            });
        }
        return history;
    }

    calculateAvgWorkHours() {
        const all = Object.values(this.persons);
        const sum = all.reduce((acc, p) => acc + p.workHours, 0);
        return sum / all.length;
    }
}

// Export to Global
window.AgentSimulationEnvironment = AgentSimulationEnvironment;
