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
        btnTimeline.addEventListener('click', () => runTimelineSimulation());
    }

    // Phase 3: Agent Based Simulation Event Listener
    const btnRunAgent = document.getElementById('btn-run-agent-sim');
    if (btnRunAgent) {
        btnRunAgent.addEventListener('click', () => {
            const originalText = btnRunAgent.innerHTML;
            btnRunAgent.innerHTML = '<span>⏳</span> 計算中...';
            btnRunAgent.disabled = true;

            setTimeout(() => {
                try {
                    runAgentSimulation();
                } catch (e) {
                    document.getElementById('res-poverty-rate').textContent = "Error";
                } finally {
                    btnRunAgent.innerHTML = originalText;
                    btnRunAgent.disabled = false;
                }
            }, 50);
        });

        // Run once automatically for defaults
        setTimeout(runAgentSimulation, 1000);
    }
});


// --- Core Simulation Logic (Static) ---

// Debounce utility
function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

const debouncedRunSimulation = debounce(() => runSimulation(), 300);

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
        onChange: (val) => { economyParams.monthlyUBI = parseInt(val); debouncedRunSimulation(); }
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
        onChange: (val) => { economyParams.incomeTaxRateIncrease = parseFloat(val) / 100; debouncedRunSimulation(); }
    });

    // Consumption Tax Increase
    createSlider(fundingContainer, {
        id: 'tax-consumption',
        label: '消費税率上乗せ (Consumption Tax +)',
        min: 0, max: 20, step: 1,
        value: economyParams.consumptionTaxRateIncrease * 100,
        unit: '%',
        onChange: (val) => { economyParams.consumptionTaxRateIncrease = parseFloat(val) / 100; debouncedRunSimulation(); }
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
    input.className = 'w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer';
    input.setAttribute('aria-label', config.label);

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
    const engine = new SimulationEngine(economyParams, households);
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
    const totalCostTrillion = results.totalAnnualCost.div(SimConstants.TRILLION).toFixed(1);
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
    // console.log(`Shortfall: ${results.shortfall.div(SimConstants.TRILLION).toFixed(1)}T`);
}

/**
 * Update Charts
 */
function updateCharts(results) {
    const ctxFunding = document.getElementById('chart-funding').getContext('2d');

    // Data preparation
    const fundingData = [
        results.fundingBreakdown.consumptionTax.div(SimConstants.TRILLION).toNumber(),
        results.fundingBreakdown.incomeTax.div(SimConstants.TRILLION).toNumber(),
        results.fundingBreakdown.welfareCuts.div(SimConstants.TRILLION).toNumber(),
        Math.max(0, results.shortfall.div(SimConstants.TRILLION).toNumber()) // Deficit treated as Bonds for now
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
    const totalCostTrillion = results.totalAnnualCost.div(SimConstants.TRILLION).toFixed(1);
    const deficitTrillion = results.shortfall.div(SimConstants.TRILLION).toFixed(1);
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
        } catch (e) { /* Canvas context not available */ }

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

        // Initial Draw (Empty Grid)
        this.renderFrame();

        // Initial Data Load (Try loading if exists)
        this.loadData();
    }

    async loadData() {
        if (this.loading) this.loading.classList.remove('hidden');

        try {
            // Priority 1: Check Global Variable (loaded via js/data_loader.js)
            if (window.SIMULATION_DATA) {
                this.simulationData = window.SIMULATION_DATA;
            } else {
                // Priority 2: Try Fetch (works if on server)
                const response = await fetch('simulation_data.json');
                if (!response.ok) throw new Error("Data not found");
                this.simulationData = await response.json();
            }

            // Setup Slider
            this.slider.max = this.simulationData.timeline.length - 1;
            this.currentStep = 0;
            this.slider.value = 0;

            this.renderFrame();

        } catch (err) {
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
        // Always clear and draw background
        this.ctx.fillStyle = '#111827'; // bg-gray-900
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawBackground();

        if (!this.simulationData) {
            // Optional: Draw "No Data" message?
            return;
        }

        const stepData = this.simulationData.timeline[this.currentStep];
        if (!stepData) return;

        // Update UI Text
        document.getElementById('sb-year').textContent = stepData.year;
        document.getElementById('sb-step').textContent = stepData.step;

        // Draw Agent Trails (History)
        this.drawTrails(stepData.agents);

        // Draw Agents
        stepData.agents.forEach(agent => {
            this.drawAgent(agent);
        });
    }

    drawBackground() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const padding = 50;

        this.ctx.save();

        // 1. Grid Lines
        this.ctx.strokeStyle = '#374151'; // gray-700
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([4, 4]);

        // X-Axis Grid
        for (let i = 1; i < 4; i++) {
            const x = padding + (w - 2 * padding) * (i / 4);
            this.ctx.beginPath();
            this.ctx.moveTo(x, padding);
            this.ctx.lineTo(x, h - padding);
            this.ctx.stroke();
        }

        // Y-Axis Grid
        for (let i = 1; i < 4; i++) {
            const y = padding + (h - 2 * padding) * (i / 4);
            this.ctx.beginPath();
            this.ctx.moveTo(padding, y);
            this.ctx.lineTo(w - padding, y);
            this.ctx.stroke();
        }

        // 2. Axes Lines
        this.ctx.strokeStyle = '#9CA3AF'; // gray-400
        this.ctx.setLineDash([]);
        this.ctx.lineWidth = 2;

        // X Axis (Bottom)
        this.ctx.beginPath();
        this.ctx.moveTo(padding, h - padding);
        this.ctx.lineTo(w - padding + 10, h - padding);
        this.ctx.stroke();
        // X Axis Arrow
        this.ctx.beginPath();
        this.ctx.moveTo(w - padding, h - padding - 5);
        this.ctx.lineTo(w - padding + 10, h - padding);
        this.ctx.lineTo(w - padding, h - padding + 5);
        this.ctx.fill();

        // Y Axis (Left)
        this.ctx.beginPath();
        this.ctx.moveTo(padding, h - padding);
        this.ctx.lineTo(padding, padding - 10);
        this.ctx.stroke();
        // Y Axis Arrow
        this.ctx.beginPath();
        this.ctx.moveTo(padding - 5, padding);
        this.ctx.lineTo(padding, padding - 10);
        this.ctx.lineTo(padding + 5, padding);
        this.ctx.fill();

        // 3. Labels (Make them visible)
        this.ctx.fillStyle = '#E5E7EB'; // gray-200
        this.ctx.font = 'bold 14px Inter, sans-serif';
        this.ctx.textAlign = 'center';

        // X Axis Label
        this.ctx.fillText('収入 (Income) →', w / 2, h - 15);

        // Y Axis Label
        this.ctx.save();
        this.ctx.translate(20, h / 2);
        this.ctx.rotate(-Math.PI / 2);
        this.ctx.textAlign = 'center';
        this.ctx.fillText('幸福度 (Happiness) →', 0, 0);
        this.ctx.restore();

        // 4. Quadrant Background Labels (More visible but behind agents)
        this.ctx.fillStyle = '#374151'; // gray-700
        this.ctx.font = 'bold 24px Inter, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('充実 (Thriving)', w * 0.75, h * 0.25);
        this.ctx.fillText('平穏 (Content)', w * 0.25, h * 0.25);
        this.ctx.fillText('努力 (Striving)', w * 0.75, h * 0.75);
        this.ctx.fillText('苦境 (Struggling)', w * 0.25, h * 0.75);

        // 5. Legend
        this.drawLegend();

        this.ctx.restore();
    }

    drawLegend() {
        const legendWidth = 160;
        const legendHeight = 165;
        const legendX = this.canvas.width - legendWidth - 15;
        const legendY = 15;

        // Background
        this.ctx.fillStyle = 'rgba(17, 24, 39, 0.85)'; // bg-gray-900 with alpha
        this.ctx.beginPath();
        this.ctx.roundRect(legendX, legendY, legendWidth, legendHeight, 8);
        this.ctx.fill();
        this.ctx.strokeStyle = '#4B5563'; // gray-600
        this.ctx.lineWidth = 1;
        this.ctx.stroke();

        this.ctx.fillStyle = '#D1D5DB'; // gray-300
        this.ctx.font = '12px Inter, sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';

        const items = [
            { label: '専門職 (Specialist)', color: '#f59e0b', type: 'circle' },
            { label: '管理職 (Admin)', color: '#3b82f6', type: 'circle' },
            { label: 'サービス (Service)', color: '#10b981', type: 'circle' },
            { label: '現場労働 (Manual)', color: '#ef4444', type: 'circle' },
            { label: '失業 (Unemployed)', color: '#ef4444', type: 'cross' },
            { label: '過去の移動軌跡', color: '#9ca3af', type: 'trail' }
        ];

        items.forEach((item, index) => {
            const y = legendY + 20 + (index * 24);
            const xIcon = legendX + 20;
            const xText = legendX + 35;

            this.ctx.fillStyle = item.color;
            this.ctx.strokeStyle = item.color;
            this.ctx.beginPath();

            if (item.type === 'circle') {
                this.ctx.arc(xIcon, y, 5, 0, Math.PI * 2);
                this.ctx.fill();
            } else if (item.type === 'cross') {
                this.ctx.lineWidth = 2;
                const size = 5;
                this.ctx.moveTo(xIcon - size, y - size);
                this.ctx.lineTo(xIcon + size, y + size);
                this.ctx.moveTo(xIcon + size, y - size);
                this.ctx.lineTo(xIcon - size, y + size);
                this.ctx.stroke();
            } else if (item.type === 'trail') {
                // Draw a small fading trail representation
                this.ctx.globalAlpha = 0.2;
                this.ctx.arc(xIcon - 10, y + 4, 2, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.beginPath();
                this.ctx.globalAlpha = 0.5;
                this.ctx.arc(xIcon - 5, y + 2, 3, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.beginPath();
                this.ctx.globalAlpha = 1.0;
                this.ctx.arc(xIcon, y, 4, 0, Math.PI * 2);
                this.ctx.fill();
            }

            this.ctx.fillStyle = '#E5E7EB';
            this.ctx.globalAlpha = 1.0;
            this.ctx.fillText(item.label, xText, y);
        });
    }

    drawTrails(currentAgents) {
        const trailLength = 5;
        if (this.currentStep < 1) return;

        this.ctx.save();

        // Build ID -> agent map for current agents for quick lookup
        const currentAgentMap = new Map(currentAgents.map(a => [a.id, a]));

        for (let i = 1; i <= trailLength; i++) {
            const stepIndex = this.currentStep - i;
            if (stepIndex < 0) break;

            const pastAgents = this.simulationData.timeline[stepIndex].agents;
            const opacity = 0.3 * (1 - i / trailLength);

            for (const pastAgent of pastAgents) {
                if (!currentAgentMap.has(pastAgent.id)) continue;
                const pos = this.getAgentPos(pastAgent);

                this.ctx.fillStyle = this.getJobColor(pastAgent.job);
                this.ctx.globalAlpha = opacity;
                this.ctx.beginPath();
                this.ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
        this.ctx.restore();
    }

    getAgentPos(agent) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const padding = 50;

        // Income X (Linear up to 15M)
        const maxIncome = 15000000;
        let xRatio = agent.income / maxIncome;
        xRatio = Math.min(xRatio, 1.0);
        const x = padding + xRatio * (w - 2 * padding);

        // Happiness Y (Min -5, Max 25)
        const minH = -5, maxH = 25;
        let hRatio = (agent.happiness - minH) / (maxH - minH);
        hRatio = Math.max(0, Math.min(1, hRatio));
        const y = (h - padding) - (hRatio * (h - 2 * padding));

        return { x, y };
    }

    drawAgent(agent) {
        const { x, y } = this.getAgentPos(agent);

        // Color by Job
        this.ctx.fillStyle = this.getJobColor(agent.job);

        // Draw
        this.ctx.beginPath();
        if (agent.is_unemployed) {
            // Draw X
            this.ctx.strokeStyle = this.ctx.fillStyle; // Use job color (last job) or Gray?
            // If unemployed, usually keep last job color or turn gray. Let's keep job color but add Red outline?
            // Or just Red X.
            this.ctx.strokeStyle = '#EF4444'; // Red for unemployed
            this.ctx.lineWidth = 2;
            const size = 5;
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
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;

        // Find closest agent
        const stepData = this.simulationData.timeline[this.currentStep];
        let closestDist = Infinity;
        let closestAgent = null;

        stepData.agents.forEach(agent => {
            const { x, y } = this.getAgentPos(agent); // Reuse logic
            const dist = Math.sqrt((clickX - x) ** 2 + (clickY - y) ** 2);
            if (dist < 15 && dist < closestDist) {
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
        this.detailPanel.log.innerHTML = '';

        let prev = null;

        this.simulationData.timeline.forEach(t => {
            const ag = t.agents.find(a => a.id === agentId);
            if (!ag) return;

            let event = null;
            if (!prev) {
                if (t.step === 0) event = `Start: ${ag.job}, Inc: ¥${Math.round(ag.income / 10000)}w`;
            } else {
                if (!prev.is_unemployed && ag.is_unemployed) {
                    event = `Lost Job (AI displacement?)`;
                } else if (prev.is_unemployed && !ag.is_unemployed) {
                    event = `Re-employed as ${ag.job}`;
                }
            }

            if (event) {
                const li = document.createElement('li');
                const timeSpan = document.createElement('span');
                timeSpan.className = 'text-xs text-gray-400';
                timeSpan.textContent = `Y${t.year} M${t.step % 12}: `;

                const eventSpan = document.createElement('span');
                if (event.startsWith('Lost Job')) {
                    eventSpan.className = 'text-red-500 font-bold';
                } else if (event.startsWith('Re-employed')) {
                    eventSpan.className = 'text-green-600 font-bold';
                }
                eventSpan.textContent = event;

                li.appendChild(timeSpan);
                li.appendChild(eventSpan);
                li.className = "pb-2 border-b border-gray-100 last:border-0";
                this.detailPanel.log.prepend(li);
            }

            prev = ag;
        });

        // Add current status at top
        const statusLi = document.createElement('li');
        const statusLabel = document.createElement('span');
        statusLabel.className = 'font-bold text-blue-600';
        statusLabel.textContent = `Current (Month ${this.currentStep}): `;
        const statusText = document.createTextNode(
            `${currentData.is_unemployed ? 'Unemployed' : 'Working'} ${Math.round(currentData.work_hours)}h/w`
        );
        statusLi.appendChild(statusLabel);
        statusLi.appendChild(statusText);
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

