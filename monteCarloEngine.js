/**
 * @project     Canada-Malaysia Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     17.2.1 (Fix: Progress percentage double multiplication bug)
 * @file        monteCarloEngine.js
 * @description Monte Carlo engine overhauled for dynamic assets and Covered Call state-based simulation.
 */

// monteCarloEngine.js

async function runMonteCarloSimulation(inputs, settings, unusedStdevs, numRunsStr, progressCallback) {
    const allRunsData = [];
    const finalAssets = []; 
    const numRuns = parseInt(numRunsStr, 10) || 10000;

    const getSafeCola = (val) => (val !== undefined && val !== null && !isNaN(val)) ? Number(val) : 0.025;

    const baseSettings = {
        maxAge: settings.maxAge || 95,
        baseYear: 2025,
        exchangeRate: settings.exchangeRate || 25.0,
        cola: getSafeCola(settings.cola),
        survivalConfig: inputs.scenario.survivalConfig || {},
        manualCrashes: inputs.scenario.manualCrashes || [],
        vixCrashes: inputs.scenario.vixCrashes || []
    };

    const originalApplyGrowth = window.step1_ApplyGrowth;
    window.step1_ApplyGrowth = _applyRandomizedGrowth;

    try {
        for (let i = 0; i < numRuns; i++) {
            const runInputs = JSON.parse(JSON.stringify(inputs));
            const runSettings = JSON.parse(JSON.stringify(baseSettings)); // 상태 누수 방지 (State Leak Fix)
            runInputs.scenario.isMonteCarlo = true;
            runInputs.scenario.mcRunIndex = i;

            const result = simulateScenario(runInputs.scenario, runSettings, "A");
            
            if (result && Array.isArray(result) && result.length > 0) {
                allRunsData.push(result);
                const lastYear = result[result.length - 1];
                if (lastYear) {
                    finalAssets.push(lastYear.assetsSplit ? lastYear.assetsSplit.total : (lastYear.closingBalance || 0));
                }
            }
            if (i % 100 === 0 && progressCallback) {
                progressCallback(i / numRuns); 
                await new Promise(resolve => setTimeout(resolve, 0)); 
            }
        }
    } finally {
        window.step1_ApplyGrowth = originalApplyGrowth;
    }

    if (progressCallback) progressCallback(1.0);

    const validAssets = finalAssets.filter(a => !isNaN(a));
    const sortedAssets = validAssets.sort((a, b) => a - b);
    const successCount = sortedAssets.filter(a => a > 0).length;
    const successRate = successCount / numRuns; // UI에서 * 100 하므로 비율(0.99)만 전달

    const p10 = _getQuantile(sortedAssets, 0.10);
    const p50 = _getQuantile(sortedAssets, 0.50);
    const p90 = _getQuantile(sortedAssets, 0.90);

    const timeSeriesQuantiles = [];
    if (allRunsData.length > 0) {
        const maxYears = allRunsData[0].length;
        for (let y = 0; y < maxYears; y++) {
            const yearVals = [];
            for (let r = 0; r < allRunsData.length; r++) {
                if (allRunsData[r][y]) {
                    const yd = allRunsData[r][y];
                    yearVals.push(yd.assetsSplit ? yd.assetsSplit.total : (yd.closingBalance || 0));
                }
            }
            const validYearVals = yearVals.filter(a => !isNaN(a)).sort((a, b) => a - b);
            timeSeriesQuantiles.push({
                year: allRunsData[0][y].year,
                age: allRunsData[0][y].age,
                p10: _getQuantile(validYearVals, 0.10),
                p25: _getQuantile(validYearVals, 0.25), 
                p50: _getQuantile(validYearVals, 0.50),
                median: _getQuantile(validYearVals, 0.50),
                p75: _getQuantile(validYearVals, 0.75), 
                p90: _getQuantile(validYearVals, 0.90)
            });
        }
    }

    return {
        numRuns, 
        successRate, 
        p10, 
        p50, 
        median: p50, // UI의 데이터 바인딩 오류 수정 (Median -- 표기 해결)
        p90,
        timeSeries: timeSeriesQuantiles
    };
}

// --- MARKOV CHAIN + TWO-TRACK ENGINE ---
function _applyRandomizedGrowth(assets, settings, crashOverride = null, vixCrushOverride = false) {
    let totalGrowth = 0;
    let totalDiv = 0;
    let totalDivWht = 0;
    
    const rand = Math.random();
    let marketState = 0;
    let ccReturn = 0;
    let ccYieldMultiplier = 'base'; 
    
    // 0: Normal/Bull (60%), 1: Crash (5%), 2: L-shape (10%), 3: Drizzle (15%), 4: Bear (10%)
    if (rand < 0.60) {
        marketState = 0; 
        ccReturn = (Math.random() * 0.10) + 0.02; // 실무적 JEPQ NAV 성장 범위 (2~12%)
        ccYieldMultiplier = 'base';
    } else if (rand < 0.65) {
        marketState = 1; 
        ccReturn = -(Math.random() * 0.20 + 0.10); // -10% ~ -30%
        ccYieldMultiplier = 'max';
    } else if (rand < 0.75) {
        marketState = 2; 
        ccReturn = (Math.random() * 0.10) - 0.05; // -5% ~ +5%
        ccYieldMultiplier = 'min';
    } else if (rand < 0.90) {
        marketState = 3; 
        ccReturn = -(Math.random() * 0.08 + 0.02); // -2% ~ -10%
        ccYieldMultiplier = 'min';
    } else {
        marketState = 4; 
        ccReturn = -(Math.random() * 0.08 + 0.07); // -7% ~ -15%
        ccYieldMultiplier = 'scale';
    }

    const assetList = Array.isArray(assets) ? assets : Object.values(assets).filter(a => a && typeof a === 'object');
    
    assetList.forEach(asset => {
        if (asset.currentNav === undefined) asset.currentNav = 100.0;
        
        if (asset.type === 'covered_call') {
            let equityReturn = ccReturn;
            
            if (crashOverride !== null) {
                equityReturn = crashOverride;
                if (equityReturn <= -0.15) ccYieldMultiplier = 'max';
                else if (equityReturn < 0) ccYieldMultiplier = 'scale';
                else ccYieldMultiplier = 'base';
            }
            
            const equityGain = asset.equity * equityReturn;
            asset.equity += equityGain;
            totalGrowth += equityGain;
            asset.currentNav *= (1 + equityReturn);
            
            let currentYield = asset.initialDiv || 0.07;
            let maxYield = asset.maxYield || 0.15;
            let minYield = asset.minYield || 0.07;
            
            if (vixCrushOverride) {
                currentYield = minYield;
            } else if (ccYieldMultiplier === 'max') {
                currentYield = maxYield;
            } else if (ccYieldMultiplier === 'min') {
                currentYield = minYield;
            } else if (ccYieldMultiplier === 'scale') {
                const dropPct = Math.abs(equityReturn);
                const maxDrop = 0.15;
                const ratio = Math.min(dropPct / maxDrop, 1.0);
                currentYield = asset.initialDiv + (maxYield - asset.initialDiv) * ratio;
            }
            
            asset.currentDynamicYield = currentYield; 
            let grossDiv = asset.equity * currentYield;
            totalDiv += grossDiv; 
            totalDivWht += grossDiv * (asset.wht !== undefined ? asset.wht : 0.15);
            
        } else {
            const eqMean = (asset.growth !== undefined) ? asset.growth : 0.05;
            const eqStDev = (asset.stdev !== undefined) ? asset.stdev : 0.12;
            let equityReturn = 0;

            if (crashOverride !== null) {
                equityReturn = crashOverride;
            } else {
                let u = 0, v = 0;
                while(u === 0) u = Math.random();
                while(v === 0) v = Math.random();
                const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
                equityReturn = eqMean + z * eqStDev;
            }
            
            const equityGain = asset.equity * equityReturn;
            asset.equity += equityGain;
            totalGrowth += equityGain;
            asset.currentNav *= (1 + equityReturn);
            
            let appliedDivGrowth = (asset.divGrowth || 0);
            let cutRate = 0;

            if (equityReturn <= -0.30) {
                cutRate = Math.abs(equityReturn) / 2;
                appliedDivGrowth = 0;
            } else if (equityReturn <= -0.10) {
                appliedDivGrowth = 0;
            }

            if (asset.initialDiv > 0) {
                asset.initialDiv = asset.initialDiv * (1 - cutRate) * (1 + appliedDivGrowth);
            }
            asset.currentDynamicYield = asset.initialDiv;
            let grossDiv = asset.equity * asset.initialDiv;
            totalDiv += grossDiv;
            totalDivWht += grossDiv * (asset.wht !== undefined ? asset.wht : 0.15);
        }
    });

    return { gains: totalGrowth, totalDiv: totalDiv, totalDivWht: totalDivWht };
}

function _getQuantile(arr, q) {
    if (!arr || arr.length === 0) return 0;
    const pos = (arr.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (arr[base + 1] !== undefined) {
        return arr[base] + rest * (arr[base + 1] - arr[base]);
    } else {
        return arr[base];
    }
}