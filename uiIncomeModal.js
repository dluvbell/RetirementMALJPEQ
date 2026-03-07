/**
 * @project     Canada-Malaysia Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     14.0.0 (Feature: Auto-Save Income Data)
 * @file        uiIncomeModal.js
 * @created     2025-11-09
 * @description Handles UI logic for Income modal. Includes sync logic (Changes in A automatically reflect in B).
 */

// uiIncomeModal.js

// --- State Variables ---
let otherIncomes_a = [];
let otherIncomes_b = [];

// --- Initialization ---
function initializeIncomeModal(scenarioSuffix) {
    const s = scenarioSuffix;
    const suffix = s === 'a' ? '' : '_b';

    // [UPDATED] Removed auto-default logic. If empty, it stays empty.
    // if (s === 'a' && otherIncomes_a.length === 0) { otherIncomes_a = getDefaultIncomes(s); }
    // if (s === 'b' && otherIncomes_b.length === 0) { otherIncomes_b = getDefaultIncomes(s); }

    // 1. Open Modal Button
    elements[`manage_income_btn${suffix}`]?.addEventListener('click', () => {
        elements[`income_modal${suffix}`]?.classList.remove('hidden');
        renderIncomeList(s);
    });

    // 2. Close Modal Buttons
    elements[`closeButton${suffix}`]?.addEventListener('click', () => {
        elements[`income_modal${suffix}`]?.classList.add('hidden');
        clearIncomeForm(s);
    });
    
    // Close on backdrop click
    const modal = document.getElementById(`income-modal${suffix}`);
    if (modal) {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.classList.add('hidden');
                clearIncomeForm(s);
            }
        });
    }

    // 3. Save Button
    elements[`save_income_btn${suffix}`]?.addEventListener('click', (e) => {
        e.preventDefault(); 
        saveIncomeItem(s);
    });

    // 4. Future Value Updates (Input Listeners)
    const inputIds = [`income-amount${suffix}`, `income-start-age${suffix}`, `income-cola${suffix}`, `income-type${suffix}`, `income-owner${suffix}`];
    inputIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => updateFutureValueDisplay(s));
            el.addEventListener('change', () => updateFutureValueDisplay(s));
        }
    });

    // Initial Render
    renderIncomeList(s);
}

// --- Data Management ---

function getIncomes(scenarioSuffix) {
    return scenarioSuffix === 'a' ? otherIncomes_a : otherIncomes_b;
}

function setIncomes(scenarioSuffix, incomes) {
    if (scenarioSuffix === 'a') {
        otherIncomes_a = incomes;
    } else {
        otherIncomes_b = incomes;
    }
}

// --- Render Logic ---

function renderIncomeList(scenarioSuffix) {
    const incomes = getIncomes(scenarioSuffix);
    const suffix = scenarioSuffix === 'a' ? '' : '_b';
    const listElement = document.getElementById(`income-list${suffix}`);
    
    if (!listElement) return;
    
    listElement.innerHTML = '';
    
    if (!incomes || incomes.length === 0) {
        listElement.innerHTML = `<p class="no-items">${translations[currentLanguage]?.noIncomeAdded || 'None added.'}</p>`;
        return;
    }

    incomes.forEach(p => {
        const itemDiv = document.createElement('div');
        const isExpense = (p.type && p.type.startsWith('expense'));
        itemDiv.className = isExpense ? 'income-item expense-item' : 'income-item';
        
        let ownerLabel = '';
        if (p.owner === 'user') ownerLabel = `(User)`;
        else if (p.owner === 'spouse') ownerLabel = `(Spouse)`;
        else if (p.owner === 'joint') ownerLabel = `(Joint)`;

        let typePrefix = "";
        switch (p.type) {
            case 'pension': typePrefix = "Pension: "; break;
            case 'income': typePrefix = "Other Inc: "; break;
            case 'income_overseas': typePrefix = "O/S Inc: "; break;
            case 'expense_malaysia': typePrefix = "MY Living: "; break;
            case 'expense_overseas': typePrefix = "O/S Exp: "; break;
            case 'expense_living': typePrefix = "Living: "; break;
            default: typePrefix = "Item: ";
        }

        const amountDisplay = formatCurrency(p.amount || 0);
        const colaDisplay = ` | COLA: ${((p.cola || 0) * 100).toFixed(1)}%`;
        
        const descText = `${ownerLabel} ${typePrefix}${p.desc || 'Item'} ${amountDisplay}/yr (Age ${p.startAge || '?'}-${p.endAge || '?'})${colaDisplay}`;

        itemDiv.innerHTML = `
            <span>${descText}</span>
            <div class="actions">
                <button type="button" class="edit-btn" data-id="${p.id}">Edit</button>
                <button type="button" class="delete-btn" data-id="${p.id}">Delete</button>
            </div>
        `;
        
        itemDiv.querySelector('.edit-btn').addEventListener('click', () => editIncomeItem(scenarioSuffix, p.id));
        itemDiv.querySelector('.delete-btn').addEventListener('click', () => deleteIncomeItem(scenarioSuffix, p.id));

        listElement.appendChild(itemDiv);
    });
}

// --- Save / Edit / Delete Logic ---

function saveIncomeItem(scenarioSuffix) {
    const s = scenarioSuffix;
    const suffix = s === 'a' ? '' : '_b';
    
    const idInput = document.getElementById(`income-id${suffix}`);
    const typeInput = document.getElementById(`income-type${suffix}`);
    const ownerInput = document.getElementById(`income-owner${suffix}`);
    const descInput = document.getElementById(`income-desc${suffix}`);
    const amountInput = document.getElementById(`income-amount${suffix}`);
    const startInput = document.getElementById(`income-start-age${suffix}`);
    const endInput = document.getElementById(`income-end-age${suffix}`);
    const colaInput = document.getElementById(`income-cola${suffix}`);

    if (!amountInput || !startInput) {
        console.error("Missing input elements for saveIncomeItem");
        return;
    }

    const id = parseInt(idInput.value) || 0;
    const type = typeInput.value;
    const owner = ownerInput ? ownerInput.value : 'user';
    const desc = descInput.value || 'Item';
    const amount = parseFloat(amountInput.value) || 0;
    const startAge = parseInt(startInput.value) || 0;
    const endAge = parseInt(endInput.value) || 110;
    const cola = (parseFloat(colaInput.value) || 0) / 100;

    const incomes = getIncomes(s);
    const newItem = { id: id || Date.now(), type, owner, desc, amount, startAge, endAge, cola };

    if (id) {
        const index = incomes.findIndex(p => p.id === id);
        if (index > -1) {
            incomes[index] = newItem;
        }
    } else {
        incomes.push(newItem);
    }

    setIncomes(s, incomes);
    clearIncomeForm(s);
    renderIncomeList(s);

    // Sync A -> B
    if (s === 'a') {
        const itemCopy = JSON.parse(JSON.stringify(newItem));
        const idxB = otherIncomes_b.findIndex(p => p.id === itemCopy.id);
        if (idxB > -1) {
            otherIncomes_b[idxB] = itemCopy;
        } else {
            otherIncomes_b.push(itemCopy);
        }
    }
    
    // [NEW] Auto-Save to LocalStorage
    if (window.saveToLocalStorage) window.saveToLocalStorage();
}

function editIncomeItem(scenarioSuffix, id) {
    const s = scenarioSuffix;
    const suffix = s === 'a' ? '' : '_b';
    const incomes = getIncomes(s);
    const item = incomes.find(p => p.id === id);
    
    if (item) {
        const setVal = (id, val) => { 
            const el = document.getElementById(id); 
            if(el) el.value = val; 
        };

        setVal(`income-id${suffix}`, item.id);
        setVal(`income-type${suffix}`, item.type);
        setVal(`income-owner${suffix}`, item.owner || 'user');
        setVal(`income-desc${suffix}`, item.desc);
        setVal(`income-amount${suffix}`, item.amount);
        setVal(`income-start-age${suffix}`, item.startAge);
        setVal(`income-end-age${suffix}`, item.endAge);
        setVal(`income-cola${suffix}`, (item.cola || 0) * 100);
        
        updateFutureValueDisplay(s);
    }
}

function deleteIncomeItem(scenarioSuffix, id) {
    const s = scenarioSuffix;
    let incomes = getIncomes(s);
    incomes = incomes.filter(p => p.id !== id);
    setIncomes(s, incomes);
    renderIncomeList(s);

    // Sync A -> B
    if (s === 'a') {
        otherIncomes_b = otherIncomes_b.filter(p => p.id !== id);
    }
    
    // [NEW] Auto-Save to LocalStorage
    if (window.saveToLocalStorage) window.saveToLocalStorage();
}

function clearIncomeForm(scenarioSuffix) {
    const s = scenarioSuffix;
    const suffix = s === 'a' ? '' : '_b';
    
    const setVal = (id, val) => { 
        const el = document.getElementById(id); 
        if(el) el.value = val; 
    };

    setVal(`income-id${suffix}`, '');
    setVal(`income-type${suffix}`, 'pension');
    setVal(`income-owner${suffix}`, 'user');
    setVal(`income-desc${suffix}`, '');
    setVal(`income-amount${suffix}`, '');
    setVal(`income-start-age${suffix}`, '');
    setVal(`income-end-age${suffix}`, '');
    setVal(`income-cola${suffix}`, '0'); 
    
    const displayElement = document.getElementById(`future-value-display${suffix}`);
    if(displayElement) displayElement.textContent = '';
}

function updateFutureValueDisplay(scenarioSuffix) {
    const s = scenarioSuffix;
    const suffix = s === 'a' ? '' : '_b';
    const displayElement = document.getElementById(`future-value-display${suffix}`);
    
    if (!displayElement) return;

    const amountVal = document.getElementById(`income-amount${suffix}`)?.value;
    const startAgeVal = document.getElementById(`income-start-age${suffix}`)?.value;
    const colaVal = document.getElementById(`income-cola${suffix}`)?.value;
    const birthYearVal = document.getElementById(`userBirthYear${suffix}`)?.value;

    const amount = parseFloat(amountVal) || 0;
    const startAge = parseInt(startAgeVal) || 0;
    const colaRate = (parseFloat(colaVal) || 0) / 100;
    const birthYear = parseInt(birthYearVal) || 1980;
    
    if (!amount || !startAge) {
        displayElement.textContent = '';
        return;
    }

    const baseYear = 2025;
    const itemStartYear = birthYear + startAge;
    const yearsFromBaseToStart = itemStartYear - baseYear;

    if (itemStartYear <= new Date().getFullYear()) {
        displayElement.textContent = "Active now."; 
        return;
    }

    const futureValue = amount * Math.pow(1 + colaRate, yearsFromBaseToStart);
    displayElement.textContent = `Est @ Age ${startAge}: $${Math.round(futureValue).toLocaleString()}`;
}

// [UPDATED] Helper remains, but unused by initialization
function getDefaultIncomes(scenarioSuffix) {
    const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? parseInt(el.value) : 0;
    };
    const maxAge = getVal('lifeExpectancy') || 95;

    // Return structure for reference if needed
    return [
        { id: 101, type: 'pension', desc: 'OTPP Pension', amount: 66000, startAge: 58, endAge: maxAge, owner: 'user', cola: 0.02 },
        { id: 102, type: 'expense_living', desc: 'Total Living Expense', amount: 40000, startAge: 52, endAge: maxAge, owner: 'joint', cola: 0.03 }
    ];
}