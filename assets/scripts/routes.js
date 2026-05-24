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
    if (!container) return; 
    
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
    if (!panel) return;

    const previewDiv = panel.querySelector('#color-preview div');
    if (previewDiv) previewDiv.textContent = currentRouteData.name;
    
    const hex = currentRouteData.color.startsWith('#') ? currentRouteData.color : `#${currentRouteData.color}`;
    const colorInput = panel.querySelector('#color-input-text');
    if (colorInput) colorInput.value = hex;
    updateColorPreview(hex, panel); 

    const stopFirst = panel.querySelector('#stop-first input');
    const stopLast = panel.querySelector('#stop-last input');
    if (stopFirst) stopFirst.value = currentRouteData.fromStation || '';
    if (stopLast) stopLast.value = currentRouteData.toStation || '';
    
    applyPriceLabels(currentRouteData.routeType, panel);
    
    const priceFirst = panel.querySelector('#price-first input');
    const priceSecond = panel.querySelector('#price-second input');
    if (priceFirst) priceFirst.value = currentRouteData.priceLow || 0;
    if (priceSecond) priceSecond.value = currentRouteData.priceHigh || 0;
    
    const mapInput = panel.querySelector('#map-link input');
    if (mapInput) mapInput.value = currentRouteData.yandexMapLink || '';

    const mapChoice = panel.querySelector('#map-variation .dropdown-choice');
    if (mapChoice) mapChoice.textContent = currentRouteData.yandexMapLink ? "Я.Карты" : "Скрыть";

    renderScheduleTable();
}

function updateColorPreview(hex, container) {
    if (!container || !/^#[0-9A-F]{6}$/i.test(hex)) return;
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    const colorSection = container.querySelector('#route-color') || container.querySelector('#route-number-color');
    if (colorSection) colorSection.style.setProperty('--current-color', `${r} ${g} ${b}`);
    const cp = container.querySelector('#color-input-preview');
    if (cp) cp.style.backgroundColor = hex;

    const picker = container.querySelector('#color-picker-hidden');
    if (picker) picker.value = hex; 
}

function applyPriceLabels(type, container) {
    const dropdown = container.querySelector('#price-variation');
    if (!dropdown) return;
    dropdown.setAttribute('data-current-type', type);
    const choice = dropdown.querySelector('.dropdown-choice');
    if (choice) choice.textContent = type == 0 ? "По способу оплаты" : "По городам";
    
    const hFirst = container.querySelector('#price-first h3');
    const hSecond = container.querySelector('#price-second h3');
    if (hFirst) hFirst.textContent = type == 0 ? "Наличный способ" : "По городу";
    if (hSecond) hSecond.textContent = type == 0 ? "Безналичный способ" : "Межгород";
}

function renderScheduleTable() {
    const tbody = document.querySelector('#route-schedule tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const table = currentRouteData.scheduleTable || [];
    const sorted = [...table].sort((a, b) => (a.startRange || "").localeCompare(b.startRange || ""));

    sorted.forEach((item, index) => {
        const isDuty = item.interval === -1;
        const start = item.startRange ? item.startRange.slice(0, 5) : "00:00";
        let timeText = start;
        if (item.endRange) {
            timeText += ` - ${item.endRange.slice(0, 5)}`;
        }
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${timeText}</td>
            <td>${item.annotation || '-'}</td>
            <td>${isDuty ? '-' : (item.interval || 0) + ' мин.'}</td>
            <td><input type="checkbox" ${isDuty ? 'checked' : ''} class="duty-check" data-idx="${index}"></td>
            <td><a href="#" style="color:#e93e3e; text-decoration: none;" class="del-row" data-idx="${index}">Удалить</a></td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.duty-check').forEach(chk => {
        chk.onchange = (e) => {
            const idx = e.target.dataset.idx;
            const item = sorted[idx];

            if (e.target.checked) {
                if (item.interval !== -1) {
                    item._originalInterval = item.interval; 
                }
                item.interval = -1;
            } else {
                item.interval = item._originalInterval !== undefined ? item._originalInterval : 0;
            }

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
    if (!btn) return;
    
    btn.disabled = true; 
    btn.textContent = "Сохранение...";
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

        const mapInput = panel.querySelector('#map-link input');
        let mapUrl = mapInput ? mapInput.value.trim() : "";
        
        if (mapUrl && !mapUrl.startsWith("https://yandex.ru/maps/")) {
            throw new Error("Ссылка на карту должна начинаться с https://yandex.ru/maps/");
        }

        const payload = {
            name: currentRouteData.name,
            color: panel.querySelector('#color-input-text')?.value.trim() || "#000000",
            fromStation: panel.querySelector('#stop-first input')?.value.trim() || "",
            toStation: panel.querySelector('#stop-last input')?.value.trim() || "",
            routeType: parseInt(panel.querySelector('#price-variation')?.getAttribute('data-current-type')) || 0,
            priceLow: parseInt(panel.querySelector('#price-first input')?.value) || 0,
            priceHigh: parseInt(panel.querySelector('#price-second input')?.value) || 0,
            map: mapUrl ? 2 : 0,
            yandexMapLink: mapUrl || null
        };

        await apiCall('/NetworkStates/edit', 'PATCH', payload);
        alert("Успешно сохранено!");
        await fetchRoutes();
    } catch (e) { 
        alert("Ошибка: " + e.message); 
    } finally { 
        btn.disabled = false; 
        btn.textContent = "Сохранить"; 
    }
}

function initUI() {
    const mainPanelPicker = document.querySelector('.modify-route-info #color-picker-hidden');
    const mainPanelText = document.querySelector('.modify-route-info #color-input-text');
    if (mainPanelPicker && mainPanelText) {
        mainPanelPicker.addEventListener('input', (e) => {
            mainPanelText.value = e.target.value.toUpperCase();
            updateColorPreview(e.target.value, document.querySelector(".modify-route-info"));
        });
    }

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
                    if (tRange) tRange.style.display = "none";
                    if (tPrecise) tPrecise.style.display = "flex";
                } else {
                    if (tRange) tRange.style.display = "flex";
                    if (tPrecise) tPrecise.style.display = "none";
                }
            }

            if (drop.closest("#period-value-type")) {
                const pPrecise = document.getElementById("precise-period");
                if (txt === "Дежурный") {
                    if (pPrecise) pPrecise.style.display = "none";
                } else { 
                    if (pPrecise) pPrecise.style.display = "flex";
                }
            }

            this.parentElement.style.maxHeight = null; 
        };
    });

    document.querySelectorAll('.form-control-buttons button[type="button"]').forEach((btn) => {
        btn.onclick = () => btn.closest(".overlay").classList.add("hidden");
    });

    const saveBtn = document.querySelector("#route-control-buttons button:last-child");
    if (saveBtn) saveBtn.onclick = saveAllData;

    const delBtn = document.querySelector("#route-control-buttons button:first-child");
    if (delBtn) delBtn.onclick = async () => {
        if (confirm("Удалить маршрут?")) {
            await apiCall(`/NetworkStates/remove?routeName=${currentRouteData.name}`, "DELETE");
            currentRouteData = null;
            await fetchRoutes();
        }
    };

    const colorTextInput = document.getElementById("color-input-text");
    if (colorTextInput) colorTextInput.oninput = (e) =>
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
    
    if (!oTime || !oNote || !oPeriod) return; 

    const addBtn = document.querySelector('#route-schedule tfoot button');
    if (addBtn) {
        addBtn.onclick = () => {
            tempScheduleItem = {};
            [oTime, oNote, oPeriod].forEach(o => o.querySelector('form').reset());
            
            oTime.querySelector('.dropdown-choice').textContent = "Диапазон времени";
            document.getElementById('time-interval').style.display = 'flex';
            document.getElementById('precise-time').style.display = 'none';
            
            oPeriod.querySelector('.dropdown-choice').textContent = "Точный интервал";
            document.getElementById('precise-period').style.display = 'flex';

            oTime.classList.remove('hidden');
        };
    }

    const tForm = oTime.querySelector('form');
    if (tForm) {
        tForm.onsubmit = (e) => {
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
    }

    const nForm = oNote.querySelector('form');
    if (nForm) {
        nForm.onsubmit = (e) => {
            e.preventDefault();
            tempScheduleItem.annotation = document.getElementById('note-text').value || null;
            oNote.classList.add('hidden'); oPeriod.classList.remove('hidden');
        };
    }

    const pForm = oPeriod.querySelector('form');
    if (pForm) {
        pForm.onsubmit = (e) => {
            e.preventDefault();
            const type = oPeriod.querySelector('.dropdown-choice').textContent.trim();
            
            if (type === "Дежурный") {
                tempScheduleItem.interval = -1;
            } else {
                tempScheduleItem.interval = parseInt(document.getElementById('precise-period-text').value) || 0;
            }

            currentRouteData.scheduleTable.push(tempScheduleItem);
            renderScheduleTable();
            oPeriod.classList.add('hidden');
        };
    }
}

function initCreateOverlay() {
    const overlay = document.getElementById('overlay-route-create');
    if (!overlay) return;

    const picker = overlay.querySelector('#color-picker-hidden');
    const textInput = overlay.querySelector('#color-input-text');
    if (picker && textInput) {
        picker.addEventListener('input', (e) => {
            textInput.value = e.target.value.toUpperCase();
            updateColorPreview(e.target.value, overlay);
        });
    }

    const createBtn = document.getElementById('create-route-button');
    if (createBtn) {
        createBtn.onclick = () => {
            overlay.querySelector('form').reset();
            overlay.querySelector('.dropdown-choice').textContent = "По способу оплаты";
            overlay.querySelector('#price-variation').setAttribute('data-current-type', "0");
            applyPriceLabels(0, overlay);
            updateColorPreview("#3E8DE9", overlay);
            overlay.classList.remove('hidden');
        };
    }
    
    overlay.querySelector('form').onsubmit = async (e) => {
        e.preventDefault();
        const name = overlay.querySelector('#route-number-text').value.trim();
        const payload = {
            name: name,
            color: overlay.querySelector('#color-input-text').value.trim() || "#3E8DE9",
            fromStation: overlay.querySelector('#stop-first input').value.trim(),
            toStation: overlay.querySelector('#stop-last input').value.trim(),
            routeType: parseInt(overlay.querySelector('#price-variation').getAttribute('data-current-type')) || 0,
            priceLow: parseInt(overlay.querySelector('#price-first input').value) || 0,
            priceHigh: parseInt(overlay.querySelector('#price-second input').value) || 0,
            map: 0, yandexMapLink: null
        };
        await apiCall('/NetworkStates/create', 'POST', payload);
        overlay.classList.add('hidden');
        await fetchRoutes();
        selectRoute(name);
    };
}