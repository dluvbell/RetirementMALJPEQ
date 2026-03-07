/**
 * @project     Canada-Malaysia Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     14.4.0 (Feature: Added Rebound (Green) indicators to Monte Carlo charts)
 * @file        uiMonteCarloDisplay.js
 * @created     2025-11-29
 * @description Handles Monte Carlo simulation UI. Visualizes crashes (red) and rebounds (green).
 */

// uiMonteCarloDisplay.js

let lastMonteCarloResults = null;
let lastMCNumRuns = 0;

function initializeMonteCarloDisplay() {
    elements.runMonteCarloBtn?.addEventListener('click', () => runAndDisplayMonteCarlo(true));
    clearMonteCarloCharts();
}

function getLastMonteCarloResults() {
    return { ...lastMonteCarloResults, numRuns: lastMCNumRuns };
}

async function runAndDisplayMonteCarlo(showLoader = true) {
    lastRunWasOptimization = false;
    if (typeof switchTab === 'function') switchTab('results');
    await new Promise(resolve => setTimeout(resolve, 50));

    // Clear all previous results
    if (typeof clearD3Chart === 'function') clearD3Chart();
    clearMonteCarloCharts();
    chartRendered = false;
    
    // Hide containers initially
    if(elements.graph_container) elements.graph_container.classList.add('hidden');
    if(elements.mc_graph_container_area) elements.mc_graph_container_area.classList.add('hidden');
    
    // Clear outputs
    if(elements.additional_metrics_container) elements.additional_metrics_container.innerHTML = '';
    if(elements.detailed_table_container_a) elements.detailed_table_container_a.innerHTML = '';
    if(elements.detailed_table_container_b) elements.detailed_table_container_b.innerHTML = '';
    if(elements.monte_carlo_results_container) elements.monte_carlo_results_container.innerHTML = '';
    if(elements.break_even_text_result) elements.break_even_text_result.textContent = '';
    
    lastResultDetails = null; lastOptimizationResults = null;

    const lang = translations[currentLanguage];
    const originalButtonText = lang.runMonteCarloBtn || "Run Monte Carlo";

    try {
        if (typeof gatherInputs !== 'function') throw new Error("gatherInputs function not available.");
        lastRunInputsA = gatherInputs('a');
        lastRunInputsB = gatherInputs('b');
        
        const baseYear = 2025;
        const globalSettingsA = { maxAge: lastRunInputsA.lifeExpectancy, cola: lastRunInputsA.cola, baseYear: baseYear, exchangeRate: lastRunInputsA.exchangeRate };
        const globalSettingsB = { maxAge: lastRunInputsB.lifeExpectancy, cola: lastRunInputsB.cola, baseYear: baseYear, exchangeRate: lastRunInputsB.exchangeRate };

        const numRuns = parseInt(elements.monteCarloRunsSelect?.value) || 10000;
        
        // [MODIFIED] No longer gathering global StDevs from UI. 
        // StDevs are now inside lastRunInputsA.scenario.user.assets (per account).
        
        if(elements.runAnalysisBtn) elements.runAnalysisBtn.disabled = true;
        if(elements.runMonteCarloBtn) elements.runMonteCarloBtn.disabled = true;
        if(elements.results_container) elements.results_container.classList.add('hidden');
        
        const progressCallbackA = (progress) => { if(elements.runMonteCarloBtn) elements.runMonteCarloBtn.textContent = `Running A... ${Math.floor(progress * 100)}%`; };
        // Pass null for 3rd arg (legacy stdevs object)
        const resultsA = await runMonteCarloSimulation(lastRunInputsA, globalSettingsA, null, numRuns, progressCallbackA);

        const progressCallbackB = (progress) => { if(elements.runMonteCarloBtn) elements.runMonteCarloBtn.textContent = `Running B... ${Math.floor(progress * 100)}%`; };
        const resultsB = await runMonteCarloSimulation(lastRunInputsB, globalSettingsB, null, numRuns, progressCallbackB);

        lastMonteCarloResults = { resultsA, resultsB };
        lastMCNumRuns = numRuns;
        
        displayMonteCarloResults(resultsA, resultsB, numRuns);
        
        // Render Order: Parent -> Child -> Chart
        if(elements.results_container) elements.results_container.classList.remove('hidden');
        if(elements.mc_graph_container_area) elements.mc_graph_container_area.classList.remove('hidden');
        
        drawMonteCarloChart(resultsA.timeSeries, 'a');
        drawMonteCarloChart(resultsB.timeSeries, 'b');

        if(elements.break_even_text_result) elements.break_even_text_result.textContent = "Monte Carlo Simulation Complete";

    } catch (error) {
        console.error("Monte Carlo Failed:", error);
        if(elements.break_even_text_result) elements.break_even_text_result.textContent = lang.errSimFailed + error.message;
        if(elements.results_container) elements.results_container.classList.remove('hidden');
    } finally {
        if(elements.runAnalysisBtn) elements.runAnalysisBtn.disabled = false;
        if(elements.runMonteCarloBtn) { elements.runMonteCarloBtn.disabled = false; elements.runMonteCarloBtn.textContent = originalButtonText; }
    }
}

function displayMonteCarloResults(resultsA, resultsB, numRuns) {
    if (!resultsA || !resultsB || !elements.monte_carlo_results_container) return;
    const lang = translations[currentLanguage];
    const formatPercent = (val) => `${(val * 100).toFixed(1)}%`;
    const descStyle = "font-size: 0.9em; font-weight: normal; color: var(--text-secondary);";

    const tableHTML = `
        <h3 data-lang-key="mcTitle">${lang.mcTitle}</h3>
        <p style="text-align: center; margin-top: -0.5rem; color: var(--text-secondary);" data-lang-key="mcSubTitle">${lang.mcSubTitle(numRuns)}</p>
        <table id="monte-carlo-results-table">
            <thead><tr><th>Metric</th><th>${lang.metricsScenarioA}</th><th>${lang.metricsScenarioB}</th></tr></thead>
            <tbody>
                <tr><td>${lang.mcSuccessRate}<br><span style="${descStyle}">(${lang.mcSuccessDesc})</span></td><td>${formatPercent(resultsA.successRate)}</td><td>${formatPercent(resultsB.successRate)}</td></tr>
                <tr><td>${lang.mcP10}<br><span style="${descStyle}">(${lang.mcP10Desc})</span></td><td>${formatCurrency(resultsA.p10)}</td><td>${formatCurrency(resultsB.p10)}</td></tr>
                <tr><td>${lang.mcMedian}<br><span style="${descStyle}">(${lang.mcMedianDesc})</span></td><td>${formatCurrency(resultsA.median)}</td><td>${formatCurrency(resultsB.median)}</td></tr>
                 <tr><td>${lang.mcP90}<br><span style="${descStyle}">(${lang.mcP90Desc})</span></td><td>${formatCurrency(resultsA.p90)}</td><td>${formatCurrency(resultsB.p90)}</td></tr>
            </tbody>
        </table>`;
    elements.monte_carlo_results_container.innerHTML = tableHTML;
}

function clearMonteCarloCharts() {
    if (elements.mc_chart_a) d3.select(elements.mc_chart_a).selectAll("*").remove();
    if (elements.mc_chart_b) d3.select(elements.mc_chart_b).selectAll("*").remove();
    d3.select('body').selectAll('.d3-tooltip-mc').remove();
    if (elements.mc_graph_container_area) elements.mc_graph_container_area.classList.add('hidden');
}

function drawMonteCarloChart(data, suffix) {
    const targetSvgElement = (suffix === 'a') ? elements.mc_chart_a : elements.mc_chart_b;
    if (typeof d3 === 'undefined' || !targetSvgElement || !data || data.length === 0) return;

    const svg = d3.select(targetSvgElement);
    svg.selectAll("*").remove();
    d3.select('body').selectAll(`.d3-tooltip-mc-${suffix}`).remove();

    const margin = {top: 20, right: 30, bottom: 40, left: 80};
    const width = +svg.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = +svg.node().getBoundingClientRect().height - margin.top - margin.bottom;
    
    if (width <= 0 || height <= 0) {
        console.error("MC Chart draw failed: Container has no dimensions.");
        return; 
    }

    svg.attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`);
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain(d3.extent(data, d => d.year)).range([0, width]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.p90) * 1.05]).range([height, 0]);

    g.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
    g.append("g").call(d3.axisLeft(y).tickFormat(d => "$" + d3.format("~s")(d)));

    const areaP10P90 = d3.area().x(d => x(d.year)).y0(d => y(d.p10)).y1(d => y(d.p90));
    const areaP25P75 = d3.area().x(d => x(d.year)).y0(d => y(d.p25)).y1(d => y(d.p75));
    const lineP50 = d3.line().x(d => x(d.year)).y(d => y(d.p50));

    g.append("path").datum(data).attr("class", `mc-area-p10-p90-${suffix}`).attr("d", areaP10P90);
    g.append("path").datum(data).attr("class", `mc-area-p25-p75-${suffix}`).attr("d", areaP25P75);
    g.append("path").datum(data).attr("fill", "none").attr("stroke-width", 2.5).attr("class", `line line-${suffix}`).attr("d", lineP50);

    // 🆕 Manual Crash/Rebound Indicators
    const crashes = (suffix === 'a') 
        ? (lastRunInputsA?.scenario?.manualCrashes || [])
        : (lastRunInputsB?.scenario?.manualCrashes || []);
    
    const birthYear = (suffix === 'a')
        ? (lastRunInputsA?.scenario?.user?.birthYear || 1980)
        : (lastRunInputsB?.scenario?.user?.birthYear || 1980);
    
    crashes.forEach(crash => {
        const crashYear = birthYear + crash.age;
        const isRebound = crash.drop < 0;
        const color = isRebound ? "var(--success-color)" : "var(--danger-color)";
        const labelText = isRebound ? `+${Math.abs(crash.drop)}%` : `-${crash.drop}%`;
        
        // Crash/Rebound vertical line
        g.append("line")
            .attr("class", "crash-indicator-line")
            .attr("x1", x(crashYear))
            .attr("x2", x(crashYear))
            .attr("y1", 0)
            .attr("y2", height)
            .attr("stroke", color)
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "5,5")
            .attr("opacity", 0.7);
        
        // Label
        g.append("text")
            .attr("x", x(crashYear))
            .attr("y", -5)
            .attr("text-anchor", "middle")
            .attr("font-size", "0.75em")
            .attr("fill", color)
            .text(labelText);
    });

    const tooltip = d3.select("body").append("div").attr("class", `d3-tooltip d3-tooltip-mc d3-tooltip-mc-${suffix}`).style("opacity", 0);
    const focus = g.append("g").style("display", "none");
    focus.append("line").attr("class", "focus-line").attr("y1", 0).attr("y2", height);

    g.append("rect").attr("class", "overlay").attr("width", width).attr("height", height).style("fill", "none").style("pointer-events", "all")
        .on("mouseover", () => { focus.style("display", null); tooltip.style("opacity", 1); })
        .on("mouseout", () => { focus.style("display", "none"); tooltip.style("opacity", 0); })
        .on("mousemove", (event) => {
            const bisectDate = d3.bisector(d => d.year).left;
            const x0 = x.invert(d3.pointer(event, g.node())[0]);
            const i = bisectDate(data, x0, 1);
            const d = (d0 = data[i - 1], d1 = data[i]) ? (x0 - d0.year > d1.year - x0 ? d1 : d0) : (d0 || d1);
            if (!d) return;
            focus.attr("transform", `translate(${x(d.year)},0)`);
            tooltip.html(`<strong>Year: ${d.year} (Age: ${d.age})</strong><div>Median (P50): ${formatCurrency(d.p50)}</div><div>Range (P10-P90): ${formatCurrency(d.p10)} - ${formatCurrency(d.p90)}</div>`)
                   .style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px");
        });
}