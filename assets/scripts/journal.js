let allLogs = [];
let usersMap = {};

document.addEventListener('DOMContentLoaded', initJournalPage);

async function initJournalPage() {
    const token = localStorage.getItem('auth_token');
    if (!token || token === "undefined") {
        window.location.href = 'login.html'; 
        return; 
    }
    initUI();
    
    await Promise.all([fetchLogs(), fetchUsersMap()]);
}

async function apiCall(endpoint) {
    let rawToken = localStorage.getItem('auth_token') || "";
    let cleanToken = rawToken.replace(/^["']|["']$/g, '').trim();

    const headers = { 'Accept': '*/*', 'Authorization': cleanToken };

    try {
        const response = await fetch(`${API_URL}${endpoint}`, { method: 'GET', headers });
        if (response.status === 401) {
            localStorage.removeItem('auth_token');
            window.location.href = 'login.html';
            return null;
        }
        if (!response.ok) throw new Error(response.status);
        const text = await response.text();
        return JSON.parse(text);
    } catch (e) {
        console.error("Fetch error:", e);
        throw e;
    }
}

async function fetchLogs() {
    try {
        const data = await apiCall('/Events/getAllLogs');
        allLogs = Array.isArray(data) ? data : [];
        allLogs.sort((a, b) => b.id - a.id);
        renderTable();
    } catch (e) { console.error("Ошибка загрузки журнала", e); }
}

async function fetchUsersMap() {
    try {
        const users = await apiCall('/Authorization/getAllUsers');
        if (Array.isArray(users)) {
            users.forEach(u => {
                usersMap[u.id] = getRoleName(u.permLevel);
            });
        }
    } catch (e) { console.warn("Не удалось подгрузить должности пользователей"); }
}

function getRoleName(level) {
    if (level === 0) return "Администратор";
    if (level === 1) return "Диспетчер";
    return "Водитель";
}

function formatDateTime(isoString) {
    if (!isoString) return "-";
    const d = new Date(isoString);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function translateAction(action, entity) {
    let act = action;
    if (action === "Update") act = "Обновление";
    if (action === "Create") act = "Создание";
    if (action === "Delete" || action === "remove") act = "Удаление";
    if (action === "Edit") act = "Изменение";
    
    let ent = entity || "";
    if (entity === "Route") ent = "информации о маршруте";
    if (entity === "User") ent = "аккаунта пользователя";
    if (entity === "Schedule") ent = "расписания маршрута";
    if (entity === "NetworkState") ent = "статуса движения";
    
    return `${act} ${ent}`.trim();
}

function formatLogDetails(entityDataString, entityType) {
    if (!entityDataString) return "Нет дополнительных подробностей.";

    try {
        const data = JSON.parse(entityDataString);
        let output = "";

        if (data.Routes && Array.isArray(data.Routes)) {
            output += "Изменен статус маршрутов:\n\n";
            data.Routes.forEach(r => {
                const status = r.State ? "🟢 Работает" : "🔴 Остановлен";
                const reason = r.Reason ? `\n   Причина: ${r.Reason}` : "";
                output += `• Маршрут ${r.Name}: ${status}${reason}\n\n`;
            });
            return output.trim();
        }

        if (entityType === "Schedule" && data.ScheduleTable !== undefined) {
            output += `Расписание для маршрута: ${data.Route || '?'}\n\n`;
            
            if (data.ScheduleTable.length === 0) {
                return output + "Расписание пустое (все рейсы удалены).";
            }

            data.ScheduleTable.forEach((item, idx) => {
                const start = item.StartRange ? item.StartRange.slice(0, 5) : "00:00";
                const end = item.EndRange ? item.EndRange.slice(0, 5) : "...";
                
                let intervalStr = "";
                if (item.Interval === -1) intervalStr = "[Дежурный]";
                else if (item.Interval === 0) intervalStr = "[Точное время]";
                else intervalStr = `[Каждые ${item.Interval} мин.]`;

                const note = item.Annotation ? ` (Примечание: ${item.Annotation})` : "";

                output += `${idx + 1}. Время: ${start} - ${end}  ${intervalStr}${note}\n`;
            });
            return output.trim();
        }

        if (entityType === "Route" && data.Name && data.Color) {
            output += `Параметры маршрута: ${data.Name}\n`;
            output += `--------------------------\n`;
            output += `Остановки: ${data.FromStation || '?'} — ${data.ToStation || '?'}\n`;
            
            const rType = data.RouteType === 0 ? "Городской" : "Пригородный";
            output += `Тип маршрута: ${rType}\n`;
            
            if (data.PriceLow || data.PriceHigh) {
                output += `Стоимость: от ${data.PriceLow} до ${data.PriceHigh} руб.\n`;
            }
            
            output += `Цвет (HEX): ${data.Color}\n`;
            output += `Наличие карты: ${data.Map === 2 ? 'Да' : 'Нет'}\n`;
            
            return output.trim();
        }

        for (const [key, value] of Object.entries(data)) {
            if (value !== null && value !== "") {
                output += `${key}: ${value}\n`;
            }
        }
        
        return output.trim() || "Нет данных для отображения.";

    } catch (e) {
        return `Информация: ${entityDataString}`;
    }
}

function renderTable() {
    const tbody = document.querySelector('#journal-table tbody');
    tbody.innerHTML = '';

    allLogs.forEach(log => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDateTime(log.timestamp)}</td>
            <td>${translateAction(log.action, log.entityType)}</td>
            <td><a onclick="openLogDetails(${log.id})" style="cursor:pointer; font-weight:bold; color:#3e8de9;">Открыть</a></td>
        `;
        tbody.appendChild(tr);
    });
}

window.openLogDetails = (logId) => {
    const log = allLogs.find(l => l.id === logId);
    if (!log) return;

    const overlay = document.getElementById('overlay-log-details');
    
    document.getElementById('log-user-name').value = log.userName || 'Система';
    document.getElementById('log-user-id').value = log.userId || '-';
    document.getElementById('log-user-role').value = usersMap[log.userId] || 'Сотрудник';
    document.getElementById('log-time').value = formatDateTime(log.timestamp);
    document.getElementById('log-action').value = translateAction(log.action, log.entityType);
    
    document.getElementById('log-details-text').value = formatLogDetails(log.entityData, log.entityType);

    overlay.classList.remove('hidden');
};

function initUI() {
    document.getElementById('close-log-btn').onclick = () => {
        document.getElementById('overlay-log-details').classList.add('hidden');
    };
}