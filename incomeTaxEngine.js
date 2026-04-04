/**
 * @project     Canada-Malaysia Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     11.0.4 (Fix: Removed dead 'thai_taxable_remittance' reference; fixed arguments[3] to use ownerType directly)
 * @file        incomeTaxEngine.js
 * @created     2025-11-25
 * @description Calculates income and taxes. WHT updated to 15% (Canada-Malaysia Treaty Article 18).
 */

// incomeTaxEngine.js

/**
 * Step 2: Calculate Non-Withdrawal Income (Gross) for a specific person
 * @param {Object} yearDataRef - The specific user/spouse year object to populate
 * @param {Object} personParams - The static params for this person
 * @param {Object} settings - Global settings
 * @param {String} ownerType - 'user' or 'spouse'
 * @param {Number} currentYear - Current simulation year
 * @param {Object} fullScenario - The full scenario object
 */
function step2_CalculateIncome(yearDataRef, personParams, settings, ownerType, currentYear, fullScenario) {
    let actualParams = personParams;
    // Safety fallback to ensure params exist
    if (ownerType === 'spouse' && fullScenario.spouse) {
        actualParams = fullScenario.spouse;
    } else if (ownerType === 'user') {
        actualParams = fullScenario.user;
    }

    const userAge = yearDataRef.age;
    const baseYear = settings.baseYear || 2025;

    // Initialize income buckets
    yearDataRef.income = { pension: 0, other_taxable: 0, other_non_remitted: 0 };

    // --- 1. Other Incomes (Attribution Logic) ---
    const allItems = fullScenario.user?.otherIncomes || [];

    allItems.forEach(item => {
        let shareFactor = 0;
        if (item.owner === ownerType) {
            shareFactor = 1.0;
        } else if (item.owner === 'joint') {
            shareFactor = 0.5;
        } else if (!item.owner && ownerType === 'user') {
            shareFactor = 1.0; 
        }

        // Check age range
        // Safe conversion to numbers handled in engineCore, but double check here doesn't hurt
        const start = Number(item.startAge) || 0;
        const end = (Number(item.endAge) > 0) ? Number(item.endAge) : 110;

        if (shareFactor > 0 && userAge >= start && userAge <= end) {
            const itemYearsSinceBase = Math.max(0, currentYear - baseYear);
            const currentYearAmount = (Number(item.amount) || 0) * Math.pow(1 + (Number(item.cola) || 0), itemYearsSinceBase);
            const myShare = currentYearAmount * shareFactor;

            if (item.type === 'pension') {
                yearDataRef.income.pension += myShare;
            } else if (item.type === 'income') {
                yearDataRef.income.other_taxable += myShare;
            } else if (item.type === 'income_overseas') {
                yearDataRef.income.other_non_remitted += myShare;
            }
        }
    });

    // Total Gross (Pre-tax)
    yearDataRef.income.total = yearDataRef.income.pension + yearDataRef.income.other_taxable + yearDataRef.income.other_non_remitted;
}

/**
 * Step 5: Calculate Taxes (Individual Level)
 * Calculates Canadian WHT, and Malaysian Tax (Resident).
 */
function step5_CalculateTaxes(personYearData, fullScenario, settings, ownerType) {
    // [MODIFIED] WHT Rate set to 15% (Canada-Malaysia Tax Treaty Article 18)
    const whtRate = 0.15;

    // [FIX v11.0.4] Use ownerType parameter directly (removed redundant arguments[3] usage)
    let myBirthYear = fullScenario.user?.birthYear || 1980;
    if (ownerType === 'spouse' && fullScenario.spouse) {
        myBirthYear = fullScenario.spouse.birthYear || myBirthYear;
    }
    
    const currentYear = myBirthYear + personYearData.age;
    const yearsSinceBase = Math.max(0, currentYear - (settings.baseYear || 2025));
    const colaMultiplier = Math.pow(1 + settings.cola, yearsSinceBase);
    
    // Ensure Exchange Rate is valid
    const exchangeRate = Number(settings.exchangeRate) || 3.1; // Default to CAD/MYR rate

    const inc = personYearData.income;
    const wd = personYearData.withdrawals;

    // --- 1. Canadian Withholding Tax (15%) ---
    // Applied to Pension. (RRSP/LIF withdrawals handled at source in withdrawalEngine)
    const canTaxBase = (inc.pension || 0);
    const canTax = canTaxBase * whtRate;

    // --- 2. Malaysian Tax (Resident - Foreign Source Income) ---
    // [FIX v11.0.4] Removed dead 'wd.thai_taxable_remittance' reference (Thailand version leftover).
    // Malaysian tax base = other_taxable income remitted to Malaysia only.
    const malaysianBaseCAD = (inc.other_taxable || 0);
    
    // Malaysian Tax (0% on Foreign Income - as of 2025)
    const malaysianTaxCAD = _calculateMalaysianTax(malaysianBaseCAD, exchangeRate, colaMultiplier);

    // --- Final Totals ---
    // tax_can includes WHT deducted at source for correct total reporting
    return {
        totalTax: canTax + malaysianTaxCAD + (wd.wht_deducted || 0),
        tax_can: canTax + (wd.wht_deducted || 0), 
        tax_thai: malaysianTaxCAD
    };
}

/** * Helper: Calculate Malaysian Tax (Resident)
 * Currently set to 0% for foreign source income (FSI) remitted by residents.
 */
function _calculateMalaysianTax(incomeCAD, exchangeRate, colaMultiplier) {
    // Current Rule (2025): Foreign source income remitted by residents is tax exempt (0%).
    if (incomeCAD > 0) {
        console.log(`Malaysian FSI Tax Exempt (0%) applied to ${Math.round(incomeCAD).toLocaleString()} CAD FSI.`);
    }
    return 0; 
}
