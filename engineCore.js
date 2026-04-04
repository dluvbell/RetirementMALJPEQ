/**
 * @project     Canada-Malaysia Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     18.8.3 (Fix: exchangeRate default corrected from 25.0 (THB) to 3.1 (MYR))
 * @file        engineCore.js
 * @description Core simulation loop. Integrated Two-Track engine and Total Asset MDD-based survival trigger.
 */

// engineCore.js

function runFullSimulation(inputsA, inputsB) {
    const baseYear = 2025;

    const getSafeCola = (val) => (val !== undefined && val !== null && !isNaN(val)) ? Number(val) : 0.025;
    
    const getStrategySettings = (inputs) => ({
        survivalConfig: inputs.scenario.survivalConfig || {},
        survivalTiers: inputs.scenario.survivalTiers || [],
        manualCrashes: inputs.scenario.manualCrashes || [],
        vixCrashes: inputs.scenario.vixCrashes || []
    });

    const globalSettingsA = {
        maxAge: Number(inputsA.lifeExpectancy) || 95,
        cola: getSafeCola(inputsA.cola),
        baseYear: baseYear,
        exchangeRate: Number(inputsA.exchangeRate) || 3.1, // [FIX v18.8.3] CAD/MYR default (was 25.0 THB)
        ...getStrategySettings(inputsA)
    };
    const resultsA = simulateScenario(inputsA.scenario, globalSettingsA, "A");

    const globalSettingsB = {
        maxAge: Number(inputsB.lifeExpectancy) || 95,
        cola: getSafeCola(inputsB.cola),
        baseYear: baseYear,
        exchangeRate: Number(inputsB.exchangeRate) || 3.1, // [FIX v18.8.3] CAD/MYR default (was 25.0 THB)
        ...getStrategySettings(inputsB)
    };
    const resultsB = simulateScenario(inputsB.scenario, globalSettingsB, "B");

    return { resultsA, resultsB };
}

function simulateScenario(scenario, settings, label = "") {
    const results = [];
    const hasSpouse = (scenario.spouse && scenario.spouse.hasSpouse === true);

    // 1. Initialize Portfolio Assets (Dynamic Array)
    let currentUserAssets = Array.isArray(scenario.user?.assets) ? JSON.parse(JSON.stringify(scenario.user.assets)) : [];
    let currentSpouseAssets = Array.isArray(scenario.spouse?.assets) ? JSON.parse(JSON.stringify(scenario.spouse.assets)) : [];
    
    currentUserAssets.forEach(a => { a.equity = a.balance || 0; a.currentNav = 100.0; a.maxNav = 100.0; });
    currentSpouseAssets.forEach(a => { a.equity = a.balance || 0; a.currentNav = 100.0; a.maxNav = 100.0; });

    let prevYearThaiTax_User = 0;
    let prevYearThaiTax_Spouse = 0;

    const userRetirementAge = Number(scenario.retirementAge) || 60;
    const maxAge = Number(settings.maxAge) || 95;
    const userBirthYear = Number(scenario.user?.birthYear) || 1980;
    const spouseBirthYear = hasSpouse ? (Number(scenario.spouse?.birthYear) || userBirthYear) : userBirthYear;

    const startYear = userBirthYear + userRetirementAge;
    const endYear = userBirthYear + maxAge;

    for (let currentYear = startYear; currentYear <= endYear; currentYear++) {
        const userAge = currentYear - userBirthYear;
        if (userAge > maxAge) break;

        const yearData = {
            year: currentYear, 
            userAge: userAge,
            user: {
                age: userAge,
                openingBalance: _flattenAssets(currentUserAssets), 
                income: { pension: 0, other_taxable: 0, other_non_remitted: 0 },
                tax: { total: 0, can: 0, thai: 0 },
                withdrawals: { total: 0, thai_taxable_remittance: 0, wht_deducted: 0 }
            },
            spouse: {
                age: currentYear - spouseBirthYear,
                openingBalance: _flattenAssets(currentSpouseAssets),
                income: { pension: 0, other_taxable: 0, other_non_remitted: 0 },
                tax: { total: 0, can: 0, thai: 0 },
                withdrawals: { total: 0, thai_taxable_remittance: 0, wht_deducted: 0 }
            },
            expenses: 0, expenses_thai: 0, expenses_overseas: 0,
            expenses_thai_tax: prevYearThaiTax_User + prevYearThaiTax_Spouse,
            growth: 0,
            dividends: { total: 0, user: 0, spouse: 0, totalWht: 0, userWht: 0, spouseWht: 0 },
            income: { total: 0, pension: 0, other: 0 },
            withdrawals: { total: 0 },
            taxPayable: 0, taxPayable_can: 0, taxPayable_thai: 0,
            closingBalance: 0,
            reinvested: 0,
            isCrashYear: false,
            isVixCrushYear: false,
            isSurvivalTightened: false,
            strategyState: "Normal",
            assetsSplit: { total: 0, standard_equity: 0, covered_call: 0 }
        };

        // --- 1. Apply Growth (Portfolio) ---
        let crashOverride = null;
        let vixCrushOverride = false;

        if (settings.vixCrashes) {
            if (settings.vixCrashes.some(c => c.age === userAge)) {
                vixCrushOverride = true;
                yearData.isVixCrushYear = true;
                yearData.strategyState = "⏸️ VIX Crush";
            }
        }

        if (settings.manualCrashes) {
            const crash = settings.manualCrashes.find(c => c.age === userAge);
            if (crash) {
                crashOverride = -(crash.drop) / 100;
                if (crash.drop > 0) {
                    yearData.isCrashYear = true;
                    yearData.strategyState = "📉 Crash"; 
                } else {
                    yearData.isCrashYear = false;
                    yearData.strategyState = "📈 Rebound";
                }
            }
        }

        const userGrowthResult = step1_ApplyGrowth(currentUserAssets, settings, crashOverride, vixCrushOverride);
        const spouseGrowthResult = step1_ApplyGrowth(currentSpouseAssets, settings, crashOverride, vixCrushOverride);

        yearData.dividends.user = userGrowthResult.totalDiv;
        yearData.dividends.spouse = spouseGrowthResult.totalDiv;
        yearData.dividends.total = userGrowthResult.totalDiv + spouseGrowthResult.totalDiv;
        
        yearData.dividends.userWht = userGrowthResult.totalDivWht;
        yearData.dividends.spouseWht = spouseGrowthResult.totalDivWht;
        yearData.dividends.totalWht = userGrowthResult.totalDivWht + spouseGrowthResult.totalDivWht;

        yearData.growth = userGrowthResult.gains + spouseGrowthResult.gains;
        yearData.user.growth = userGrowthResult.gains; 
        yearData.spouse.growth = spouseGrowthResult.gains;

        // --- 2. Calculate Income ---
        if (typeof step2_CalculateIncome === 'function') {
            step2_CalculateIncome(yearData.user, scenario.user, settings, 'user', currentYear, scenario); 
            if (hasSpouse) {
                step2_CalculateIncome(yearData.spouse, scenario.user, settings, 'spouse', currentYear, scenario);
            }
        }
        
        yearData.income.dividends = yearData.dividends.total;
        yearData.income.pension = (yearData.user.income?.pension || 0) + (yearData.spouse.income?.pension || 0);
        yearData.income.other = (yearData.user.income?.other_taxable || 0) + (yearData.user.income?.other_non_remitted || 0) + 
                                (yearData.spouse.income?.other_taxable || 0) + (yearData.spouse.income?.other_non_remitted || 0);
        yearData.income.total = (yearData.user.income?.total || 0) + 
                                (yearData.spouse.income?.total || 0) + 
                                (yearData.dividends.total || 0);

        // --- 3. Calculate Expenses (Includes Survival Tightening Rule) ---
        step3_CalculateExpenses(yearData, scenario, settings, hasSpouse, spouseBirthYear, currentUserAssets, currentSpouseAssets);
        yearData.expenses = (yearData.expenses || 0) + (yearData.expenses_thai_tax || 0);

        // --- 4. Calculate Taxes FIRST (Accurate Deduction Pipeline) ---
        let userTaxInfo = { totalTax: 0, tax_can: 0, tax_thai: 0 };
        if (typeof step5_CalculateTaxes === 'function') {
            userTaxInfo = step5_CalculateTaxes(yearData.user, scenario, settings, 'user');
        }
        yearData.user.tax = userTaxInfo;
        
        let spouseTaxInfo = { totalTax: 0, tax_can: 0, tax_thai: 0 };
        if (hasSpouse && typeof step5_CalculateTaxes === 'function') {
            spouseTaxInfo = step5_CalculateTaxes(yearData.spouse, scenario, settings, 'spouse');
            yearData.spouse.tax = spouseTaxInfo;
        }

        yearData.taxPayable = userTaxInfo.totalTax + spouseTaxInfo.totalTax + yearData.dividends.totalWht;
        yearData.taxPayable_can = userTaxInfo.tax_can + spouseTaxInfo.tax_can + yearData.dividends.totalWht;
        yearData.taxPayable_thai = userTaxInfo.tax_thai + spouseTaxInfo.tax_thai;

        // --- 5. Perform Withdrawals (Sell accurate Shortfall) ---
        let wdInfo = { depleted: false, total: 0 };
        if (typeof step4_PerformWithdrawals === 'function') {
            wdInfo = step4_PerformWithdrawals(yearData, currentUserAssets, currentSpouseAssets, hasSpouse, settings);
        }
        
        yearData.withdrawals.total = wdInfo.withdrawals ? wdInfo.withdrawals.total : (yearData.withdrawals.total || 0);

        // ✅ Reinvest Logic (1st Priority Dynamic Asset)
        const totalCashOut = yearData.expenses + yearData.taxPayable; 
        const totalCashIn = yearData.income.total + yearData.withdrawals.total;
        const netCashflow = totalCashIn - totalCashOut;

        if (netCashflow > 0.01) {
            if (currentUserAssets.length > 0) {
                currentUserAssets[0].equity += netCashflow;
            } else if (hasSpouse && currentSpouseAssets.length > 0) {
                currentSpouseAssets[0].equity += netCashflow;
            }
            yearData.reinvested = netCashflow;
        } else {
            yearData.reinvested = 0;
        }

        // Final Balance Update
        yearData.user.closingBalance = _flattenAssets(currentUserAssets);
        yearData.spouse.closingBalance = _flattenAssets(currentSpouseAssets);
        yearData.closingBalance = yearData.user.closingBalance + yearData.spouse.closingBalance;

        // Split Asset Data for UI
        yearData.assetsSplit.standard_equity = _getAssetTypeTotal(currentUserAssets, 'equity') + _getAssetTypeTotal(currentSpouseAssets, 'equity');
        yearData.assetsSplit.covered_call = _getAssetTypeTotal(currentUserAssets, 'covered_call') + _getAssetTypeTotal(currentSpouseAssets, 'covered_call');
        yearData.assetsSplit.total = yearData.assetsSplit.standard_equity + yearData.assetsSplit.covered_call;

        results.push(yearData);

        prevYearThaiTax_User = yearData.user.tax.tax_thai;
        prevYearThaiTax_Spouse = spouseTaxInfo.tax_thai;
    }
    return results;
}

// Helper: Flatten dynamic asset array
function _flattenAssets(assetsArr) {
    if (!Array.isArray(assetsArr)) return 0;
    return assetsArr.reduce((sum, a) => sum + (a.equity || 0), 0);
}

// Helper: Get specific asset type total
function _getAssetTypeTotal(assetsArr, targetType) {
    if (!Array.isArray(assetsArr)) return 0;
    return assetsArr.filter(a => a.type === targetType).reduce((sum, a) => sum + (a.equity || 0), 0);
}


// --- TWO-TRACK ENGINE FOR DETERMINISTIC RUNS ---
function step1_ApplyGrowth(currentAssets, settings, crashOverride = null, vixCrushOverride = false) {
    let totalGrowth = 0;
    let totalDiv = 0;
    let totalDivWht = 0;

    if (!Array.isArray(currentAssets)) return { gains: 0, totalDiv: 0, totalDivWht: 0 };

    currentAssets.forEach((asset) => {
        let equityReturn = (crashOverride !== null) ? crashOverride : (asset.growth !== undefined ? asset.growth : 0.05);
        
        if (asset.type === 'covered_call') {
            let ccYieldMultiplier = 'base';
            if (crashOverride !== null) {
                if (equityReturn <= -0.15) ccYieldMultiplier = 'max';
                else if (equityReturn < 0) ccYieldMultiplier = 'scale';
            }

            const equityGain = asset.equity * equityReturn;
            asset.equity += equityGain;
            totalGrowth += equityGain;

            if (asset.currentNav !== undefined) {
                asset.currentNav *= (1 + equityReturn);
                if (asset.maxNav === undefined) asset.maxNav = 100.0;
                asset.maxNav = Math.max(asset.maxNav, asset.currentNav);
            }

            let currentYield = asset.initialDiv || 0.07;
            let maxYield = asset.maxYield || 0.15;
            let minYield = asset.minYield || 0.07; 

            if (vixCrushOverride) {
                currentYield = minYield;
            } else if (ccYieldMultiplier === 'max') {
                currentYield = maxYield;
            } else if (ccYieldMultiplier === 'scale') {
                const dropPct = Math.abs(equityReturn);
                const ratio = Math.min(dropPct / 0.15, 1.0);
                currentYield = asset.initialDiv + (maxYield - asset.initialDiv) * ratio;
            }

            asset.currentDynamicYield = currentYield;
            let grossDiv = asset.equity * currentYield;
            totalDiv += grossDiv;
            totalDivWht += grossDiv * (asset.wht !== undefined ? asset.wht : 0.15);

        } else {
            const equityGain = asset.equity * equityReturn;
            asset.equity += equityGain;
            totalGrowth += equityGain;

            if (asset.currentNav !== undefined) {
                asset.currentNav *= (1 + equityReturn);
                if (asset.maxNav === undefined) asset.maxNav = 100.0;
                asset.maxNav = Math.max(asset.maxNav, asset.currentNav);
            }

            let appliedDivGrowth = (asset.divGrowth || 0);
            let cutRate = 0;

            if (equityReturn <= -0.30) {
                 cutRate = Math.abs(equityReturn) / 2;
                 appliedDivGrowth = 0; 
            } else if (equityReturn <= -0.10) {
                 appliedDivGrowth = 0;
            }

            let currentYield = asset.initialDiv || 0;
            currentYield = currentYield * (1 - cutRate) * (1 + appliedDivGrowth);
            asset.initialDiv = currentYield;

            asset.currentDynamicYield = currentYield;
            let grossDiv = asset.equity * currentYield;
            totalDiv += grossDiv;
            totalDivWht += grossDiv * (asset.wht !== undefined ? asset.wht : 0.15);
        }
    });

    return { gains: totalGrowth, totalDiv: totalDiv, totalDivWht: totalDivWht };
}

function step3_CalculateExpenses(yearData, scenario, settings, hasSpouse, spouseBirthYear, currentUserAssets, currentSpouseAssets) {
    const currentYear = yearData.year; 
    const baseYear = settings.baseYear || 2025;
    const currentUserAge = Number(yearData.userAge);
    
    const allItems = scenario.user?.otherIncomes || [];
    let baseLivingExpenses = 0;
    let specialExpenses = 0;
    let overseasExpenses = 0;

    for (const item of allItems) {
         if (item.type !== 'expense_malaysia' && item.type !== 'expense_thai' && item.type !== 'expense_overseas' && item.type !== 'expense_living' && item.type !== 'expense_special') continue;
         const startAge = Number(item.startAge) || 0;
         const endAge = (Number(item.endAge) > 0) ? Number(item.endAge) : 110;
         const amount = Number(item.amount) || 0;
         const cola = Number(item.cola) || 0;

         let isActive = false;
         if (item.owner === 'spouse' && hasSpouse) {
             const currentSpouseAge = currentYear - Number(spouseBirthYear);
             if (currentSpouseAge >= startAge && currentSpouseAge <= endAge) isActive = true;
         } else {
             if (currentUserAge >= startAge && currentUserAge <= endAge) isActive = true;
         }

         if (isActive) {
             const yearsSinceBase = Math.max(0, currentYear - baseYear);
             const inflatedAmount = amount * Math.pow(1 + cola, yearsSinceBase);
             
             if (item.type === 'expense_overseas') {
                 overseasExpenses += inflatedAmount;
             } else if (item.type === 'expense_special') {
                 specialExpenses += inflatedAmount;
             } else {
                 baseLivingExpenses += inflatedAmount;
             }
         }
    }
    
    yearData.expenses = baseLivingExpenses + specialExpenses + overseasExpenses;

    // --- 🚨 SURVIVAL TIGHTENING RULE (Unlimited Tiers by Total Asset Max Drawdown %) ---
    const cw = settings.survivalConfig || {};
    const tiers = settings.survivalTiers || [];
    
    if (cw.survival_enable && tiers.length > 0) {
        let currentTotalAssets = 0;
        const allAssets = (currentUserAssets || []).concat(currentSpouseAssets || []);
        
        for (const a of allAssets) {
            currentTotalAssets += (a.equity || 0);
        }

        const openingTotal = (yearData.user?.openingBalance || 0) + (yearData.spouse?.openingBalance || 0);
        const peakToConsider = Math.max(openingTotal, currentTotalAssets);

        if (settings.maxTotalAssets === undefined) {
            settings.maxTotalAssets = peakToConsider;
        } else if (peakToConsider > settings.maxTotalAssets) {
            settings.maxTotalAssets = peakToConsider;
        }

        let maxDrawdown = 0;
        if (settings.maxTotalAssets > 0) {
            let rawDrawdown = ((settings.maxTotalAssets - currentTotalAssets) / settings.maxTotalAssets) * 100;
            maxDrawdown = Math.round(rawDrawdown * 100) / 100;
        }
        
        if (maxDrawdown > 0) {
            // 정렬: 하락률(Trigger)이 가장 높은 것(예: 30% -> 20% -> 10%)부터 순서대로 검사
            const sortedTiers = [...tiers].sort((a, b) => b.trigger - a.trigger);
            let appliedTier = null;
            
            for (const t of sortedTiers) {
                if (maxDrawdown >= t.trigger) {
                    appliedTier = t;
                    break;
                }
            }

            if (appliedTier) {
                const yearsSinceBase = Math.max(0, currentYear - baseYear);
                const inflatedTightened = appliedTier.expense * Math.pow(1 + (settings.cola || 0.025), yearsSinceBase);
                yearData.expenses = inflatedTightened + specialExpenses + overseasExpenses;
                yearData.isSurvivalTightened = true; 
                yearData.strategyState = `🚨 Tightened (Drop>=${appliedTier.trigger}%)`;
            }
        }
    }
}
