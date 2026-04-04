/**
 * @project     Canada-Malaysia Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     14.0.1 (Fix: Removed unreachable 'else if (typeof string)' inside 'if (typeof function)' in setLanguage)
 * @file        uiCore.js
 * @description Core UI setup. Handles translations (Thai->Malaysia) and triggers auto-load on startup.
 */

// uiCore.js

// --- Global Variables (Core UI State & Elements) ---
let currentLanguage = 'en';
let elements = {}; // Populated in initializeCore

// --- Language Data ---
const translations = {
    en: {
        pageTitle: "Canada to Malaysia Retirement Calculator (Non-Resident)",
        mainTitle: "Canada to Malaysia Retirement Calculator",
        subTitle: "Simulate non-resident retirement in Malaysia (Single Person).",
        darkModeLabel: "Dark Mode", langToggle: "Lang",
        loadScenarioBtn: "Load Scenario", saveScenarioBtn: "Save Scenario",
        tabScenarioA: "Scenario A", tabScenarioB: "Scenario B", tabResults: "Results",
        section1Title: "1. Enter Information", legendBasicInfo: "Basic Information",
        exchangeRateLabel: "Exchange Rate (1 CAD = ? MYR)",
        exchangeRateTooltip: "Used to convert income estimates to Ringgit. Malaysia Tax is 0% on foreign income.",
        legendYourInfo: "Income Plan", userBirthYearLabel: "Birth Year", 
        legendOtherIncome: "Other Income & Expenses", otherIncomeDesc: "Manage pensions, rental income, and living expenses.",
        manageIncomeExpensesBtn: "[ Manage Income & Expenses ]",
        legendAssumptions: "Global Assumptions", colaLabel: "Global COLA (%)", lifeExpectancyLabel: "Max Calculation Age",
        legendGrowthAssumptionsIncome: "Growth, Assumptions & Other Items",
        runAnalysisBtn: "Run Analysis", retirementAgeLabel: "Retirement Age", 
        legendAssets: "Assets at Retirement", 
        runMonteCarloBtn: "Run Monte Carlo", monteCarloRunsLabel: "Runs:",
        mcTitle: "Monte Carlo Simulation Results", mcSubTitle: (runs) => `Based on ${runs.toLocaleString()} randomized runs`,
        mcSuccessRate: "Success Rate", mcSuccessDesc: "(% of runs not depleting assets)",
        mcP10: "10th Percentile", mcP10Desc: "(Bottom 10% outcome)",
        mcMedian: "Median", mcMedianDesc: "(50th percentile outcome)",
        mcP90: "90th Percentile", mcP90Desc: "(Top 10% outcome)",
        mcFinalAssets: "Final Total Assets",
        mcGraphTitleA: "Monte Carlo Graph (Scenario A)", 
        mcGraphTitleB: "Monte Carlo Graph (Scenario B)", 
        runOptimizedMonteCarloBtn: "Run Optimized MC", optimizedMonteCarloRunsLabel: "Optimized Runs:",
        section2Title: "2. Analysis Results", loadingText: "Calculating...",
        toggleGraphBtn: "Show/Hide Graph", toggleTableBtn: "Show/Hide Detailed Data", exportCsvBtn: "Export CSV",
        runOptimizationBtn: "Run Optimization (N/A)",
        loadingTextOptimizer: "Running Optimization...",
        modalTitle: "Manage Income & Expenses", modalAddTitle: "Add/Edit Item",
        incomeTypeLabel: "Type", incomeTypeIncome: "Income", incomeTypeExpense: "Expense",
        incomeTypePension: "Income: Pension (Malaysia Tax-Free)", incomeTypeOther: "Income: Other (Malaysia Tax-Free)",
        expenseTypeMalaysia: "Expense: Malaysia Living", 
        expenseTypeSpecial: "Expense: Special (Exempt from Survival Rule)",
        expenseTypeOverseas: "Expense: Overseas",
        expenseTypeLiving: "Expense: Total Living Expense (CAD)",
        
        incomeDescLabel: "Description", incomeAmountLabel: "Amount (PV)", incomeStartAgeLabel: "Start Age", incomeEndAgeLabel: "End Age", saveIncomeBtn: "Save",
        incomeColaLabel: "COLA (%)", incomeColaTooltip: "Individual Cost of Living Adjustment for this item.",
        noIncomeAdded: "None added.", incomeItemLabel: (p) => `${p.desc}: $${p.amount.toLocaleString()}/yr (Age ${p.startAge}-${p.endAge})`, editBtn: "Edit", deleteBtn: "Delete",
        futureValueStarted: "Already started.", futureValueDisplay: (p) => `Est @ Age ${p.age}: $${p.value.toLocaleString()}`,
        breakEvenResult: "Calculation Complete.", noBreakEvenResult: "Calculation Complete.",
        disclaimerTitle: "Disclaimer", disclaimerP1: "For information only.", disclaimerP2: "Results are estimates. Not financial advice.", disclaimerP3: "Consult a professional specific to international tax.",
        welcomeTitle: "Welcome to the Canada-Malaysia Retirement Simulator!",
        welcomeP1: "This tool simulates retirement in Malaysia for a Canadian non-resident.",
        resultsHeader: "Key Tax & Income Rules Applied:",
        resultsP1: `<ul>
                        <li><strong>Canadian Non-Resident Tax:</strong> 0% Capital Gains Tax. 15% Withholding Tax on Pensions.</li>
                        <li><strong>Malaysia Tax (Foreign Source Income):</strong> Currently, foreign source income remitted to Malaysia by resident individuals is <strong>Tax Exempt (0%)</strong> until 2026 (likely to extend). Capital gains are also exempt.</li>
                        <li><strong>Withdrawal Strategy:</strong> Automatically prioritizes 0% tax sources (Non-Reg, TFSA) or 15% tax sources (RRIF) based on your selection.</li>
                    </ul>`,
        resultsP2: `<ul>
                        <li><strong>Simplified Expenses:</strong> Consolidates all living expenses into one 'Total Living Expense' bucket.</li>
                    </ul>`,
        createdBy: "Created by ", agreeLabel: "I understand and agree.", confirmBtn: "Confirm",
        metricsTitle: "Key Metrics Summary", metricsFinalAssets: "Final Total Assets", metricsTotalIncomeGross: "Total Income (Gross)", metricsTotalTaxesPaid: "Total Taxes (Can WHT + MY)",
        metricsScenarioA: "Scenario A", metricsScenarioB: "Scenario B", metricsDifference: "Difference (B - A)",
        tableTitle: "Detailed Year-by-Year Comparison", colAge: "Age", colTotalAssets: "Total Assets",
        colIncomeOther: "Inc: Other", colIncomeTotal: "Inc: Total",
        colExpenses: "Expenses", colTaxesPaid: "Taxes (Total)", colNetCashflow: "Net Cashflow",
        colWdRRSP: "WD: RRSP", colWdLIF: "WD: LIF", colWdNonReg: "WD: NonReg", colWdTFSA: "WD: TFSA", colWdTotal: "WD: Total",
        colTaxableIncome: "Foreign Taxable Inc.",
        colBalRRSP: "Bal: RRSP", colBalLIF: "Bal: LIF", colBalNonReg: "Bal: NonReg", colBalTFSA: "Bal: TFSA",
        prefixA: "A: ", prefixB: "B: ", errSimFailed: "Error during calculation: ",
        simComplete: (yrsA, yrsB) => `Simulation Complete (A: ${yrsA} years, B: ${yrsB} years)`
    }
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initializeCore();
});

function initializeCore() {
    elements = {};
    const allElementIds = [
        'theme-toggle',
        'load-scenario-btn', 'save-scenario-btn', 'scenario-file-input',
        'exchangeRate',
        // A
        'lifeExpectancy', 'retirementAge_a', 'userBirthYear', 
        'spouseBirthYear',
        
        'manage-income-btn', 'income-modal', 'save-income-btn', 'income-list', 'income-id', 'future-value-display', 'add-income-form', 'income-cola',
        'income-type', 'income-owner', 
        'isCouple_a',

        'cola',
        // B
        'lifeExpectancy_b', 'retirementAge_b', 'userBirthYear_b', 
        'spouseBirthYear_b', 

        'manage-income-btn_b', 'income-modal_b', 'save-income-btn_b', 'income-list_b', 'income-id_b', 'future-value-display_b', 'add-income-form_b', 'income-cola_b',
        'income-type_b', 'income-owner_b',
        'isCouple_b',

        'cola_b',

        // Common
        'runAnalysisBtn', 'loading-indicator', 'results-container', 'break-even-text-result', 'additional-metrics-container',
        'toggle-graph-btn', 'export-csv-btn',
        'toggle-details-a-btn', 'toggle-details-b-btn', 'detailed-table-container-a', 'detailed-table-container-b',
        'welcome-modal', 'disclaimer-agree', 'agree-btn',
        'runOptimizationBtn', 'optimizer-loading-indicator', 'optimizer-loading-text',
        'runMonteCarloBtn', 'monteCarloRunsSelect', 'monte-carlo-results-container',
        'mc-graph-container-area', 'mc-graph-a-container', 'mc-chart-a', 'mc-graph-b-container', 'mc-chart-b'
    ];
    
    // Survival Rule IDs
    const suffixes = ['_a', '_b'];
    suffixes.forEach(s => {
        allElementIds.push(`survival_enable${s}`, `survival_trigger${s}`, `survival_expense${s}`);
    });

     allElementIds.forEach(id => {
         const element = document.getElementById(id);
         if (element) {
             elements[id.replace(/-/g, '_')] = element;
         }
     });
     elements.tabPanes = document.querySelectorAll('.tab-pane');
     elements.closeButton = document.querySelector('#income-modal .close-button');
     elements.closeButton_b = document.querySelector('#income-modal_b .close-button');
     elements.welcomeCloseButton = document.querySelector('#welcome-modal .close-button');
     elements.agreement_section = document.querySelector('#welcome-modal .agreement-section');
     elements.tab_nav = document.querySelector('.tab-nav');
     elements.graph_container = document.getElementById('graph-container');
     elements.results_chart = document.getElementById('results-chart');

    if (typeof initializeScenarioData === 'function') {
        initializeScenarioData('a');
        initializeScenarioData('b');
    }
    if (typeof initializeIncomeModal === 'function') {
        initializeIncomeModal('a');
        initializeIncomeModal('b');
    }
    if (typeof initializeResultsDisplay === 'function') {
        initializeResultsDisplay();
    }
    if (typeof initializeMonteCarloDisplay === 'function') {
        initializeMonteCarloDisplay();
    }

    elements.welcomeCloseButton?.addEventListener('click', handleWelcomeModalClose);
    elements.welcome_modal?.addEventListener('click', (event) => { if (event.target === elements.welcome_modal) { handleWelcomeModalClose(); } });
    elements.agree_btn?.addEventListener('click', handleWelcomeModalClose);
    elements.disclaimer_agree?.addEventListener('change', () => { if(elements.agree_btn) elements.agree_btn.disabled = !elements.disclaimer_agree.checked; });
    elements.theme_toggle?.addEventListener('change', toggleTheme);
    elements.tab_nav?.addEventListener('click', (e) => { if (e.target && e.target.classList.contains('tab-btn')) { switchTab(e.target.getAttribute('data-tab')); } });

    elements.save_scenario_btn?.addEventListener('click', () => {
        if (typeof handleSaveScenarioClick === 'function') handleSaveScenarioClick();
    });
    elements.load_scenario_btn?.addEventListener('click', () => {
        if (typeof handleLoadScenarioClick === 'function') handleLoadScenarioClick();
    });
    elements.scenario_file_input?.addEventListener('change', (event) => {
        if (typeof handleFileSelected === 'function') handleFileSelected(event);
    });

    loadTheme();
    setLanguage('en');
    if(elements.welcome_modal) elements.welcome_modal.classList.remove('hidden');

    // [NEW] Auto-Load saved data on init
    if (typeof window.loadFromLocalStorage === 'function') {
        window.loadFromLocalStorage();
    }
}

// --- Core UI Functions ---
function handleWelcomeModalClose() {
    if (!elements.disclaimer_agree || !elements.welcome_modal || !elements.agreement_section) return;
    if (elements.disclaimer_agree.checked) {
        elements.welcome_modal.classList.add('hidden');
    } else {
        elements.agreement_section.classList.remove('shake');
        void elements.agreement_section.offsetWidth;
        elements.agreement_section.classList.add('shake');
    }
};

function setLanguage(lang) {
    currentLanguage = 'en'; // Hardcoded to English
    document.querySelectorAll('[data-lang-key]').forEach(el => {
        const key = el.getAttribute('data-lang-key');
        const translation = translations['en'][key];
        if (translation !== undefined && translation !== null) {
            if (typeof translation === 'function') {
                // [FIX v14.0.1] Removed dead inner 'else if (typeof translation === "string")' block.
                // It was unreachable: the outer condition already confirms translation is a function,
                // so the inner check for 'string' could never be true simultaneously.
                // Function-type keys that need runtime args (simComplete, mcSubTitle, etc.)
                // are intentionally skipped here and rendered at call-site with actual values.
                if (key !== 'simComplete' && key !== 'futureValueDisplay' && key !== 'incomeItemLabel' && key !== 'mcSubTitle') {
                   el.textContent = translation({});
                }
            } else if (typeof translation === 'string') {
                if (key === 'resultsP1' || key === 'resultsP2') { el.innerHTML = translation; }
                else if (key === 'createdBy') { if (el.childNodes.length > 0) el.childNodes[0].nodeValue = translation; }
                else { el.textContent = translation; }
            }
        }
    });
    document.querySelectorAll('[data-lang-key-tooltip]').forEach(el => {
        const key = el.getAttribute('data-lang-key-tooltip');
        if (translations['en'] && translations['en'][key]) {
            el.setAttribute('data-tooltip', translations['en'][key]);
        }
    });

    if (typeof renderIncomeList === 'function') {
        renderIncomeList('a');
        renderIncomeList('b');
    }
    if (typeof getLastResultDetails === 'function' && getLastResultDetails() && typeof lastRunWasOptimization !== 'undefined' && !lastRunWasOptimization) {
        const lastResults = getLastResultDetails();
        if (typeof displayComparisonMetrics === 'function') displayComparisonMetrics(lastResults);
        if (typeof displaySeparatedDetailedTables === 'function') displaySeparatedDetailedTables(lastResults);
        if (elements.break_even_text_result) {
            const yrsA = lastResults?.resultsA?.length || 0;
            const yrsB = lastResults?.resultsB?.length || 0;
            elements.break_even_text_result.textContent = translations['en']?.simComplete(yrsA, yrsB) || `Simulation Complete (A: ${yrsA} years, B: ${yrsB} years)`;
        }
        if (typeof drawD3Chart === 'function' && elements.graph_container && !elements.graph_container.classList.contains('hidden')) {
             drawD3Chart(lastResults);
        }
    }
    if (typeof getLastMonteCarloResults === 'function' && getLastMonteCarloResults()) {
        const lastMCResults = getLastMonteCarloResults();
        if (typeof displayMonteCarloResults === 'function') {
            displayMonteCarloResults(lastMCResults.resultsA, lastMCResults.resultsB, lastMCResults.numRuns);
        }
        if (typeof drawMonteCarloChart === 'function' && elements.mc_graph_container_area && !elements.mc_graph_container_area.classList.contains('hidden')) {
            drawMonteCarloChart(lastMCResults.resultsA.timeSeries, 'a');
            drawMonteCarloChart(lastMCResults.resultsB.timeSeries, 'b');
        }
    }
};

function switchTab(tabName) {
    elements.tab_nav?.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    elements.tabPanes?.forEach(pane => pane.classList.remove('active'));
    elements.tab_nav?.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
    const targetPane = document.getElementById(`${tabName}-pane`);
    if (targetPane) targetPane.classList.add('active');
};

function toggleTheme() {
    if (!elements.theme_toggle) return;
    document.body.classList.toggle('dark-mode', elements.theme_toggle.checked);
    localStorage.setItem('theme', elements.theme_toggle.checked ? 'dark' : 'light');
    
    if (typeof getLastResultDetails === 'function' && getLastResultDetails() && typeof drawD3Chart === 'function' && elements.graph_container && !elements.graph_container.classList.contains('hidden')) {
        drawD3Chart(getLastResultDetails());
    }
    if (typeof getLastMonteCarloResults === 'function' && getLastMonteCarloResults() && typeof drawMonteCarloChart === 'function' && elements.mc_graph_container_area && !elements.mc_graph_container_area.classList.contains('hidden')) {
        drawMonteCarloChart(getLastMonteCarloResults().resultsA.timeSeries, 'a');
        drawMonteCarloChart(getLastMonteCarloResults().resultsB.timeSeries, 'b');
    }
}
function loadTheme() {
    const isDark = localStorage.getItem('theme') === 'dark';
    if (elements.theme_toggle) elements.theme_toggle.checked = isDark;
    if (isDark) { document.body.classList.add('dark-mode'); }
}

function formatCurrency(value) {
    if (typeof value !== 'number' || isNaN(value)) return '-';
    return `$${Math.round(value).toLocaleString()}`;
}

function formatYAxisLabel(value) {
    if (typeof value !== 'number' || isNaN(value)) return '$0';
    if (Math.abs(value) >= 1e9) { return '$' + (value / 1e9).toFixed(1) + 'B'; }
    else if (Math.abs(value) >= 1e6) { return '$' + (value / 1e6).toFixed(1) + 'M'; }
    else if (Math.abs(value) >= 1e3) { return '$' + (value / 1e3).toFixed(0) + 'k'; }
    else { return '$' + value.toFixed(0); }
}
