/**
 * @project     Canada-Malaysia Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     16.5.0 (Feature: Intuitive Column Order Reorganization)
 * @file        uiResultsDisplay.js
 * @description Renders results into tables and charts.
 */

// uiResultsDisplay.js

let _lastResultData = null;

function initializeResultsDisplay() {
    const runBtn = document.getElementById('runAnalysisBtn');
    if (runBtn) {
        runBtn.addEventListener('click', () => {
            const inputsA = gatherInputs('a');
            const inputsB = gatherInputs('b');
            
            document.getElementById('loading-indicator').classList.remove('hidden');
            document.getElementById('results-container').classList.add('hidden');

            setTimeout(() => {
                try {
                    const simResults = runFullSimulation(inputsA, inputsB);
                    _lastResultData = simResults;
                    
                    displayComparisonMetrics(simResults);
                    displaySeparatedDetailedTables(simResults);
                    drawD3Chart(simResults);
                    
                    document.getElementById('loading-indicator').classList.add('hidden');
                    document.getElementById('results-container').classList.remove('hidden');
                } catch(e) {
                    console.error(e);
                    document.getElementById('loading-indicator').classList.add('hidden');
                    alert("Error during simulation: " + e.message);
                }
            }, 100);
        });
    }

    const exportBtn = document.getElementById('export-csv-btn');
    if (exportBtn) {
        exportBtn.classList.remove('hidden');
        exportBtn.addEventListener('click', exportResultsToCSV);
    }
}

function getLastResultDetails() {
    return _lastResultData;
}

function displayComparisonMetrics(results) {
    const container = document.getElementById('additional-metrics-container');
    if (!container) return;

    const resA = results.resultsA;
    const resB = results.resultsB;
    
    const lastA = resA.length > 0 ? resA[resA.length - 1] : null;
    const lastB = resB.length > 0 ? resB[resB.length - 1] : null;

    const totalAssetsA = lastA ? lastA.assetsSplit.total : 0;
    const totalAssetsB = lastB ? lastB.assetsSplit.total : 0;

    let totalIncA = 0, totalIncB = 0;
    let totalTaxA = 0, totalTaxB = 0;

    resA.forEach(r => { totalIncA += r.income.total; totalTaxA += r.taxPayable; });
    resB.forEach(r => { totalIncB += r.income.total; totalTaxB += r.taxPayable; });

    container.innerHTML = `
        <h3 data-lang-key="metricsTitle">Key Metrics Summary</h3>
        <table class="metrics-table" style="width:100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
                <tr style="background-color: var(--table-header-bg);">
                    <th style="padding:8px; border:1px solid var(--border-color);">Metric</th>
                    <th style="padding:8px; border:1px solid var(--border-color);" data-lang-key="metricsScenarioA">Scenario A</th>
                    <th style="padding:8px; border:1px solid var(--border-color);" data-lang-key="metricsScenarioB">Scenario B</th>
                    <th style="padding:8px; border:1px solid var(--border-color);" data-lang-key="metricsDifference">Difference (B - A)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="padding:8px; border:1px solid var(--border-color);" data-lang-key="metricsFinalAssets">Final Total Assets</td>
                    <td style="padding:8px; border:1px solid var(--border-color);">${formatCurrency(totalAssetsA)}</td>
                    <td style="padding:8px; border:1px solid var(--border-color);">${formatCurrency(totalAssetsB)}</td>
                    <td style="padding:8px; border:1px solid var(--border-color); color: ${totalAssetsB - totalAssetsA >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}">${formatCurrency(totalAssetsB - totalAssetsA)}</td>
                </tr>
                <tr>
                    <td style="padding:8px; border:1px solid var(--border-color);" data-lang-key="metricsTotalIncomeGross">Total Income (Gross)</td>
                    <td style="padding:8px; border:1px solid var(--border-color);">${formatCurrency(totalIncA)}</td>
                    <td style="padding:8px; border:1px solid var(--border-color);">${formatCurrency(totalIncB)}</td>
                    <td style="padding:8px; border:1px solid var(--border-color);">${formatCurrency(totalIncB - totalIncA)}</td>
                </tr>
                <tr>
                    <td style="padding:8px; border:1px solid var(--border-color);" data-lang-key="metricsTotalTaxesPaid">Total Taxes Paid</td>
                    <td style="padding:8px; border:1px solid var(--border-color);">${formatCurrency(totalTaxA)}</td>
                    <td style="padding:8px; border:1px solid var(--border-color);">${formatCurrency(totalTaxB)}</td>
                    <td style="padding:8px; border:1px solid var(--border-color);">${formatCurrency(totalTaxB - totalTaxA)}</td>
                </tr>
            </tbody>
        </table>
    `;
}

function displaySeparatedDetailedTables(results) {
    _renderTable(results.resultsA, 'detailed-table-container-a', 'Scenario A');
    _renderTable(results.resultsB, 'detailed-table-container-b', 'Scenario B');

    const toggleA = document.getElementById('toggle-details-a-btn');
    const toggleB = document.getElementById('toggle-details-b-btn');
    const tableA = document.getElementById('detailed-table-container-a');
    const tableB = document.getElementById('detailed-table-container-b');

    if(toggleA && tableA) {
        toggleA.classList.remove('hidden');
        tableA.classList.remove('hidden');
        toggleA.onclick = () => tableA.classList.toggle('hidden');
    }
    if(toggleB && tableB) {
        toggleB.classList.remove('hidden');
        tableB.classList.remove('hidden');
        toggleB.onclick = () => tableB.classList.toggle('hidden');
    }
}

function _renderTable(data, containerId, title) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!data || data.length === 0) {
        container.innerHTML = `<h4>${title} - No Data</h4>`;
        return;
    }

    let html = `<h4>${title} Details</h4>`;
    html += `<div style="overflow-x: auto;">
             <table class="results-table" style="width: 100%; border-collapse: collapse; text-align: right; font-size: 0.85em;">
             <thead>
                <tr style="background-color: var(--table-header-bg);">
                    <th style="padding: 6px; border: 1px solid var(--border-color); text-align: center;">Age</th>
                    <th style="padding: 6px; border: 1px solid var(--border-color); text-align: center;">Mode</th>
                    <th style="padding: 6px; border: 1px solid var(--border-color);">Total Assets</th>
                    <th style="padding: 6px; border: 1px solid var(--border-color);">Dividends</th>
                    <th style="padding: 6px; border: 1px solid var(--border-color);">Pension</th>
                    <th style="padding: 6px; border: 1px solid var(--border-color);">Other Inc</th>
                    <th style="padding: 6px; border: 1px solid var(--border-color);">Inc: Total</th>
                    <th style="padding: 6px; border: 1px solid var(--border-color);">Expenses</th>
                    <th style="padding: 6px; border: 1px solid var(--border-color);">Taxes</th>
                    <th style="padding: 6px; border: 1px solid var(--border-color);">Reinvested</th>
                    <th style="padding: 6px; border: 1px solid var(--border-color);">WD: Total</th>
                </tr>
             </thead>
             <tbody>`;

    data.forEach(r => {
        let modeDisplay = r.strategyState || "Normal";
        let modeStyle = "";
        if (modeDisplay.includes("Crash") || modeDisplay.includes("Tightened")) modeStyle = "color: var(--danger-color); font-weight: bold;";
        else if (modeDisplay.includes("Rebound")) modeStyle = "color: var(--success-color); font-weight: bold;";
        else if (modeDisplay.includes("VIX")) modeStyle = "color: var(--secondary-color); font-weight: bold;";

        html += `
            <tr>
                <td style="padding: 6px; border: 1px solid var(--border-color); text-align: center;">${r.userAge}</td>
                <td style="padding: 6px; border: 1px solid var(--border-color); text-align: center; ${modeStyle}">${modeDisplay}</td>
                <td style="padding: 6px; border: 1px solid var(--border-color); font-weight: bold;">${formatCurrency(r.assetsSplit.total)}</td>
                <td style="padding: 6px; border: 1px solid var(--border-color); color: var(--success-color);">${formatCurrency(r.dividends.total)}</td>
                <td style="padding: 6px; border: 1px solid var(--border-color);">${formatCurrency(r.income.pension)}</td>
                <td style="padding: 6px; border: 1px solid var(--border-color);">${formatCurrency(r.income.other)}</td>
                <td style="padding: 6px; border: 1px solid var(--border-color); font-weight: bold;">${formatCurrency(r.income.total)}</td>
                <td style="padding: 6px; border: 1px solid var(--border-color); color: var(--danger-color);">${formatCurrency(r.expenses)}</td>
                <td style="padding: 6px; border: 1px solid var(--border-color); color: #dc3545;">${formatCurrency(r.taxPayable)}</td>
                <td style="padding: 6px; border: 1px solid var(--border-color); color: var(--success-color); font-weight: bold;">${formatCurrency(r.reinvested)}</td>
                <td style="padding: 6px; border: 1px solid var(--border-color); color: #dc3545;">${formatCurrency(r.withdrawals.total)}</td>
            </tr>`;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

function exportResultsToCSV() {
    if (!_lastResultData) return;
    
    let csv = "--- SIMULATION RESULTS ---\n";
    
    // Updated intuitive column layout
    const cols = [
        "Age", "Mode", "Total Assets", "Eq (Stock)", "CC (Covered Call)", 
        "Total Dividends", "Pension", "Other Inc", "Total Income", 
        "Total Expenses", "Total Taxes", "Reinvested", "WD: Total"
    ];

    const generateHeader = (prefix) => cols.map(c => c + "_" + prefix).join(",");
    
    csv += generateHeader("A") + "," + generateHeader("B") + "\n";

    const maxLen = Math.max(_lastResultData.resultsA.length, _lastResultData.resultsB.length);

    for (let i = 0; i < maxLen; i++) {
        const getRowData = (dataArray) => {
            if (i < dataArray.length) {
                const r = dataArray[i];
                return [
                    r.userAge,
                    r.strategyState || "Normal",
                    Math.round(r.assetsSplit.total),
                    Math.round(r.assetsSplit.standard_equity),
                    Math.round(r.assetsSplit.covered_call),
                    Math.round(r.dividends.total),
                    Math.round(r.income.pension),
                    Math.round(r.income.other),
                    Math.round(r.income.total),
                    Math.round(r.expenses),
                    Math.round(r.taxPayable),
                    Math.round(r.reinvested),
                    Math.round(r.withdrawals.total)
                ];
            } else {
                return Array(cols.length).fill("");
            }
        };

        const dataA = getRowData(_lastResultData.resultsA);
        const dataB = getRowData(_lastResultData.resultsB);

        csv += dataA.join(",") + "," + dataB.join(",") + "\n";
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'malaysia_retirement_simulation_v16_5.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function drawD3Chart(results) {
    const container = document.getElementById('graph-container');
    const svgEl = document.getElementById('results-chart');
    if (!container || !svgEl) return;
    
    container.classList.remove('hidden');
    d3.select(svgEl).selectAll("*").remove();

    const dataA = results.resultsA;
    const dataB = results.resultsB;
    if(dataA.length === 0 && dataB.length === 0) return;

    const margin = {top: 20, right: 30, bottom: 40, left: 60};
    const width = container.clientWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select(svgEl)
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const allData = [...dataA, ...dataB];
    const x = d3.scaleLinear()
        .domain(d3.extent(allData, d => d.userAge))
        .range([0, width]);
        
    const y = d3.scaleLinear()
        .domain([0, d3.max(allData, d => d.assetsSplit.total) * 1.1])
        .range([height, 0]);

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    svg.append("g")
        .call(d3.axisLeft(y).tickFormat(d => "$" + d3.format(".2s")(d)));

    const line = d3.line()
        .x(d => x(d.userAge))
        .y(d => y(d.assetsSplit.total))
        .curve(d3.curveMonotoneX);

    if (dataA.length > 0) {
        svg.append("path")
            .datum(dataA)
            .attr("fill", "none")
            .attr("stroke", "#3b82f6")
            .attr("stroke-width", 2)
            .attr("d", line);
    }
    if (dataB.length > 0) {
        svg.append("path")
            .datum(dataB)
            .attr("fill", "none")
            .attr("stroke", "#ef4444")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "5,5")
            .attr("d", line);
    }

    const legend = svg.append("g")
        .attr("transform", `translate(${width - 120}, 10)`);
        
    legend.append("rect").attr("x", 0).attr("y", 0).attr("width", 15).attr("height", 2).attr("fill", "#3b82f6");
    legend.append("text").attr("x", 20).attr("y", 5).text("Scenario A").style("font-size", "12px").attr("alignment-baseline","middle");
    
    legend.append("rect").attr("x", 0).attr("y", 20).attr("width", 15).attr("height", 2).attr("fill", "#ef4444");
    legend.append("text").attr("x", 20).attr("y", 25).text("Scenario B").style("font-size", "12px").attr("alignment-baseline","middle");
}
