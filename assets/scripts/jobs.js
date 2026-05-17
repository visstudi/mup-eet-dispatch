const API_URL = "";
let allJobs = [];
let currentJobId = null;

document.addEventListener('DOMContentLoaded', initJobsPage);

async function initJobsPage() {
    const token = localStorage.getItem('auth_token');
    if (!token || token === "undefined") { window.location.href = 'login.html'; return; }
    initUI();
    await fetchJobs();
}

async function apiCall(endpoint, method = 'GET', body = null) {
    let rawToken = localStorage.getItem('auth_token') || "";
    let cleanToken = rawToken.replace(/^["']|["']$/g, '').trim();
    const headers = { 'Accept': '*/*', 'Authorization': cleanToken, 'Content-Type': 'application/json' };
    const response = await fetch(`${API_URL}${endpoint}`, { method, headers, body: body ? JSON.stringify(body) : null });
    if (response.status === 401) { window.location.href = 'login.html'; return null; }
    const text = await response.text();
    if (!response.ok) throw new Error(text || response.status);
    return text ? JSON.parse(text) : null;
}

async function fetchJobs() {
    try {
        const data = await apiCall('/Vacancy/get');
        allJobs = data.vacancies || [];
        renderList();
        if (allJobs.length > 0 && !currentJobId) selectJob(allJobs[0].id);
    } catch (e) { console.error(e); }
}

function renderList() {
    const container = document.querySelector('.list.flex-column');
    container.innerHTML = '';
    allJobs.forEach(job => {
        const art = document.createElement('article');
        art.className = `list-entry ${currentJobId === job.id ? 'active' : ''}`;
        art.innerHTML = `<div class="route-info"><h4>${job.profession}</h4></div>`;
        art.onclick = () => selectJob(job.id);
        container.appendChild(art);
    });
}

function getScheduleText(val) {
    if (val === 0) return "Сменный";
    if (val === 1) return "5/2";
    if (val === 2) return "По графику";
    return "По графику";
}

function getSalaryTypeText(val) {
    if (val === 0) return "Фиксированная";
    if (val === 1) return "От";
    if (val === 2) return "От - До";
    if (val === 3) return "Сдельная";
    return "От - До";
}

function updateSalaryUI(typeVal, container) {
    const fromField = container.querySelector('#from-salary');
    const toField = container.querySelector('#to-salary');
    const salaryRow = container.querySelector('#salary-inputs-row') || container.querySelector('#job-salary');

    if (typeVal === 3) {
        if (fromField) fromField.style.display = 'none';
        if (toField) toField.style.display = 'none';
    } else if (typeVal === 0 || typeVal === 1) { 
        if (fromField) {
            fromField.style.display = 'flex';
            fromField.querySelector('h3').textContent = (typeVal === 0) ? "Оклад:" : "От:";
        }
        if (toField) toField.style.display = 'none';
    } else { 
        if (fromField) {
            fromField.style.display = 'flex';
            fromField.querySelector('h3').textContent = "От:";
        }
        if (toField) toField.style.display = 'flex';
    }
}

function selectJob(id) {
    const job = allJobs.find(j => j.id === id);
    if (!job) return;
    currentJobId = id;
    renderList();
    fillData(document.querySelector('.modify-job-info'), job);
}

function fillData(container, data) {
    container.querySelector('#job-title input').value = data.profession || '';
    container.querySelector('#from-salary input').value = data.salaryMin || 0;
    container.querySelector('#to-salary input').value = data.salaryMax || 0;
    
    const reqs = container.querySelector('#job-requirements textarea');
    const info = container.querySelector('#job-additional-info textarea');
    if(reqs) reqs.value = data.requirements || '';
    if(info) info.value = data.additionalInfo || '';

    const schedDrop = container.querySelector('#job-schedule .dropdown');
    schedDrop.querySelector('.dropdown-choice').textContent = getScheduleText(data.workSchedule);
    schedDrop.setAttribute('data-value', data.workSchedule);

    const salDrop = container.querySelector('#salary-type .dropdown');
    salDrop.querySelector('.dropdown-choice').textContent = getSalaryTypeText(data.salaryType);
    salDrop.setAttribute('data-value', data.salaryType);

    updateSalaryUI(data.salaryType, container);
}

async function handleSave(isNew) {
    const container = isNew ? document.getElementById('overlay-job-create') : document.querySelector('.modify-job-info');
    const salType = parseInt(container.querySelector('#salary-type .dropdown').getAttribute('data-value'));

    let sMin = parseInt(container.querySelector('#from-salary input').value) || 0;
    let sMax = parseInt(container.querySelector('#to-salary input').value) || 0;
    
    if (salType === 3) { sMin = 0; sMax = 0; } 
    else if (salType === 1 || salType === 0) { sMax = 0; }

    const payload = {
        profession: container.querySelector('#job-title input').value.trim(),
        salaryType: salType,
        salaryMin: sMin,
        salaryMax: sMax,
        workSchedule: parseInt(container.querySelector('#job-schedule .dropdown').getAttribute('data-value')),
        requirements: container.querySelector('#job-requirements textarea').value.trim(),
        additionalInfo: container.querySelector('#job-additional-info textarea').value.trim()
    };
    if (!isNew) payload.id = currentJobId;

    try {
        await apiCall(isNew ? '/Vacancy/create' : '/Vacancy/edit', isNew ? 'POST' : 'PATCH', payload);
        if (isNew) document.getElementById('overlay-job-create').classList.add('hidden');
        alert("Сохранено!");
        await fetchJobs();
    } catch (e) { alert("Ошибка: " + e.message); }
}

function initUI() {
    document.querySelectorAll('.dropdown-button').forEach(btn => {
        btn.onclick = () => {
            const menu = btn.nextElementSibling;
            document.querySelectorAll('.dropdown-content').forEach(c => { if(c!==menu) c.style.maxHeight = null; });
            menu.style.maxHeight = menu.style.maxHeight ? null : "200px";
        };
    });

    document.querySelectorAll('.dropdown-content div').forEach(div => {
        div.onclick = () => {
            const txt = div.textContent.trim();
            if (!txt) return;
            const drop = div.closest('.dropdown');
            drop.querySelector('.dropdown-choice').textContent = txt;
            
            let val = 0;
            if (drop.closest('#job-schedule')) {
                const sMap = {"Сменный": 0, "5/2": 1, "По графику": 2};
                val = sMap[txt] || 0;
            }
            if (drop.closest('#salary-type')) {
                const tMap = {"Фиксированная": 0, "От": 1, "От - До": 2, "Сдельная": 3};
                val = tMap[txt] !== undefined ? tMap[txt] : 2;
                updateSalaryUI(val, div.closest('form') || div.closest('.modify-job-info'));
            }
            drop.setAttribute('data-value', val);
            div.parentElement.style.maxHeight = null;
        };
    });

    document.getElementById('create-job-button').onclick = () => {
        const o = document.getElementById('overlay-job-create');
        o.querySelector('form').reset();
        fillData(o, { salaryType: 2, workSchedule: 2 });
        o.classList.remove('hidden');
    };

    document.querySelectorAll('.form-control-buttons button[type="button"]').forEach(btn => {
        btn.onclick = () => btn.closest('.overlay').classList.add('hidden');
    });

    document.querySelector('.modify-control-buttons button:last-child').onclick = () => handleSave(false);
    document.querySelector('#overlay-job-create form').onsubmit = (e) => { e.preventDefault(); handleSave(true); };
    
    document.querySelector('.modify-control-buttons button:first-child').onclick = async () => {
        if (currentJobId && confirm("Удалить?")) {
            await apiCall(`/Vacancy/remove?id=${currentJobId}`, 'DELETE');
            currentJobId = null;
            await fetchJobs();
        }
    };
}