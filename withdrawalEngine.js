/**
 * @project     Canada-Malaysia Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     15.0.1 (Fix: Removed dead 'assets.nonreg' fallback path from old schema)
 * @file        withdrawalEngine.js
 * @description JEPQ 전용 인출 엔진. 복잡한 RRIF/LIF 인출 로직을 소거하고 15% WHT 차감 및 FIFO 방식의 배열 순차 매도 로직만 적용.
 * @note        JEPQ는 아일랜드 도미사일 구조로 배당 분배 시 이미 세후 수익률 반영. WHT 별도 계산 불필요.
 */

// withdrawalEngine.js

/**
 * Step 4: Perform Withdrawals (JEPQ FIFO Mode)
 */
function step4_PerformWithdrawals(yearData, userAssets, spouseAssets, hasSpouse, settings) {
    // 1. 초기화 (JEPQ 매도 전용 레코드)
    yearData.user.withdrawals = { total: 0, wht_deducted: 0, jepq_gross_sold: 0 };
    if (hasSpouse) {
        yearData.spouse.withdrawals = { total: 0, wht_deducted: 0, jepq_gross_sold: 0 };
    }
    yearData.withdrawals = { total: 0, wht_deducted: 0, jepq_gross_sold: 0 };
    
    const WHT_RATE = 0.15;
    const KEEP_RATE = 1 - WHT_RATE;

    // 2. 가용 현금흐름 계산 (Income)
    let userPensionCash = (yearData.user.income.pension || 0) * KEEP_RATE;
    let spousePensionCash = hasSpouse ? (yearData.spouse.income.pension || 0) * KEEP_RATE : 0;
    
    let userOtherCash = (yearData.user.income.other_taxable || 0) + 
                        (yearData.user.income.other_non_remitted || 0) + 
                        (yearData.dividends.user || 0);

    let spouseOtherCash = hasSpouse ? ((yearData.spouse.income.other_taxable || 0) + 
                          (yearData.spouse.income.other_non_remitted || 0) + 
                          (yearData.dividends.spouse || 0)) : 0;

    const DEPLETION_THRESHOLD = 1.0;
    let totalShortfall = (yearData.expenses || 0);

    // 3. 인컴 선사용으로 부족분(Shortfall) 차감
    const userIncomeUsed = Math.min(totalShortfall, userPensionCash + userOtherCash);
    totalShortfall -= userIncomeUsed;
    
    if (hasSpouse) {
        const spouseIncomeUsed = Math.min(totalShortfall, spousePensionCash + spouseOtherCash);
        totalShortfall -= spouseIncomeUsed;
    }

    // 4. JEPQ 배열 강제 매도 (FIFO - 위에서부터 아래로)
    if (totalShortfall > DEPLETION_THRESHOLD) {
        // 필요 순수령액(Net)을 맞추기 위한 총 매도 필요액(Gross)
        let grossNeeded = totalShortfall / KEEP_RATE;

        const sellJepqLots = (assets, wdRecord) => {
            if (grossNeeded <= 0.01 || !assets) return;

            let lots = assets.jepqLots || (assets.nonreg && assets.nonreg.lots ? assets.nonreg.lots : null);
            if (!lots && Array.isArray(assets)) lots = assets;

            if (lots && Array.isArray(lots)) {
                for (let i = 0; i < lots.length; i++) {
                    if (grossNeeded <= 0.01) break;
                    let lot = lots[i];
                    
                    let lotVal = lot.equity !== undefined ? lot.equity : (lot.balance !== undefined ? lot.balance : (lot.value !== undefined ? lot.value : 0));
                    
                    if (lotVal > 0) {
                        let take = Math.min(grossNeeded, lotVal);
                        
                        if (lot.equity !== undefined) lot.equity -= take;
                        else if (lot.balance !== undefined) lot.balance -= take;
                        else if (lot.value !== undefined) lot.value -= take;

                        grossNeeded -= take;
                        wdRecord.jepq_gross_sold += take;
                        wdRecord.wht_deducted += take * WHT_RATE;
                        wdRecord.total += take * KEEP_RATE;
                        totalShortfall -= (take * KEEP_RATE);
                    }
                }
            }
            // [FIX v15.0.1] Removed dead 'assets.nonreg.equity' fallback (old schema leftover).
            // Current asset structure is always Array<{equity, type, ...}>.
            // If lots array is empty or assets is null, nothing is sold — depleted flag handles this.
        };

        sellJepqLots(userAssets, yearData.user.withdrawals);
        if (hasSpouse && totalShortfall > DEPLETION_THRESHOLD) {
            sellJepqLots(spouseAssets, yearData.spouse.withdrawals);
        }
    }

    // 5. 최종 집계 및 고갈 여부 확인
    yearData.withdrawals.total = yearData.user.withdrawals.total + (hasSpouse ? yearData.spouse.withdrawals.total : 0);
    yearData.withdrawals.wht_deducted = yearData.user.withdrawals.wht_deducted + (hasSpouse ? yearData.spouse.withdrawals.wht_deducted : 0);
    yearData.withdrawals.jepq_gross_sold = yearData.user.withdrawals.jepq_gross_sold + (hasSpouse ? yearData.spouse.withdrawals.jepq_gross_sold : 0);

    const getRemainingTotal = (assets) => {
        if (!assets) return 0;
        let total = 0;
        let lots = assets.jepqLots || (assets.nonreg && assets.nonreg.lots ? assets.nonreg.lots : null);
        if (!lots && Array.isArray(assets)) lots = assets;

        if (lots && Array.isArray(lots)) {
            lots.forEach(lot => { total += (lot.equity !== undefined ? lot.equity : (lot.balance !== undefined ? lot.balance : (lot.value || 0))); });
            return total;
        }
        return 0;
    };
    
    const totalAssetsUser = getRemainingTotal(userAssets);
    const totalAssetsSpouse = hasSpouse ? getRemainingTotal(spouseAssets) : 0;
    
    const depleted = (totalAssetsUser + totalAssetsSpouse) < 10;

    return { withdrawals: yearData.withdrawals, depleted: depleted };
}
