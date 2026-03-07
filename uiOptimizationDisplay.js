/**
 * @project     Canada-Thailand Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     6.0.0 (Disabled)
 * @file        uiOptimizationDisplay.js
 * @created     2025-11-09
 * @description Placeholder file. Optimization is not applicable in this single-user non-resident version.
 */

// uiOptimizationDisplay.js

async function runAndDisplayOptimization(showLoader = true) {
    console.warn("Optimization is NOT available in this Non-Resident version.");
    alert("Feature not available: Optimization is only for Canadian resident couple scenarios.");
    // Ensure UI doesn't get stuck in loading state if accidentally called
    if (elements && elements.optimizer_loading_indicator) {
        elements.optimizer_loading_indicator.classList.add('hidden');
    }
}

// --- DUMMY FUNCTIONS (To prevent ReferenceErrors if called) ---

function displayOptimizationSummaryTable(optimizationResults) {
    // No-op
}

function displayOptimizationDetailedTable(optimizationResults) {
    // No-op
}

function drawOptimizationD3Chart(optimizationResults) {
    // No-op
}

function exportOptimizationToCsv(optimizationResults, inputsA, inputsB) {
     console.warn("Export Optimization N/A");
}