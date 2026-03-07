/**
 * @project     Canada-Malaysia Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     11.0.0 (Feature: Malaysia Tax Treaty & Simplified Tax Logic)
 * @file        data.js
 * @description Static data for tax rates, government benefits, and withdrawal factors.
 */

// data.js

// Note: Adjusted for Malaysia Non-Resident scenarios based on 2025 estimates.

// --- Exchange Rate Default ---
// 1 CAD to MYR (Ringgit) - Updated from THB
const DEFAULT_CAD_MYR_RATE = 3.1;

// --- Canadian Non-Resident Withholding Tax Rates (Based on Canada-Malaysia Treaty) ---
// Treaty Article 18 limits WHT on periodic pension payments to 15%.
const withholdingTaxRates = {
    PENSION: 0.15,   // CPP, OAS, OTPP, RRIF/LIF withdrawals (if periodic)
    NON_REG: 0.00,   // Capital Gains/Interest (Non-treaty with Malaysia, but Canada does not tax non-resident cap gains)
    DIVIDEND: 0.15,  // Treaty rate for dividends (may vary)
    INTEREST: 0.15   // Treaty rate for interest (may vary)
};

// --- MALAYSIA TAX NOTE ---
// Malaysia uses a Territorial Tax System. As of 2024-2026, foreign source income (FSI) 
// for resident individuals is exempt, and capital gains are generally exempt.
// We model Malaysian tax as 0% for all foreign retirement/investment income.

// --- OAS and CPP Parameters (2025 Est) ---
const OAS_MAX_MONTHLY_2025 = 730; 
const CPP_MAX_MONTHLY_2025 = 1400; 

// --- RRIF Minimum Rates (Statutory) ---
const RRIF_MINIMUM_RATES = [
    { age: 71, rate: 0.0528 }, { age: 72, rate: 0.0540 }, { age: 73, rate: 0.0553 },
    { age: 74, rate: 0.0567 }, { age: 75, rate: 0.0582 }, { age: 76, rate: 0.0598 },
    { age: 77, rate: 0.0617 }, { age: 78, rate: 0.0636 }, { age: 79, rate: 0.0658 },
    { age: 80, rate: 0.0681 }, { age: 81, rate: 0.0708 }, { age: 82, rate: 0.0738 },
    { age: 83, rate: 0.0771 }, { age: 84, rate: 0.0808 }, { age: 85, rate: 0.0851 },
    { age: 86, rate: 0.0899 }, { age: 87, rate: 0.0955 }, { age: 88, rate: 0.1021 },
    { age: 89, rate: 0.1099 }, { age: 90, rate: 0.1192 }, { age: 91, rate: 0.1306 },
    { age: 92, rate: 0.1449 }, { age: 93, rate: 0.1634 }, { age: 94, rate: 0.1879 },
];

const ontarioLifMaximumFactors = [
    { age: 55, factor: 0.0651 }, { age: 56, factor: 0.0657 }, { age: 57, factor: 0.0663 },
    { age: 58, factor: 0.0670 }, { age: 59, factor: 0.0677 }, { age: 60, factor: 0.0685 },
    { age: 61, factor: 0.0694 }, { age: 62, factor: 0.0704 }, { age: 63, factor: 0.0714 },
    { age: 64, factor: 0.0725 }, { age: 65, factor: 0.0738 }, { age: 66, factor: 0.0751 },
    { age: 67, factor: 0.0765 }, { age: 68, factor: 0.0780 }, { age: 69, factor: 0.0797 },
    { age: 70, factor: 0.0815 }, { age: 71, factor: 0.0834 }, { age: 72, factor: 0.0854 },
    { age: 73, factor: 0.0877 }, { age: 74, factor: 0.0901 }, { age: 75, factor: 0.0927 },
    { age: 76, factor: 0.0956 }, { age: 77, factor: 0.0988 }, { age: 78, factor: 0.1023 },
    { age: 79, factor: 0.1062 }, { age: 80, factor: 0.1106 }, { age: 81, factor: 0.1154 },
    { age: 82, factor: 0.1208 }, { age: 83, factor: 0.1269 }, { age: 84, factor: 0.1338 },
    { age: 85, factor: 0.1416 }, { age: 86, factor: 0.1507 }, { age: 87, factor: 0.1614 },
    { age: 88, factor: 0.1740 }, { age: 89, factor: 0.1893 }, { age: 90, factor: 0.2081 },
    { age: 91, factor: 0.2319 }, { age: 92, factor: 0.2625 }, { age: 93, factor: 0.3033 },
    { age: 94, factor: 0.3592 }, { age: 95, factor: 0.4393 }, { age: 96, factor: 0.5658 },
    { age: 97, factor: 0.7766 }, { age: 98, factor: 1.0000 },
];