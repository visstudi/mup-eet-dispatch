let allRoutes = []; 
let currentRouteData = null; 
let tempScheduleItem = {}; 

document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    const token = localStorage.getItem('auth_token');
    if (!token || token === "undefined") {
        window.location.href = 'login.html'; 
        return; 
    }
    initUI();
    initOverlayWizard(); 
    initCreateOverlay();
    await fetchRoutes();
}

async function apiCall(endpoint, method = 'GET', body = null) {
    let rawToken = localStorage.getItem('auth_token') || "";
    let cleanToken = rawToken.replace(/^["']|["']$/g, '').trim();
    
    const headers = { 
        'Accept': '*/*', 
        'Authorization': cleanToken, 
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
        if (!response.ok) throw new Error(text || response.status);
        try { return JSON.parse(text); } catch(e) { return text; }
    } catch (e) { throw e; }
}

async function fetchRoutes() {
    try {
        const data = await apiCall('/NetworkStates/get');
        allRoutes = data.routes || [];
        renderRouteList();
        if (allRoutes.length > 0 && !currentRouteData) selectRoute(allRoutes[0].name);
    } catch (e) { console.error("Ошибка загрузки данных"); }
}

function renderRouteList() {
    const container = document.querySelector('.list.flex-column');
    container.innerHTML = '';
    allRoutes.forEach(route => {
        const art = document.createElement('article');
        art.className = `list-entry ${currentRouteData?.name === route.name ? 'active' : ''}`;
        art.innerHTML = `
            <div class="route-info">
                <h4>Маршрут ${route.name}</h4>
                <p>[${route.fromStation || ''} - ${route.toStation || ''}]</p>
            </div>
            <img src="../assets/icons/right.svg" alt="" />
        `;
        art.onclick = () => selectRoute(route.name);
        container.appendChild(art);
    });
}

function selectRoute(name) {
    const original = allRoutes.find(r => r.name === name);
    if (!original) return;
    currentRouteData = JSON.parse(JSON.stringify(original));
    renderRouteList();

    const panel = document.querySelector('.modify-route-info');
    panel.querySelector('#color-preview div').textContent = currentRouteData.name;
    
    const hex = currentRouteData.color.startsWith('#') ? currentRouteData.color : `#${currentRouteData.color}`;
    panel.querySelector('#color-input-text').value = hex;
    updateColorPreview(hex, panel); 

    panel.querySelector('#stop-first input').value = currentRouteData.fromStation || '';
    panel.querySelector('#stop-last input').value = currentRouteData.toStation || '';
    
    applyPriceLabels(currentRouteData.routeType, panel);
    panel.querySelector('#price-first input').value = currentRouteData.priceLow || 0;
    panel.querySelector('#price-second input').value = currentRouteData.priceHigh || 0;
    
    panel.querySelector('#map-link input').value = currentRouteData.yandexMapLink || '';

    renderScheduleTable();
}

function updateColorPreview(hex, container) {
    if (!/^#[0-9A-F]{6}$/i.test(hex)) return;
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    const colorSection = container.querySelector('#route-color') || container.querySelector('#route-number-color');
    if (colorSection) colorSection.style.setProperty('--current-color', `${r} ${g} ${b}`);
    const cp = container.querySelector('#color-input-preview');
    if (cp) cp.style.backgroundColor = hex;
}

function applyPriceLabels(type, container) {
    const dropdown = container.querySelector('#price-variation');
    dropdown.setAttribute('data-current-type', type);
    dropdown.querySelector('.dropdown-choice').textContent = type == 0 ? "По способу оплаты" : "По городам";
    container.querySelector('#price-first h3').textContent = type == 0 ? "Наличный способ" : "По городу";
    container.querySelector('#price-second h3').textContent = type == 0 ? "Безналичный способ" : "Межгород";
}

function renderScheduleTable() {
    const tbody = document.querySelector('#route-schedule tbody');
    tbody.innerHTML = '';
    const table = currentRouteData.scheduleTable || [];
    const sorted = [...table].sort((a, b) => (a.startRange || "").localeCompare(b.startRange || ""));

    sorted.forEach((item, index) => {
        const isDuty = item.interval === -1;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${(item.startRange || '00:00').slice(0,5)} - ${(item.endRange || '...').slice(0,5)}</td>
            <td>${item.annotation || '-'}</td>
            <td>${isDuty ? '-' : (item.interval || 0) + ' мин.'}</td>
            <td><input type="checkbox" ${isDuty ? 'checked' : ''} class="duty-check" data-idx="${index}"></td>
            <td><a href="#" style="color:#e93e3e" class="del-row" data-idx="${index}">Удалить</a></td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.duty-check').forEach(chk => {
        chk.onchange = (e) => {
            sorted[e.target.dataset.idx].interval = e.target.checked ? -1 : 10;
            currentRouteData.scheduleTable = sorted;
            renderScheduleTable();
        };
    });
    tbody.querySelectorAll('.del-row').forEach(lnk => {
        lnk.onclick = (e) => {
            e.preventDefault();
            sorted.splice(lnk.dataset.idx, 1);
            currentRouteData.scheduleTable = sorted;
            renderScheduleTable();
        };
    });
}

async function saveAllData() {
    if (!currentRouteData) return;
    const btn = document.querySelector('#route-control-buttons button:last-child');
    btn.disabled = true; btn.textContent = "Сохранение...";
    const panel = document.querySelector('.modify-route-info');

    try {
        const safeSchedule = currentRouteData.scheduleTable.map(item => ({
            startRange: item.startRange || "00:00:00",
            endRange: item.endRange || null,
            annotation: item.annotation || null,
            interval: item.interval || 0
        }));

        await apiCall('/Schedule/update', 'POST', {
            route: currentRouteData.name,
            scheduleTable: safeSchedule 
        });

        let mapUrl = panel.querySelector('#map-link input').value.trim();
        if (mapUrl && !mapUrl.startsWith("https://yandex.ru/maps/")) {
            throw new Error("Ссылка на карту должна начинаться с https://yandex.ru/maps/");
        }

        const payload = {
            name: currentRouteData.name,
            color: panel.querySelector('#color-input-text').value.trim(),
            fromStation: panel.querySelector('#stop-first input').value.trim(),
            toStation: panel.querySelector('#stop-last input').value.trim(),
            routeType: parseInt(panel.querySelector('#price-variation').getAttribute('data-current-type')) || 0,
            priceLow: parseInt(panel.querySelector('#price-first input').value) || 0,
            priceHigh: parseInt(panel.querySelector('#price-second input').value) || 0,
            map: mapUrl ? 2 : 0,
            yandexMapLink: mapUrl || null
        };

        await apiCall('/NetworkStates/edit', 'PATCH', payload);
        alert("Успешно сохранено!");
        await fetchRoutes();
    } catch (e) { alert("Ошибка: " + e.message); } 
    finally { btn.disabled = false; btn.textContent = "Сохранить"; }
}

function initUI() {
    document.querySelectorAll(".dropdown-button").forEach((btn) => {
        btn.onclick = () => {
            const menu = btn.nextElementSibling;
            document.querySelectorAll(".dropdown-content").forEach((c) => {
                if (c !== menu) c.style.maxHeight = null;
            });
            menu.style.maxHeight = menu.style.maxHeight ? null : `${menu.scrollHeight}px`;
        };
    });

    document.querySelectorAll(".dropdown-content div").forEach((div) => {
        div.onclick = function () {
            const txt = this.textContent.trim();
            if (!txt) return;

            const drop = this.closest(".dropdown");
            drop.querySelector(".dropdown-choice").textContent = txt;

            if (drop.closest("#price-variation")) {
                const panel = this.closest(".modify-route-info") || this.closest(".overlay");
                const typeVal = txt === "По способу оплаты" ? 0 : 1;
                applyPriceLabels(typeVal, panel);
                drop.setAttribute("data-current-type", typeVal);
            }

            if (drop.closest("#time-value-type")) {
                const tRange = document.getElementById("time-interval");
                const tPrecise = document.getElementById("precise-time");
                if (txt === "Точное время") {
                    tRange.style.display = "none";
                    tPrecise.style.display = "flex";
                } else {
                    tRange.style.display = "flex";
                    tPrecise.style.display = "none";
                }
            }

            if (drop.closest("#period-value-type")) {
                const pRange = document.getElementById("period-interval");
                const pPrecise = document.getElementById("precise-period");
                if (txt === "Точный интервал") {
                    pRange.style.display = "none";
                    pPrecise.style.display = "flex";
                } else if (txt === "Дежурный") {
                    pRange.style.display = "none";
                    pPrecise.style.display = "none";
                } else { 
                    pRange.style.display = "flex";
                    pPrecise.style.display = "none";
                }
            }

            this.parentElement.style.maxHeight = null; 
        };
    });

    document.querySelectorAll('.form-control-buttons button[type="button"]').forEach((btn) => {
        btn.onclick = () => btn.closest(".overlay").classList.add("hidden");
    });

    document.querySelector("#route-control-buttons button:last-child").onclick = saveAllData;
    document.querySelector("#route-control-buttons button:first-child").onclick = async () => {
        if (confirm("Удалить маршрут?")) {
            await apiCall(`/NetworkStates/remove?routeName=${currentRouteData.name}`, "DELETE");
            currentRouteData = null;
            await fetchRoutes();
        }
    };

    document.getElementById("color-input-text").oninput = (e) =>
        updateColorPreview(e.target.value, document.querySelector(".modify-route-info"));
}

function formatTime(t) {
    if (!t || t.trim() === "") return null; 
    let p = t.split(":");
    let h = parseInt(p[0]) || 0;
    let m = parseInt(p[1]) || 0;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

function initOverlayWizard() {
    const oTime = document.getElementById('overlay-route-time');
    const oNote = document.getElementById('overlay-route-note');
    const oPeriod = document.getElementById('overlay-route-period');
    
    document.querySelector('#route-schedule tfoot button').onclick = () => {
        tempScheduleItem = {};
        [oTime, oNote, oPeriod].forEach(o => o.querySelector('form').reset());
        
        oTime.querySelector('.dropdown-choice').textContent = "Диапазон времени";
        document.getElementById('time-interval').style.display = 'flex';
        document.getElementById('precise-time').style.display = 'none';
        
        oPeriod.querySelector('.dropdown-choice').textContent = "Диапазон времени";
        document.getElementById('period-interval').style.display = 'flex';
        document.getElementById('precise-period').style.display = 'none';

        oTime.classList.remove('hidden');
    };

    oTime.querySelector('form').onsubmit = (e) => {
        e.preventDefault();
        const choice = oTime.querySelector('.dropdown-choice').textContent.trim();
        if (choice === "Точное время") {
            tempScheduleItem.startRange = formatTime(document.getElementById('precise-time-text').value) || "00:00:00";
            tempScheduleItem.endRange = null;
        } else {
            tempScheduleItem.startRange = formatTime(document.getElementById('from-time-text').value) || "00:00:00";
            tempScheduleItem.endRange = formatTime(document.getElementById('to-time-text').value);
        }
        oTime.classList.add('hidden'); oNote.classList.remove('hidden');
    };

    oNote.querySelector('form').onsubmit = (e) => {
        e.preventDefault();
        tempScheduleItem.annotation = document.getElementById('note-text').value || null;
        oNote.classList.add('hidden'); oPeriod.classList.remove('hidden');
    };

    oPeriod.querySelector('form').onsubmit = (e) => {
        e.preventDefault();
        const type = oPeriod.querySelector('.dropdown-choice').textContent.trim();
        if (type === "Дежурный") tempScheduleItem.interval = -1;
        else if (type === "Точный интервал") tempScheduleItem.interval = parseInt(document.getElementById('precise-period-text').value) || 0;
        else tempScheduleItem.interval = parseInt(document.getElementById('period-interval').querySelector('input').value) || 0;

        currentRouteData.scheduleTable.push(tempScheduleItem);
        renderScheduleTable();
        oPeriod.classList.add('hidden');
    };
}

function initCreateOverlay() {
    const overlay = document.getElementById('overlay-route-create');
    
    const picker = overlay.querySelector('#color-picker-hidden');
    const textInput = overlay.querySelector('#color-input-text');
    if (picker && textInput) {
        picker.addEventListener('input', (e) => {
            textInput.value = e.target.value.toUpperCase();
            updateColorPreview(e.target.value, overlay);
        });
    }

    document.getElementById('create-route-button').onclick = () => {
        overlay.querySelector('form').reset();
        overlay.classList.remove('hidden');
    };
    
    overlay.querySelector('form').onsubmit = async (e) => {
        e.preventDefault();
        const name = overlay.querySelector('#route-number-text').value.trim();
        const payload = {
            name: name,
            color: overlay.querySelector('#color-input-text').value.trim() || "#3E8DE9",
            fromStation: overlay.querySelector('#stop-first input').value.trim(),
            toStation: overlay.querySelector('#stop-last input').value.trim(),
            routeType: 0, priceLow: 0, priceHigh: 0, map: 0, yandexMapLink: null
        };
        await apiCall('/NetworkStates/create', 'POST', payload);
        overlay.classList.add('hidden');
        await fetchRoutes();
        selectRoute(name);
    };
}