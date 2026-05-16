const API_URL = "";
let allRoutes = [];
let selectedRoutes = new Set(); 
let newState = true; 

document.addEventListener('DOMContentLoaded', initTrafficPage);

async function initTrafficPage() {
    const token = localStorage.getItem('auth_token');
    if (!token || token === "undefined") { 
        window.location.href = 'login.html'; 
        return; 
    }

    if (!document.querySelector('.list.flex-column')) return;

    initUIListeners();
    await loadRoutes();
}

async function apiCall(endpoint, method = 'GET', body = null) {
    let token = localStorage.getItem('auth_token') || "";
    token = token.replace(/^["']|["']$/g, '').trim();

    const headers = {
        'Accept': '*/*',
        'Authorization': token,
        'Content-Type': 'application/json'
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null
    });

    if (response.status === 401) {
        window.location.href = 'login.html';
        return null;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

async function loadRoutes() {
    try {
        const data = await apiCall('/NetworkStates/get');
        allRoutes = data.routes || [];
        renderSidebarList();
    } catch (e) { console.error("Ошибка загрузки:", e); }
}

function renderSidebarList() {
    const container = document.querySelector('.list.flex-column');
    container.innerHTML = '';

    allRoutes.forEach(route => {
        const isSelected = selectedRoutes.has(route.name);
        const art = document.createElement('article');
        art.className = `list-entry flex-column ${isSelected ? 'active' : ''}`;
        
        art.innerHTML = `
            <div class="route-info">
                <h4>Маршрут ${route.name}</h4>
                <p>[${route.fromStation || ''} - ${route.toStation || ''}]</p>
            </div>
            <div class="route-status ${route.state ? 'status-working' : 'status-stopped'}">
                ${route.state ? '● Работает' : '● Остановлен'}
            </div>
        `;

        art.onclick = () => toggleSelection(route.name);
        container.appendChild(art);
    });
}

function toggleSelection(name) {
    if (selectedRoutes.has(name)) {
        selectedRoutes.delete(name);
    } else {
        selectedRoutes.add(name);
    }
    renderSidebarList();
    renderChips();
}

function renderChips() {
    const container = document.getElementById('selected-routes-container');
    container.innerHTML = '';

    selectedRoutes.forEach(name => {
        const chip = document.createElement('article');
        chip.className = 'route-chip';
        chip.innerHTML = `
            <p class="route-chip-number">${name}</p>
            <svg class="close-chip" data-name="${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M18 6L6 18M6 6L18 18" stroke-width="3" stroke-linecap="round"/>
            </svg>
        `;
        
        chip.querySelector('.close-chip').onclick = (e) => {
            e.stopPropagation();
            toggleSelection(name);
        };
        container.appendChild(chip);
    });
}

function initUIListeners() {
    const btnStopped = document.querySelector('#new-state-buttons button:first-child');
    const btnWorking = document.querySelector('#new-state-buttons button:last-child');
    const btnSave = document.querySelector('#control-buttons button:last-child');
    const btnClear = document.querySelector('#control-buttons button:first-child');
    const reasonArea = document.getElementById('update-reason-text');

    btnStopped.onclick = () => {
        newState = false;
        btnStopped.classList.add('active-stopped');
        btnWorking.classList.remove('active-working');
    };

    btnWorking.onclick = () => {
        newState = true;
        btnWorking.classList.add('active-working');
        btnStopped.classList.remove('active-stopped');
    };

    btnClear.onclick = () => {
        selectedRoutes.clear();
        reasonArea.value = '';
        renderSidebarList();
        renderChips();
    };

    btnSave.onclick = async () => {
        if (selectedRoutes.size === 0) {
            alert("Выберите хотя бы один маршрут из списка слева");
            return;
        }

        btnSave.disabled = true;
        btnSave.textContent = "Синхронизация...";

        const reasonValue = reasonArea.value.trim() || null;

        const routesPayload = Array.from(selectedRoutes).map(name => ({
            name: name,
            state: newState,
            reason: reasonValue
        }));

        const finalPayload = {
            routes: routesPayload,
            batchState: newState,
            batchReason: reasonValue
        };

        try {
            await apiCall('/NetworkStates/batch', 'PATCH', finalPayload);
            alert(`Успешно обновлено маршрутов: ${selectedRoutes.size}`);
            
            selectedRoutes.clear();
            reasonArea.value = '';
            await loadRoutes(); 
            renderChips();
        } catch (e) {
            alert("Ошибка при массовом обновлении");
        } finally {
            btnSave.disabled = false;
            btnSave.textContent = "Сохранить";
        }
    };
}

initTrafficPage();