/**
 * app.js
 * Application entry point. Handles UI rendering and events.
 */

// Imports are removed for local file compatibility.
// Assuming classes are available in global scope.

// --- Global Variables ---
let households = [];
let economyParams = new EconomyParameters();
// Charts Container
const charts = {
    funding: null,
    impact: null,
    timeline: null,
    agent: null
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("App Initialization");
    console.log("TimelineEngine defined?", typeof TimelineEngine !== 'undefined');
    console.log("AgentEngine defined?", typeof AgentSimulationEnvironment !== 'undefined');

    // 1. Initialize Objects
    households = generateHouseholdModels();

    // 2. Render Initial UI
    renderParametersForm();
    renderFundingForm();

    // 3. Initial Run
    runSimulation();

    // 4. Bind Event Listeners
    // Note: Modal listeners are attached at the bottom of the file (lines 567-579)

    // Phase 2: Timeline Event Listener
    const btnTimeline = document.getElementById('btn-run-timeline');
    if (btnTimeline) {
        console.log("Timeline button found, attaching listener");
        btnTimeline.addEventListener('click', () => {
            console.log("Timeline button clicked!");
            runTimelineSimulation();
        });
        // Also set onclick as backup
        btnTimeline.onclick = () => {
            console.log("Timeline onclick triggered!");
            runTimelineSimulation();
        };
    } else {
        console.error("ERROR: Timeline button NOT FOUND!");
    }

    // Phase 3: Agent Based Simulation Event Listener
    const btnRunAgent = document.getElementById('btn-run-agent-sim');
    if (btnRunAgent) {
        console.log("Agent button found, attaching listener");
        btnRunAgent.addEventListener('click', () => {
            console.log("Agent button clicked!");
            const originalText = btnRunAgent.innerHTML;
            btnRunAgent.innerHTML = '<span>⏳</span> 計算中...';
            btnRunAgent.disabled = true;

            setTimeout(() => {
                try {
                    runAgentSimulation();
                } catch (e) {
                    console.error("Simulation Error:", e);
                    // Show error in the result area instead of alert which users dislike
                    document.getElementById('res-poverty-rate').textContent = "Error";
                } finally {
                    btnRunAgent.innerHTML = originalText;
                    btnRunAgent.disabled = false;
                }
            }, 50);
        });
        // Also set onclick as backup
        btnRunAgent.onclick = () => {
            console.log("Agent onclick triggered!");
            runAgentSimulation();
        };

        // Run once automatically for defaults
        setTimeout(runAgentSimulation, 1000);
    } else {
        console.error("ERROR: Agent button NOT FOUND!");
    }
});


// --- Core Simulation Logic (Static) ---
function runSimulation() {
    // 1. Get Values from UI
    updateParamsFromUI();

    // 2. Perform Calculations for each household
    calculateHouseholdImpacts();

    // 3. Aggregate Macro Results
    const macroResults = calculateMacroResults();

    // 4. Update Dashboard
    updateKPIs(macroResults);
    updateCharts(macroResults);
    updateDetailedTable();

    // Phase 2: Update Timeline Input Display
    document.getElementById('disp-bi-amount').textContent = economyParams.monthlyUBI.toLocaleString();

    // Trigger Phase 2 Update if available
    if (typeof runTimelineSimulation === 'function') {
        runTimelineSimulation();
    }
}

// --- Phase 2: Timeline Simulation Logic ---
function runTimelineSimulation() {
    const engine = new TimelineEngine();

    // Get AI Scenario Inputs
    const pace = document.getElementById('ai-pace').value;
    const investment = parseInt(document.getElementById('ai-investment').value, 10);

    const aiScenario = { pace, investment };

    // Run Simulation
    // Pass current economyParams (which contains tax/bond settings)
    const timelineResults = engine.runSimulation(economyParams, aiScenario);

    // Render Results
    renderTimelineChart(timelineResults);
    renderJobGroupCards(timelineResults[timelineResults.length - 1].groups); // Show final year state
}

function renderTimelineChart(results) {
    const ctx = document.getElementById('chart-timeline-main').getContext('2d');
    const labels = results.map(r => `Year ${r.year}`);

    const dataGDP = results.map(r => r.gdp);
    const dataDebt = results.map(r => r.debt);
    const dataUnemp = results.map(r => r.unemployment);

    if (charts.timeline) charts.timeline.destroy();

    charts.timeline = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '名目GDP (兆円)',
                    data: dataGDP,
                    borderColor: '#3B82F6', // Primary Blue
                    yAxisID: 'y',
                    tension: 0.3
                },
                {
                    label: '公的債務残高 (兆円)',
                    data: dataDebt,
                    borderColor: '#EF4444', // Red
                    yAxisID: 'y',
                    tension: 0.3,
                    borderDash: [5, 5]
                },
                {
                    label: '完全失業率 (%)',
                    data: dataUnemp,
                    borderColor: '#F59E0B', // Amber
                    yAxisID: 'y1',
                    tension: 0.3,
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: '金額 (兆円)' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: { display: true, text: '失業率 (%)' },
                    grid: { drawOnChartArea: false },
                    min: 0,
                    max: 20 // Cap at 20% for readability
                }
            }
        }
    });
}

function runAgentSimulation() {
    if (typeof AgentSimulationEnvironment === 'undefined') {
        console.error("Agent Engine not loaded");
        return;
    }

    const sim = new AgentSimulationEnvironment(200, 2); // 200 households
    const ubiMonthly = parseFloat(economyParams.monthlyUBI); // Use economyParams

    // Run for 10 years
    const history = sim.run(10, ubiMonthly);

    // Update Summary Stats (Last Step)
    const lastStep = history[history.length - 1];
    document.getElementById('res-avg-hours').textContent = lastStep.avgWorkHours.toFixed(1) + " h";
    document.getElementById('res-poverty-rate').textContent = lastStep.povertyRate.toFixed(1) + " %";
    // Happiness not in history yet? Let's check agent_engine.js.
    // It wasn't in history push. Let's assume placeholder for now or calculate from agents if accessible
    // Accessing sim.persons directly
    const avgHappiness = Object.values(sim.persons).reduce((a, b) => a + b.happiness, 0) / Object.keys(sim.persons).length;
    document.getElementById('res-happiness').textContent = avgHappiness.toFixed(2);

    renderAgentChart(history);
}

// Remove local let agentChart = null; since we use global charts object now

function renderAgentChart(history) {
    const ctx = document.getElementById('chart-agent-poverty');
    if (!ctx) return;

    // Group by year (take avg or last month of year)
    // History is monthly steps.
    const labels = [];
    const dataPoverty = [];

    // Extract data every 12 months (Yearly snapshot)
    for (let i = 0; i < history.length; i += 12) {
        labels.push(`Year ${Math.floor(i / 12)}`);
        dataPoverty.push(history[i].povertyRate);
    }
    // Add final year
    labels.push(`Year 10`);
    dataPoverty.push(history[history.length - 1].povertyRate);

    const config = {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '貧困率 (%)',
                    data: dataPoverty,
                    borderColor: '#8B5CF6', // Purple
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    tension: 0.3,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    };

    if (charts.agent) {
        charts.agent.destroy();
    }
    charts.agent = new Chart(ctx, config);
}

function renderJobGroupCards(groups) {
    const container = document.getElementById('job-group-cards');
    container.innerHTML = '';

    groups.forEach(group => {
        // Calculate Changes (relative to baseline 1.0)
        const empChange = (group.employment - 1.0) * 100;
        const wageChange = (group.wage - 100);

        // Style based on Employment Impact
        let empColor = 'text-gray-600';
        let empIcon = '➡️';
        if (empChange < -5) { empColor = 'text-red-500'; empIcon = '↘️'; }
        if (empChange > 5) { empColor = 'text-green-500'; empIcon = '↗️'; }

        // Style based on Wage Impact
        let wageColor = 'text-gray-600';
        if (wageChange > 10) wageColor = 'text-green-600';
        if (wageChange < -5) wageColor = 'text-red-600';

        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-lg border border-gray-200 shadow-sm";
        card.innerHTML = `
            <h4 class="font-bold text-sm text-gray-800 mb-2 border-b pb-1">${group.label}</h4>
            <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                    <span class="text-gray-500">雇用量:</span>
                    <span class="font-bold ${empColor}">${empIcon} ${empChange.toFixed(1)}%</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-500">賃金水準:</span>
                    <span class="font-bold ${wageColor}">${wageChange > 0 ? '+' : ''}${wageChange.toFixed(1)}%</span>
                </div>
                <div class="text-xs text-gray-400 mt-2">
                    (基準比)
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// --- UI Rendering Functions (Static) ---
function renderParametersForm() {
    const paramContainer = document.getElementById('parameters-form');
    paramContainer.innerHTML = ''; // Clear placeholder

    // Monthly UBI Slider
    createSlider(paramContainer, {
        id: 'ubi-amount',
        label: '月額支給額 (Monthly UBI)',
        min: 0, max: 200000, step: 5000,
        value: economyParams.monthlyUBI,
        unit: '円',
        onChange: (val) => { economyParams.monthlyUBI = parseInt(val); runSimulation(); }
    });
}

function renderFundingForm() {
    const fundingContainer = document.getElementById('funding-form');
    fundingContainer.innerHTML = '';

    // Income Tax Increase
    createSlider(fundingContainer, {
        id: 'tax-income',
        label: '所得税率上乗せ (Income Tax +)',
        min: 0, max: 20, step: 1,
        value: economyParams.incomeTaxRateIncrease * 100,
        unit: '%',
        onChange: (val) => { economyParams.incomeTaxRateIncrease = parseFloat(val) / 100; runSimulation(); }
    });

    // Consumption Tax Increase
    createSlider(fundingContainer, {
        id: 'tax-consumption',
        label: '消費税率上乗せ (Consumption Tax +)',
        min: 0, max: 20, step: 1,
        value: economyParams.consumptionTaxRateIncrease * 100,
        unit: '%',
        onChange: (val) => { economyParams.consumptionTaxRateIncrease = parseFloat(val) / 100; runSimulation(); }
    });
}

/**
 * Setup a range slider component
 */
function createSlider(container, config) {
    const wrapper = document.createElement('div');
    wrapper.className = 'space-y-2';

    const header = document.createElement('div');
    header.className = 'flex justify-between items-center';

    const label = document.createElement('label');
    label.className = 'text-sm font-medium text-gray-700';
    label.textContent = config.label;

    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'text-sm font-bold text-primary';
    valueDisplay.textContent = `${config.value.toLocaleString()} ${config.unit}`;

    header.appendChild(label);
    header.appendChild(valueDisplay);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = config.min;
    input.max = config.max;
    input.step = config.step;
    input.value = config.value;
    input.className = 'w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer'; // Tailwind classes

    input.addEventListener('input', (e) => {
        valueDisplay.textContent = `${Number(e.target.value).toLocaleString()} ${config.unit}`;
        config.onChange(e.target.value);
    });

    wrapper.appendChild(header);
    wrapper.appendChild(input);
    container.appendChild(wrapper);
}

/**
 * Run the simulation and update UI
 */
function runSimulation() {
    engine = new SimulationEngine(economyParams, households);
    const results = engine.run();

    updateDashboard(results);
    updateCharts(results);
    updateDetailedTable();
    updateLogicModal(results);
}

/**
 * Update KPI cards
 */
function updateDashboard(results) {
    // Trillions of Yen
    const totalCostTrillion = results.totalAnnualCost.div(1000000000000).toFixed(1);
    document.getElementById('kpi-total-cost').textContent = `${totalCostTrillion}`;

    document.getElementById('kpi-gdp-impact').textContent = `${results.gdpImpact > 0 ? '+' : ''}${results.gdpImpact.toFixed(2)}%`;

    // Update Poverty Rate
    const povertyChange = results.povertyRateChange;
    const povertyElem = document.getElementById('kpi-poverty-rate');
    const povertySubElem = povertyElem.nextElementSibling; // The small text below

    povertyElem.textContent = `${povertyChange > 0 ? '+' : ''}${povertyChange.toFixed(2)}%`;

    if (povertyChange < 0) {
        povertySubElem.textContent = '▼ 改善 (Improved)';
        povertySubElem.className = 'text-xs text-green-500 mt-1';
    } else {
        povertySubElem.textContent = '▲ 悪化 (Worsened)';
        povertySubElem.className = 'text-xs text-red-500 mt-1';
    }

    // Format Funding Shortfall/Surplus for internal tracking/debugging or future UI
    // console.log(`Shortfall: ${results.shortfall.div(1000000000000).toFixed(1)}T`);
}

/**
 * Update Charts
 */
function updateCharts(results) {
    const ctxFunding = document.getElementById('chart-funding').getContext('2d');

    // Data preparation
    const fundingData = [
        results.fundingBreakdown.consumptionTax.div(1000000000000).toNumber(),
        results.fundingBreakdown.incomeTax.div(1000000000000).toNumber(),
        results.fundingBreakdown.welfareCuts.div(1000000000000).toNumber(),
        Math.max(0, results.shortfall.div(1000000000000).toNumber()) // Deficit treated as Bonds for now
    ];

    if (charts.funding) {
        charts.funding.data.datasets[0].data = fundingData;
        charts.funding.update();
    } else {
        charts.funding = new Chart(ctxFunding, {
            type: 'doughnut',
            data: {
                labels: ['消費税増収', '所得税増収', '福祉削減', '国債(赤字)'],
                datasets: [{
                    data: fundingData,
                    backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    // Bar Chart for Households
    const ctxImpact = document.getElementById('chart-household-impact').getContext('2d');
    const labels = households.map(h => h.label);
    const impactData = households.map(h => h.simulationResults.netChange.div(10000).toNumber()); // In 10k Yen

    if (charts.impact) {
        charts.impact.data.labels = labels;
        charts.impact.data.datasets[0].data = impactData;
        charts.impact.update();
    } else {
        charts.impact = new Chart(ctxImpact, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '年間実質手取変化 (万円)',
                    data: impactData,
                    backgroundColor: impactData.map(v => v >= 0 ? '#10B981' : '#EF4444')
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y', // Horizontal Bar
            }
        });
    }
}

/**
 * Update Detailed Table
 */
function updateDetailedTable() {
    const tbody = document.getElementById('impact-table-body');
    tbody.innerHTML = '';

    households.forEach(h => {
        const tr = document.createElement('tr');

        const netChange = h.simulationResults.netChange.toNumber();
        const netChangeStr = netChange >= 0 ? `+${netChange.toLocaleString()}` : netChange.toLocaleString();
        const colorClass = netChange >= 0 ? 'text-green-600' : 'text-red-600';

        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${h.label}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">¥${h.annualIncome.toNumber().toLocaleString()}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">¥${h.simulationResults.biReceived.toNumber().toLocaleString()}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-red-500">+¥${(h.simulationResults.newTax.minus(h.currentTax)).toNumber().toLocaleString()}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-bold ${colorClass}">${netChangeStr}</td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Logic Explanation Modal Control
 */
function updateLogicModal(results) {
    // Only update if needed, but here we just update DOM elements directly
    const totalCostTrillion = results.totalAnnualCost.div(1000000000000).toFixed(1);
    const deficitTrillion = results.shortfall.div(1000000000000).toFixed(1);
    const monthlyMan = economyParams.monthlyUBI / 10000;

    const elCost = document.getElementById('logic-cost-val');
    const elUbi = document.getElementById('logic-ubi-val');
    const elDeficit = document.getElementById('logic-deficit-val');

    if (elCost) elCost.textContent = totalCostTrillion;
    if (elUbi) elUbi.textContent = monthlyMan;
    if (elDeficit) elDeficit.textContent = deficitTrillion;
}

// Event Listeners for Modal
const modal = document.getElementById('logic-modal');
const btnShow = document.getElementById('btn-show-logic');
const btnClose = document.getElementById('btn-close-modal');

if (btnShow && modal && btnClose) {
    btnShow.addEventListener('click', () => {
        modal.classList.remove('hidden');
    });
    btnClose.addEventListener('click', () => {
        modal.classList.add('hidden');
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });
}

// ==========================================
// Life Sandbox Mode (Phase 3 Visualizer)
// ==========================================
class SandboxManager {
    constructor() {
        this.simulationData = null;
        this.currentStep = 0;
        this.isPlaying = false;
        this.playbackSpeed = 100; // ms per frame

        // DOM Elements
        this.canvas = document.getElementById('agent-world');
        try {
            this.ctx = this.canvas.getContext('2d');
        } catch (e) { console.warn("Canvas context not available"); }

        this.slider = document.getElementById('sb-timeline');
        this.btnPlay = document.getElementById('btn-sb-play');
        this.loading = document.getElementById('sb-loading');

        // Detail Panel Elements
        this.detailPanel = {
            placeholder: document.getElementById('sb-detail-placeholder'),
            content: document.getElementById('sb-detail-content'),
            id: document.getElementById('detail-id'),
            job: document.getElementById('detail-job'),
            income: document.getElementById('detail-income'),
            happiness: document.getElementById('detail-happiness'),
            log: document.getElementById('detail-log'),
            icon: document.getElementById('detail-icon')
        };

        this.init();
    }

    init() {
        if (!this.canvas) return;

        // Bind UI Events
        this.btnPlay.addEventListener('click', () => this.togglePlay());
        this.slider.addEventListener('input', (e) => {
            this.currentStep = parseInt(e.target.value);
            this.renderFrame();
        });

        document.getElementById('btn-run-sandbox').addEventListener('click', () => {
            // In a real app, this would fetch an API. 
            // Here we assume Python has run and updated the JSON.
            // We just reload the data.
            this.loadData();
        });

        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

        // Initial Data Load (Try loading if exists)
        this.loadData();
    }

    async loadData() {
        if (this.loading) this.loading.classList.remove('hidden');

        try {
            const response = await fetch('simulation_data.json');
            if (!response.ok) throw new Error("Data not found");

            this.simulationData = await response.json();

            // Setup Slider
            this.slider.max = this.simulationData.timeline.length - 1;
            this.currentStep = 0;
            this.slider.value = 0;

            console.log("Sandbox Data Loaded:", this.simulationData);
            this.renderFrame();

        } catch (err) {
            console.warn("Sandbox data fetch error:", err);
            // alert("Simulation data not found. Please run the backend simulation first.");
        } finally {
            if (this.loading) this.loading.classList.add('hidden');
        }
    }

    togglePlay() {
        this.isPlaying = !this.isPlaying;
        this.btnPlay.textContent = this.isPlaying ? '⏸' : '▶';

        if (this.isPlaying) {
            this.animate();
        }
    }

    animate() {
        if (!this.isPlaying) return;

        this.currentStep++;
        if (this.currentStep >= this.simulationData.timeline.length) {
            this.currentStep = 0; // Loop or stop
            // this.isPlaying = false;
            // this.btnPlay.textContent = '▶';
            // return;
        }

        this.slider.value = this.currentStep;
        this.renderFrame();

        setTimeout(() => requestAnimationFrame(() => this.animate()), this.playbackSpeed);
    }

    renderFrame() {
        if (!this.simulationData) return;

        const stepData = this.simulationData.timeline[this.currentStep];
        if (!stepData) return;

        // Update UI Text
        document.getElementById('sb-year').textContent = stepData.year;
        document.getElementById('sb-step').textContent = stepData.step;

        // Clear Canvas
        this.ctx.fillStyle = '#111827'; // bg-gray-900
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Agents
        stepData.agents.forEach(agent => {
            this.drawAgent(agent);
        });
    }

    drawAgent(agent) {
        // Mapping Logic
        // X: Income (0 - 20,000,000) Log scale better? Or Linear clamped.
        // Y: Happiness (0 - 20?? need to check range). 
        // Let's assume Happiness is naturally around 5-15.

        const w = this.canvas.width;
        const h = this.canvas.height;
        const padding = 50;

        // Income X (Linear up to 15M for visual spread)
        const maxIncome = 15000000;
        let xRatio = agent.income / maxIncome;
        xRatio = Math.min(xRatio, 1.0);
        const x = padding + xRatio * (w - 2 * padding);

        // Happiness Y (Say min -10, max 30)
        // High happiness -> Low Y (Top)
        const minH = -5, maxH = 25;
        let hRatio = (agent.happiness - minH) / (maxH - minH);
        hRatio = Math.max(0, Math.min(1, hRatio));
        const y = (h - padding) - (hRatio * (h - 2 * padding));

        // Color by Job
        this.ctx.fillStyle = this.getJobColor(agent.job);

        // Draw
        this.ctx.beginPath();
        if (agent.is_unemployed) {
            // Draw X or different shape
            this.ctx.strokeStyle = this.ctx.fillStyle;
            this.ctx.lineWidth = 2;
            const size = 6;
            this.ctx.moveTo(x - size, y - size);
            this.ctx.lineTo(x + size, y + size);
            this.ctx.moveTo(x + size, y - size);
            this.ctx.lineTo(x - size, y + size);
            this.ctx.stroke();
        } else {
            // Circle
            this.ctx.arc(x, y, 5, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    getJobColor(jobName) {
        switch (jobName) {
            case 'Specialist': return '#f59e0b'; // Amber
            case 'Admin': return '#3b82f6'; // Blue
            case 'Service': return '#10b981'; // Emerald
            case 'Manual': return '#ef4444'; // Red
            default: return '#9ca3af';
        }
    }

    handleCanvasClick(e) {
        if (!this.simulationData) return;

        const rect = this.canvas.getBoundingClientRect();
        // Scale for canvas resolution vs css size
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;

        // Find closest agent
        const stepData = this.simulationData.timeline[this.currentStep];
        let closestDist = Infinity;
        let closestAgent = null;

        // Re-calculate positions to match draw (Keep strict Sync!)
        // Duplicated logic: Refactor if robust, but inline ok for now.
        const w = this.canvas.width;
        const h = this.canvas.height;
        const padding = 50;
        const maxIncome = 15000000;
        const minH = -5, maxH = 25;

        stepData.agents.forEach(agent => {
            let xRatio = Math.min(agent.income / maxIncome, 1.0);
            const ax = padding + xRatio * (w - 2 * padding);

            let hRatio = Math.max(0, Math.min(1, (agent.happiness - minH) / (maxH - minH)));
            const ay = (h - padding) - (hRatio * (h - 2 * padding));

            const dist = Math.sqrt((clickX - ax) ** 2 + (clickY - ay) ** 2);
            if (dist < 15 && dist < closestDist) { // 15px radius tolerance
                closestDist = dist;
                closestAgent = agent;
            }
        });

        if (closestAgent) {
            this.showDetail(closestAgent.id);
        }
    }

    showDetail(agentId) {
        this.detailPanel.placeholder.classList.add('hidden');
        this.detailPanel.content.classList.remove('hidden');

        // Get generic info from current step
        const currentData = this.simulationData.timeline[this.currentStep].agents.find(a => a.id === agentId);
        if (!currentData) return;

        this.detailPanel.id.textContent = agentId;
        this.detailPanel.job.textContent = currentData.job;
        this.detailPanel.income.textContent = Math.round(currentData.income).toLocaleString();
        this.detailPanel.happiness.textContent = currentData.happiness.toFixed(1);

        // Build History Log
        // Scan full timeline for this agent events
        this.detailPanel.log.innerHTML = '';

        // Extract meaningful events: Job Change? Wage Drop? Unemployed?
        let prev = null;

        // Sample every 12 steps (Yearly) + current
        // Or scan all steps for change? Scanning all might be heavy if 1000 steps. 120 is fine.

        this.simulationData.timeline.forEach(t => {
            const ag = t.agents.find(a => a.id === agentId);
            if (!ag) return;

            let event = null;
            if (!prev) {
                if (t.step === 0) event = `Start: ${ag.job}, Inc: ¥${Math.round(ag.income / 10000)}w`;
            } else {
                if (!prev.is_unemployed && ag.is_unemployed) {
                    event = `<span class="text-red-500 font-bold">Lost Job</span> (AI displacement?)`;
                } else if (prev.is_unemployed && !ag.is_unemployed) {
                    event = `<span class="text-green-600 font-bold">Re-employed</span> as ${ag.job}`;
                } else if (Math.abs(ag.income - prev.income) > 50000) { // Significant income jump check
                    // Maybe too noisy - skip
                }
            }

            if (event) {
                const li = document.createElement('li');
                li.innerHTML = `<span class="text-xs text-gray-400">Y${t.year} M${t.step % 12}:</span> ${event}`;
                li.className = "pb-2 border-b border-gray-100 last:border-0";
                this.detailPanel.log.prepend(li); // Newest top
            }

            prev = ag;
        });

        // Add current status at top
        const statusLi = document.createElement('li');
        statusLi.innerHTML = `<span class="font-bold text-blue-600">Current (Month ${this.currentStep}):</span> ${currentData.is_unemployed ? 'Unemployed' : 'Working'} ${Math.round(currentData.work_hours)}h/w`;
        statusLi.className = "pb-2 border-b border-gray-100 bg-blue-50 p-2 rounded";
        this.detailPanel.log.prepend(statusLi);
    }
}

// Initialize Sandbox when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Other init code runs...

    // Init Sandbox
    const sandbox = new SandboxManager();
});

