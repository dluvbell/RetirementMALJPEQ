/**
 * @project     Canada-Malaysia Retirement Simulator (Non-Resident)
 * @author      dluvbell (https://github.com/dluvbell)
 * @version     16.1.0 (Feature: Manual VIX Crush Events)
 * @file        uiDataHandler.js
 * @description Manages data sync, save/load, and dynamic asset UI binding.
 */

// uiDataHandler.js

// --- State Variables ---
let scenarioAData = { user: {}, spouse: {} };
let scenarioBData = { user: {}, spouse: {} };
let manualCrashesA = []; 
let manualCrashesB = [];
let manualVixA = []; 
let manualVixB = [];
let isRestoring = false; // Flag to prevent auto-save/sync during load

// --- Helper: ID Resolver for Inconsistent Scenario A Naming ---
function _resolveElementId(baseId, scenarioSuffix) {
    if (scenarioSuffix === 'b') {
        return baseId + '_b';
    } else {
        const idsWithASuffix = [
            'isCouple', 'retirementAge', 
            'survival_enable', 'survival_trigger', 'survival_expense'
        ];
        
        if (idsWithASuffix.includes(baseId)) {
            return baseId + '_a';
        }
        return baseId;
    }
}

// --- Initialization ---
function initializeScenarioData(scenarioSuffix) {
    const s = scenarioSuffix;
    const dataStore = (s === 'a') ? scenarioAData : scenarioBData;

    saveCurrentPersonData(s);
    
    const coupleCheckboxId = _resolveElementId('isCouple', s);
    const coupleCheckbox = document.getElementById(coupleCheckboxId);
    const spouseAssetContainer = document.getElementById(`spouse-assets-container-${s}`);
    const spouseIncomeContainer = document.getElementById(`spouse-income-plan-container-${s}`); 

    if (coupleCheckbox) {
        const toggleSpouseUI = () => {
            const isChecked = coupleCheckbox.checked;
            if (spouseAssetContainer) isChecked ? spouseAssetContainer.classList.remove('hidden') : spouseAssetContainer.classList.add('hidden');
            if (spouseIncomeContainer) isChecked ? spouseIncomeContainer.classList.remove('hidden') : spouseIncomeContainer.classList.add('hidden');
        };

        coupleCheckbox.addEventListener('change', () => {
            toggleSpouseUI();
            if (s === 'a' && !isRestoring) syncInputAtoB(coupleCheckboxId);
        });
        toggleSpouseUI();
    }

    if (s === 'a') {
        const basicInputs = [
            'exchangeRate', 'lifeExpectancy', 'cola',
            'retirementAge', 'userBirthYear', 
            'spouseBirthYear', 
            'isCouple',
            'survival_enable', 'survival_trigger', 'survival_expense'
        ];

        basicInputs.forEach(baseId => {
            const idA = _resolveElementId(baseId, 'a');
            const elementA = document.getElementById(idA); 
            if (elementA) {
                const eventType = (elementA.type === 'checkbox' || elementA.tagName === 'SELECT') ? 'change' : 'input';
                elementA.addEventListener(eventType, () => {
                    if (!isRestoring) syncInputAtoB(idA);
                });
            }
        });
    }

    // Dynamic Asset Add Buttons
    const uBtn = document.getElementById(`add-asset-btn-${s}`);
    const sBtn = document.getElementById(`add-asset-btn-spouse-${s}`);
    if(uBtn) {
        const newUBtn = uBtn.cloneNode(true);
        uBtn.parentNode.replaceChild(newUBtn, uBtn);
        newUBtn.addEventListener('click', () => { addDynamicAssetUI(`dynamic-assets-list-${s}`, null, s); triggerSaveAndSync(s); });
    }
    if(sBtn) {
        const newSBtn = sBtn.cloneNode(true);
        sBtn.parentNode.replaceChild(newSBtn, sBtn);
        newSBtn.addEventListener('click', () => { addDynamicAssetUI(`dynamic-assets-list-spouse-${s}`, null, s); triggerSaveAndSync(s); });
    }

    _setupCrashListLogic(s);
    _setupVixListLogic(s);
}

// --- Data Synchronization Functions ---

function saveCurrentPersonData(scenarioSuffix) {
    if (isRestoring) return;

    const s = scenarioSuffix;
    const dataStore = (s === 'a') ? scenarioAData : scenarioBData;

    const getVal = (baseId) => {
        const el = document.getElementById(_resolveElementId(baseId, s));
        return el ? (parseFloat(el.value) || 0) : 0;
    };

    dataStore.user = {
        birthYear: getVal('userBirthYear') || 1980,
        assets: _gatherAssetDataFromUI(s, 'user')
    };

    dataStore.spouse = {
        birthYear: getVal('spouseBirthYear') || 1980,
        assets: _gatherAssetDataFromUI(s, 'spouse')
    };
}

function loadPersonData(scenarioSuffix) {
    const s = scenarioSuffix;
    const dataStore = (s === 'a') ? scenarioAData : scenarioBData;
    
    if (!dataStore || !dataStore.user) {
        console.warn(`loadPersonData: dataStore for ${s} is empty.`);
        return;
    }

    const uData = dataStore.user || {};
    const sData = dataStore.spouse || {};

    const setVal = (baseId, val) => {
        const id = _resolveElementId(baseId, s);
        const el = document.getElementById(id);
        if (el) el.value = val;
    };

    setVal('userBirthYear', uData.birthYear || '');
    
    if (uData.assets) {
        _populateAssetUI(s, 'user', uData.assets);
    }

    setVal('spouseBirthYear', sData.birthYear || '');
    
    if (sData.assets) {
        _populateAssetUI(s, 'spouse', sData.assets);
    }

    const coupleCheckbox = document.getElementById(_resolveElementId('isCouple', s));
    if (coupleCheckbox) coupleCheckbox.dispatchEvent(new Event('change'));

    if (typeof renderIncomeList === 'function') renderIncomeList(s);
    _renderCrashList(s); 
    _renderVixList(s);
}

// --- Dynamic Asset Logic ---

function addDynamicAssetUI(containerId, data = null, scenarioSuffix = 'a') {
    const container = document.getElementById(containerId);
    const template = document.getElementById('dynamic-asset-template');
    if (!container || !template) return;

    const clone = template.content.cloneNode(true);
    const row = clone.querySelector('.dynamic-asset');

    if (data) {
        row.querySelector('.asset-name').value = data.name || 'Asset';
        row.querySelector('.asset-type').value = data.type || 'equity';
        row.querySelector('.asset-bal').value = data.balance || 0;
        row.querySelector('.asset-growth').value = (data.growth || 0) * 100;
        row.querySelector('.asset-stdev').value = (data.stdev || 0) * 100;
        row.querySelector('.asset-div').value = (data.initialDiv || 0) * 100;
        row.querySelector('.asset-div-growth').value = (data.divGrowth || 0) * 100;
        row.querySelector('.asset-min-yield').value = (data.minYield || 0) * 100;
        row.querySelector('.asset-max-yield').value = (data.maxYield || 0) * 100;
        row.querySelector('.asset-wht').value = (data.wht || 0) * 100;
    }

    row.querySelector('.btn-remove-asset').addEventListener('click', function() {
        row.remove();
        triggerSaveAndSync(scenarioSuffix);
    });

    const inputs = row.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('input', () => triggerSaveAndSync(scenarioSuffix));
        input.addEventListener('change', () => triggerSaveAndSync(scenarioSuffix));
    });

    container.appendChild(clone);
}

function triggerSaveAndSync(s) {
    if (isRestoring) return;
    if (window.saveToLocalStorage) window.saveToLocalStorage();
    
    // Sync A arrays to B arrays if triggered from A
    if (s === 'a') {
        const dataA_user = _gatherAssetDataFromUI('a', 'user');
        const dataA_spouse = _gatherAssetDataFromUI('a', 'spouse');
        const prev = isRestoring;
        isRestoring = true; // Prevent recursive loop
        _populateAssetUI('b', 'user', dataA_user);
        _populateAssetUI('b', 'spouse', dataA_spouse);
        isRestoring = prev;
    }
}

function _gatherAssetDataFromUI(scenarioSuffix, owner) {
    const suffix = (scenarioSuffix === 'a') ? '-a' : '-b';
    const ownerInfix = (owner === 'spouse') ? '-spouse' : '';
    const containerId = `dynamic-assets-list${ownerInfix}${suffix}`;
    const container = document.getElementById(containerId);
    if (!container) return [];

    const result = [];
    const rows = container.querySelectorAll('.dynamic-asset');
    rows.forEach(row => {
        result.push({
            name: row.querySelector('.asset-name').value || 'Asset',
            type: row.querySelector('.asset-type').value || 'equity',
            balance: parseFloat(row.querySelector('.asset-bal').value) || 0,
            growth: (parseFloat(row.querySelector('.asset-growth').value) || 0) / 100,
            stdev: (parseFloat(row.querySelector('.asset-stdev').value) || 0) / 100,
            initialDiv: (parseFloat(row.querySelector('.asset-div').value) || 0) / 100,
            divGrowth: (parseFloat(row.querySelector('.asset-div-growth').value) || 0) / 100,
            minYield: (parseFloat(row.querySelector('.asset-min-yield').value) || 0) / 100,
            maxYield: (parseFloat(row.querySelector('.asset-max-yield').value) || 0) / 100,
            wht: (parseFloat(row.querySelector('.asset-wht').value) || 0) / 100
        });
    });
    return result;
}

function _populateAssetUI(scenarioSuffix, owner, assetsArray) {
    const suffix = (scenarioSuffix === 'a') ? '-a' : '-b';
    const ownerInfix = (owner === 'spouse') ? '-spouse' : '';
    const containerId = `dynamic-assets-list${ownerInfix}${suffix}`;
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = ''; 
    if (!Array.isArray(assetsArray)) return;

    assetsArray.forEach(d => {
        addDynamicAssetUI(containerId, d, scenarioSuffix);
    });
}

// --- Strategy & Event Handlers ---

function _gatherStrategyInputs(s) {
    const getVal = (baseId) => parseFloat(document.getElementById(_resolveElementId(baseId, s))?.value) || 0;
    const getCheck = (baseId) => document.getElementById(_resolveElementId(baseId, s))?.checked || false;

    return {
        survival_enable: getCheck('survival_enable'),
        survival_trigger: getVal('survival_trigger'),
        survival_expense: getVal('survival_expense')
    };
}

function _setupCrashListLogic(s) {
    const btnId = `add-crash-btn-${s}`;
    const ageInputId = `crash_age_input_${s}`;
    const dropInputId = `crash_drop_input_${s}`;
    
    const btn = document.getElementById(btnId);
    if (!btn) return;

    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', () => {
        const age = parseInt(document.getElementById(ageInputId).value);
        const drop = parseFloat(document.getElementById(dropInputId).value);
        
        if (age > 0 && !isNaN(drop)) {
            const list = (s === 'a') ? manualCrashesA : manualCrashesB;
            const newItem = { age, drop };
            list.push(newItem);
            list.sort((a,b) => a.age - b.age);
            _renderCrashList(s);
            
            if (s === 'a' && !isRestoring) { 
                manualCrashesB.push({ ...newItem });
                manualCrashesB.sort((a,b) => a.age - b.age);
                _renderCrashList('b');
            }
            if (!isRestoring && window.saveToLocalStorage) window.saveToLocalStorage();

            document.getElementById(ageInputId).value = '';
            document.getElementById(dropInputId).value = '';
        }
    });
    
    _renderCrashList(s);
}

function _setupVixListLogic(s) {
    const btnId = `add-vix-btn-${s}`;
    const ageInputId = `vix_age_input_${s}`;
    
    const btn = document.getElementById(btnId);
    if (!btn) return;

    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', () => {
        const age = parseInt(document.getElementById(ageInputId).value);
        
        if (age > 0) {
            const list = (s === 'a') ? manualVixA : manualVixB;
            const newItem = { age };
            // Avoid duplicates
            if (!list.some(v => v.age === age)) {
                list.push(newItem);
                list.sort((a,b) => a.age - b.age);
            }
            _renderVixList(s);
            
            if (s === 'a' && !isRestoring) { 
                if (!manualVixB.some(v => v.age === age)) {
                    manualVixB.push({ ...newItem });
                    manualVixB.sort((a,b) => a.age - b.age);
                }
                _renderVixList('b');
            }
            if (!isRestoring && window.saveToLocalStorage) window.saveToLocalStorage();

            document.getElementById(ageInputId).value = '';
        }
    });
    
    _renderVixList(s);
}

function _renderCrashList(s) {
    const listId = `crash-list-${s}`;
    const container = document.getElementById(listId);
    if (!container) return;
    
    const data = (s === 'a') ? manualCrashesA : manualCrashesB;
    container.innerHTML = '';
    
    data.forEach((item, index) => {
        const div = document.createElement('div');
        div.style.marginBottom = '4px';
        div.style.fontSize = '0.9em';
        
        const isRebound = item.drop < 0;
        const label = isRebound ? "📈 Rebound" : "📉 Crash";
        const valDisplay = isRebound ? `+${Math.abs(item.drop)}` : `-${item.drop}`;
        const colorStyle = isRebound ? "color: var(--success-color);" : "color: var(--danger-color);";

        div.innerHTML = `
            <span style="${colorStyle}">Age <strong>${item.age}</strong>: ${label} <strong>${valDisplay}%</strong></span>
            <button type="button" onclick="_removeCrash('${s}', ${index})" style="margin-left:8px; padding:0 4px; font-size:0.8em; background:#dc3545; color:white; border:none; border-radius:3px; cursor:pointer;">x</button>
        `;
        container.appendChild(div);
    });
}

function _renderVixList(s) {
    const listId = `vix-list-${s}`;
    const container = document.getElementById(listId);
    if (!container) return;
    
    const data = (s === 'a') ? manualVixA : manualVixB;
    container.innerHTML = '';
    
    data.forEach((item, index) => {
        const div = document.createElement('div');
        div.style.marginBottom = '4px';
        div.style.fontSize = '0.9em';
        
        div.innerHTML = `
            <span style="color: var(--secondary-color);">Age <strong>${item.age}</strong>: ⏸️ VIX Crush (Min Yield)</span>
            <button type="button" onclick="_removeVix('${s}', ${index})" style="margin-left:8px; padding:0 4px; font-size:0.8em; background:#dc3545; color:white; border:none; border-radius:3px; cursor:pointer;">x</button>
        `;
        container.appendChild(div);
    });
}

window._removeCrash = function(s, index) {
    const list = (s === 'a') ? manualCrashesA : manualCrashesB;
    const removedItem = list[index];
    list.splice(index, 1);
    _renderCrashList(s);
    
    if (s === 'a' && removedItem && !isRestoring) {
        const idxB = manualCrashesB.findIndex(c => c.age === removedItem.age && c.drop === removedItem.drop);
        if (idxB > -1) {
            manualCrashesB.splice(idxB, 1);
            _renderCrashList('b');
        }
    }
    if (!isRestoring && window.saveToLocalStorage) window.saveToLocalStorage();
}

window._removeVix = function(s, index) {
    const list = (s === 'a') ? manualVixA : manualVixB;
    const removedItem = list[index];
    list.splice(index, 1);
    _renderVixList(s);
    
    if (s === 'a' && removedItem && !isRestoring) {
        const idxB = manualVixB.findIndex(v => v.age === removedItem.age);
        if (idxB > -1) {
            manualVixB.splice(idxB, 1);
            _renderVixList('b');
        }
    }
    if (!isRestoring && window.saveToLocalStorage) window.saveToLocalStorage();
}


// --- Data Gathering (Main Export) ---
function gatherInputs(scenarioSuffix) {
    const s = scenarioSuffix;
    const dataStore = (s === 'a') ? scenarioAData : scenarioBData;
    let incomesAndExpenses = (s === 'a') ? otherIncomes_a : otherIncomes_b;
    let crashes = (s === 'a') ? manualCrashesA : manualCrashesB;
    let vixes = (s === 'a') ? manualVixA : manualVixB;

    saveCurrentPersonData(s); 

    const getEl = (baseId) => document.getElementById(_resolveElementId(baseId, s));
    const getVal = (baseId) => { const el = getEl(baseId); return el ? parseFloat(el.value) : 0; };
    const getInt = (baseId) => { const el = getEl(baseId); return el ? parseInt(el.value) : 0; };
    const getCheck = (baseId) => { const el = getEl(baseId); return el ? el.checked : false; };

    const colaInput = getVal('cola');
    const safeCola = isNaN(colaInput) ? 0.025 : (colaInput / 100);

    const commonInputs = {
        exchangeRate: getVal('exchangeRate') || 25.0,
        lifeExpectancy: getInt('lifeExpectancy') || 95,
        cola: safeCola,
        retirementAge: getInt('retirementAge') || 60,
        isCouple: getCheck('isCouple')
    };

    const userData = dataStore.user || {};
    const spouseData = dataStore.spouse || {};

    const userScenarioData = {
        birthYear: userData.birthYear, 
        assets: userData.assets,
        otherIncomes: incomesAndExpenses, 
    };

    const spouseScenarioData = {
        hasSpouse: commonInputs.isCouple,
        birthYear: spouseData.birthYear, 
        assets: spouseData.assets 
    };

    return {
        exchangeRate: commonInputs.exchangeRate,
        lifeExpectancy: commonInputs.lifeExpectancy,
        cola: commonInputs.cola,
        isCouple: commonInputs.isCouple,
        scenario: {
            retirementAge: commonInputs.retirementAge,
            survivalConfig: _gatherStrategyInputs(s),
            manualCrashes: crashes,
            vixCrashes: vixes,
            user: userScenarioData,
            spouse: spouseScenarioData
        }
    };
}

// --- Sync Helpers ---
function syncInputAtoB(elementIdA) {
    if (isRestoring) return; 

    const elementA = document.getElementById(elementIdA); 
    if (!elementA) return;

    const isCheckbox = elementA.type === 'checkbox';
    const newValue = isCheckbox ? elementA.checked : elementA.value;
    
    let baseId = elementIdA;
    if (baseId.endsWith('_a')) {
        baseId = baseId.slice(0, -2);
    }
    
    let elementIdB = baseId + '_b';
    const elementB = document.getElementById(elementIdB);
    
    if (elementB) {
        if (isCheckbox) {
            if (elementB.checked !== newValue) {
                elementB.checked = newValue;
                elementB.dispatchEvent(new Event('change')); 
            }
        } else {
            if (elementB.value !== newValue) {
                elementB.value = newValue;
                if (elementB.tagName === 'SELECT') elementB.dispatchEvent(new Event('change'));
            }
        }
    }
    
    if (window.saveToLocalStorage) window.saveToLocalStorage();
}

// --- JSON I/O ---
function handleSaveScenarioClick() {
    saveCurrentPersonData('a'); saveCurrentPersonData('b');
    const dataToSave = _gatherSaveObj();
    const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); 
    const a = document.createElement('a'); a.href = url; a.download = 'malaysia_retirement_scenario_v16_1.json'; 
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

function handleLoadScenarioClick() {
    if (elements.scenario_file_input) elements.scenario_file_input.click();
}

function handleFileSelected(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { 
        try { 
            const data = JSON.parse(e.target.result);
            isRestoring = true;
            
            populateUIFromLoadedData(data); 
            
            setTimeout(() => {
                isRestoring = false;
                if(window.saveToLocalStorage) window.saveToLocalStorage();
                console.log("Restoration Complete. Data Saved.");
            }, 300);

        } catch (err) { 
            console.error(err);
            isRestoring = false;
            alert("Invalid file format."); 
        } 
        event.target.value = null; 
    };
    reader.readAsText(file);
}

function _gatherSaveObj() {
    const getVal = (id) => document.getElementById(id)?.value;
    const getCheck = (id) => document.getElementById(id)?.checked;

    return {
        exchangeRate: getVal('exchangeRate'),
        lifeExpectancy: parseInt(getVal('lifeExpectancy')), 
        cola: parseFloat(getVal('cola')),
        isCouple_a: getCheck('isCouple_a'), 
        isCouple_b: getCheck('isCouple_b'),
        
        strategy_a: _gatherStrategyInputs('a'),
        strategy_b: _gatherStrategyInputs('b'),
        crashes_a: manualCrashesA,
        crashes_b: manualCrashesB,
        vix_a: manualVixA,
        vix_b: manualVixB,

        scenarioAData: scenarioAData, otherIncomes_a: otherIncomes_a,
        retirementAge_a: getVal('retirementAge_a'),
        scenarioBData: scenarioBData, otherIncomes_b: otherIncomes_b,
        retirementAge_b: getVal('retirementAge_b')
    };
}

function populateUIFromLoadedData(data) {
    if (!data || !data.scenarioAData) { alert("Invalid data."); return; }
    
    scenarioAData = JSON.parse(JSON.stringify(data.scenarioAData)); 
    scenarioBData = JSON.parse(JSON.stringify(data.scenarioBData));
    
    otherIncomes_a = data.otherIncomes_a || []; 
    otherIncomes_b = data.otherIncomes_b || [];
    manualCrashesA = data.crashes_a || []; 
    manualCrashesB = data.crashes_b || []; 
    manualVixA = data.vix_a || [];
    manualVixB = data.vix_b || [];

    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if(el) el.checked = !!val; };

    setVal('exchangeRate', data.exchangeRate || 25.0);
    setVal('exchangeRate_b', data.exchangeRate || 25.0); 
    setVal('lifeExpectancy', data.lifeExpectancy || 95);
    setVal('cola', data.cola || 2.5);
    
    setCheck('isCouple_a', data.isCouple_a);
    setCheck('isCouple_b', data.isCouple_b);

    setVal('retirementAge_a', data.retirementAge_a || 60);
    setVal('retirementAge_b', data.retirementAge_b || 65);

    const loadStrat = (s, d) => {
        const suffix = (s === 'a') ? '_a' : '_b';
        if (d) {
            setCheck(`survival_enable${suffix}`, d.survival_enable);
            setVal(`survival_trigger${suffix}`, d.survival_trigger || 80);
            setVal(`survival_expense${suffix}`, d.survival_expense || 41000);
        }
    };
    loadStrat('a', data.strategy_a);
    loadStrat('b', data.strategy_b);

    loadPersonData('a'); 
    loadPersonData('b');
    
    _renderCrashList('a');
    _renderCrashList('b');
    _renderVixList('a');
    _renderVixList('b');
}

// [NEW] LocalStorage Implementation
window.saveToLocalStorage = function() {
    if (isRestoring) return; 

    saveCurrentPersonData('a'); saveCurrentPersonData('b');
    const data = _gatherSaveObj();
    try {
        localStorage.setItem('can_my_simulator_data', JSON.stringify(data));
    } catch(e) {
        console.warn("LocalStorage save failed (quota exceeded?)", e);
    }
};

window.loadFromLocalStorage = function() {
    try {
        const json = localStorage.getItem('can_my_simulator_data');
        if (json) {
            const data = JSON.parse(json);
            isRestoring = true;
            populateUIFromLoadedData(data);
            setTimeout(() => { isRestoring = false; }, 100);
            console.log("Loaded from LocalStorage");
        }
    } catch(e) {
        console.warn("LocalStorage load failed", e);
    }
};

function setupSyncAtoB() {
    const containerA = document.getElementById('scenarioA-pane');
    if (!containerA) return;

    const inputsA = containerA.querySelectorAll('input, select');
    inputsA.forEach(input => {
        const handler = () => {
            const srcId = input.id;
            if (!srcId) return;
            if (!isRestoring) syncInputAtoB(srcId);
        };
        input.addEventListener('input', handler);
        input.addEventListener('change', handler);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        setupSyncAtoB();
    }, 500); 
});

document.addEventListener('change', (e) => {
    if (e.target.matches('input, select')) {
        if(typeof window.saveToLocalStorage === 'function') {
            window.saveToLocalStorage();
        }
    }
});