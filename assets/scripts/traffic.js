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

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null
        });

        if (response.status === 401) {
            localStorage.removeItem('auth_token');
            window.location.href = 'login.html';
            return null;
        }

        const text = await response.text();
        return text ? JSON.parse(text) : null;
    } catch (e) {
        console.error("Ошибка сети:", e);
        throw e;
    }
}

async function loadRoutes() {
    try {
        const data = await apiCall('/NetworkStates/get');
        allRoutes = data.routes || [];
        renderSidebarList();
    } catch (e) { 
        console.error("Ошибка загрузки маршрутов:", e); 
    }
}

function renderSidebarList() {
    const container = document.querySelector('.list.flex-column');
    container.innerHTML = '';

    allRoutes.forEach(route => {
        const isSelected = selectedRoutes.has(route.name);
        const art = document.createElement('article');
        art.className = `list-entry flex-column ${isSelected ? 'active' : ''}`;
        
        const statusClass = route.state ? 'status-working' : 'status-stopped';
        const statusText = route.state ? '● Работает' : '● Остановлен';

        art.innerHTML = `
            <div class="route-info">
                <h4>Маршрут ${route.name}</h4>
                <p>[${route.fromStation || ''} - ${route.toStation || ''}]</p>
            </div>
            <div class="route-status ${statusClass}">
                ${statusText}
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
    if (!container) return;
    container.innerHTML = '';

    selectedRoutes.forEach(name => {
        const chip = document.createElement('article');
        chip.className = 'route-chip';
        chip.innerHTML = `
            <p class="route-chip-number">${name}</p>
            <svg class="close-chip" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="cursor:pointer; width:16px;">
                <path d="M18 6L6 18M6 6L18 18" stroke-width="3" stroke-linecap="round"/>
            </svg>
        `;
        
        chip.querySelector('svg').onclick = (e) => {
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
        if(reasonArea) reasonArea.value = '';
        renderSidebarList();
        renderChips();
    };

    btnSave.onclick = async () => {
        if (selectedRoutes.size === 0) {
            alert("Выберите хотя бы один маршрут");
            return;
        }

        btnSave.disabled = true;
        const oldText = btnSave.textContent;
        btnSave.textContent = "Сохранение...";

        const reasonValue = reasonArea ? reasonArea.value.trim() : null;

        const routesPayload = Array.from(selectedRoutes).map(name => ({
            name: name,
            state: newState,
            reason: reasonValue || null
        }));

        const finalPayload = {
            routes: routesPayload,
            batchState: newState,
            batchReason: reasonValue || null
        };

        try {
            await apiCall('/NetworkStates/batch', 'PATCH', finalPayload);
            alert("Статус обновлен");
            
            selectedRoutes.clear();
            if(reasonArea) reasonArea.value = '';
            await loadRoutes();
            renderChips();
        } catch (e) {
            alert("Ошибка при сохранении");
        } finally {
            btnSave.disabled = false;
            btnSave.textContent = oldText;
        }
    };
}