let allRequests = [];
let isCreateMode = false;
let currentRequestId = null;

document.addEventListener('DOMContentLoaded', initRequestsPage);

async function initRequestsPage() {
    const token = localStorage.getItem('auth_token');
    if (!token) { window.location.href = 'login.html'; return; }
    initUI();
    await fetchRequests(false);
}

async function apiCall(endpoint, method = 'GET', body = null) {
    let rawToken = localStorage.getItem('auth_token') || "";
    let cleanToken = rawToken.replace(/^["']|["']$/g, '').trim();
    const headers = { 'Accept': '*/*', 'Authorization': cleanToken, 'Content-Type': 'application/json' };
    const response = await fetch(`${API_URL}${endpoint}`, { method, headers, body: body ? JSON.stringify(body) : null });
    if (response.status === 401) { window.location.href = 'login.html'; return null; }
    const text = await response.text();
    if (!response.ok) throw new Error(text || response.status);
    try { return JSON.parse(text); } catch(e) { return text; }
}

async function fetchRequests(onlyNew) {
    try {
        const data = await apiCall(`/Form/getAllForms?onlyNew=${onlyNew}`, 'POST', {});
        allRequests = data.forms || [];
        allRequests.sort((a, b) => new Date(b.dateSend) - new Date(a.dateSend));
        renderRequestsTable();
    } catch (e) { console.error("Ошибка загрузки"); }
}

function renderRequestsTable() {
    const tbody = document.querySelector('#requests-table tbody');
    tbody.innerHTML = '';
    
    allRequests.forEach(req => {
        const tr = document.createElement('tr');
        if (req.read) tr.classList.add('read-request');

        const date = new Date(req.dateSend).toLocaleDateString('ru-RU');
        const typeTexts = ["Жалоба", "Предложение", "Отклик на вакансию", "Прочее"];

        tr.innerHTML = `
            <td>
                <div class="indicator-box">${!req.read ? '<span class="blue-dot"></span>' : ''}</div>
                <strong style="font-weight: 800;">${typeTexts[req.type] || 'Жалоба'}:</strong> 
                <span style="font-weight: 500; margin-left: 5px;">${req.title}</span>
            </td>
            <td>${date}</td>
        `;
        tr.onclick = () => openRequestDetails(req.id);
        tbody.appendChild(tr);
    });
}

function openRequestDetails(id) {
    const req = allRequests.find(r => r.id === id);
    if (!req) return;
    isCreateMode = false; currentRequestId = id;
    const o = document.getElementById('overlay-request-details');
    
    document.getElementById('req-fio').value = req.fullName || '';
    document.getElementById('req-title').value = req.title || '';
    
    let phone = String(req.phone || '').replace(/\D/g, '');
    document.getElementById('req-phone').value = phone ? '+' + phone : '';
    
    const d = new Date(req.dateSend);
    const dtInput = document.getElementById('req-datetime');
    dtInput.type = "text"; dtInput.disabled = true;
    dtInput.value = d.toLocaleString('ru-RU');
    
    document.getElementById('req-bort').value = req.bortNumber || '';
    document.getElementById('req-text').value = req.description || '';

    const types = ["Жалоба", "Предложение", "Отклик на вакансию", "Прочее"];
    o.querySelector('#req-type-dropdown .dropdown-choice').textContent = types[req.type] || "Жалоба";
    o.querySelector('#req-type-dropdown').setAttribute('data-value', req.type);
    o.querySelector('#req-status-dropdown .dropdown-choice').textContent = req.read ? "Обработано" : "Не обработано";
    o.querySelector('#req-status-dropdown').setAttribute('data-value', req.read ? "true" : "false");

    o.classList.remove('hidden');
}

async function saveRequest() {
    const o = document.getElementById('overlay-request-details');
    const typeVal = parseInt(o.querySelector('#req-type-dropdown').getAttribute('data-value')) || 0;
    const isRead = o.querySelector('#req-status-dropdown').getAttribute('data-value') === "true";

    try {
        if (isCreateMode) {
            let digits = document.getElementById('req-phone').value.replace(/\D/g, '');

            if (digits.length !== 11) {
                alert("Номер телефона должен содержать 11 цифр");
                return;
            }

            const dtValue = document.getElementById('req-datetime').value;
            const timestamp = dtValue ? Math.floor(new Date(dtValue).getTime() / 1000) : Math.floor(Date.now() / 1000);

            const payload = {
                fullName: document.getElementById('req-fio').value.trim() || "Аноним",
                phone: digits,
                type: typeVal,
                bortNumber: document.getElementById('req-bort').value.trim() || "0000",
                incidentTime: timestamp, 
                incidentRoute: "000", 
                title: document.getElementById('req-title').value.trim() || "Без темы",
                description: document.getElementById('req-text').value.trim() || "Нет текста",
                smartToken: "web_admin"
            };
            await apiCall('/Form/create', 'POST', payload);
        } else {
            if (isRead) await apiCall(`/Form/read?formId=${currentRequestId}`, 'PATCH');
        }
        
        o.classList.add('hidden');
        await fetchRequests(document.getElementById('filter-only-new').checked);
    } catch (err) { alert("Ошибка: " + err.message); }
}

function initUI() {
    document.getElementById('filter-only-new').onchange = (e) => fetchRequests(e.target.checked);
    document.getElementById('btn-create-request').onclick = () => {
        isCreateMode = true;
        const o = document.getElementById('overlay-request-details');
        o.querySelector('form').reset();
        const dtInput = document.getElementById('req-datetime');
        dtInput.type = "datetime-local"; dtInput.disabled = false;
        o.classList.remove('hidden');
    };
    document.getElementById('btn-close-req').onclick = () => document.getElementById('overlay-request-details').classList.add('hidden');
    document.getElementById('overlay-request-details').querySelector('form').onsubmit = (e) => { e.preventDefault(); saveRequest(); };

    document.querySelectorAll('.dropdown-button').forEach(btn => {
        btn.onclick = () => {
            const menu = btn.nextElementSibling;
            document.querySelectorAll('.dropdown-content').forEach(c => { if(c!==menu) c.style.maxHeight = null; });
            menu.style.maxHeight = menu.style.maxHeight ? null : "150px";
        };
    });
    document.querySelectorAll('.dropdown-content div').forEach(div => {
        div.onclick = () => {
            const drop = div.closest('.dropdown');
            const val = div.getAttribute('data-val') || div.getAttribute('data-read');
            drop.querySelector('.dropdown-choice').textContent = div.textContent.trim();
            drop.setAttribute('data-value', val);
            div.parentElement.style.maxHeight = null;
        };
    });
}