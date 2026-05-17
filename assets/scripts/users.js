const API_URL = "";
let allUsers = [];
let editingUserId = null; 

document.addEventListener('DOMContentLoaded', initUsersPage);

async function initUsersPage() {
    const token = localStorage.getItem('auth_token');
    if (!token || token === "undefined") {
        window.location.href = 'login.html'; 
        return; 
    }
    initUI();
    await fetchUsers();
}

async function apiCall(endpoint, method = 'GET', body = null) {
    let rawToken = localStorage.getItem('auth_token') || "";
    let cleanToken = rawToken.replace(/^["']|["']$/g, '').trim();

    const headers = { 'Accept': '*/*', 'Authorization': cleanToken };
    if (body) headers['Content-Type'] = 'application/json';

    try {
        const response = await fetch(`${API_URL}${endpoint}`, { method, headers, body: body ? JSON.stringify(body) : null });

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

async function fetchUsers() {
    try {
        const data = await apiCall('/Authorization/getAllUsers');
        allUsers = Array.isArray(data) ? data : [];
        renderUsersTable(allUsers);
    } catch (e) { console.error("Ошибка загрузки", e); }
}

function getRoleName(level) {
    if (level === 0) return "Администратор";
    if (level === 1) return "Диспетчер";
    return "Водитель";
}

function renderUsersTable(usersArray) {
    const tbody = document.querySelector('#users-table tbody');
    tbody.innerHTML = '';

    usersArray.forEach(user => {
        const tr = document.createElement('tr');
        if (!user.active) tr.classList.add('user-inactive'); 

        tr.innerHTML = `
            <td>${user.id}</td>
            <td>${user.name || '-'} <br><small style="color:#888">${user.login}</small></td>
            <td>${getRoleName(user.permLevel)}</td>
            <td><input type="checkbox" class="toggle-active-chk" data-id="${user.id}" data-name="${user.name}" data-perm="${user.permLevel}" ${user.active ? 'checked' : ''}></td>
            <td><a onclick="openEditOverlay(${user.id})" style="cursor:pointer; color: #3e8de9; font-weight: bold;">Открыть</a></td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.toggle-active-chk').forEach(chk => {
        chk.addEventListener('change', async (e) => {
            const userId = parseInt(e.target.dataset.id);
            const isActive = e.target.checked;
            const userName = e.target.dataset.name;
            const permLvl = parseInt(e.target.dataset.perm);

            try {
                await apiCall('/Authorization/changeUserInfo', 'PATCH', {
                    id: userId, name: userName, permLevel: permLvl, active: isActive
                });
                const user = allUsers.find(u => u.id === userId);
                if (user) user.active = isActive;
                renderUsersTable(allUsers);
            } catch (err) {
                alert("Ошибка смены статуса");
                e.target.checked = !isActive; 
            }
        });
    });
}

document.getElementById('users-search-text').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    const filtered = allUsers.filter(u => 
        (u.id.toString().includes(term)) || 
        (u.name && u.name.toLowerCase().includes(term)) || 
        getRoleName(u.permLevel).toLowerCase().includes(term)
    );
    renderUsersTable(filtered);
});

const overlay = document.getElementById('overlay-user-create');
const form = overlay.querySelector('form');
const inputLogin = document.getElementById('user-login-text');
const inputName = document.getElementById('user-name-text');
const inputPassword = document.getElementById('user-password-text');
const errorMessage = document.getElementById('user-error-message');

function setDropdownValue(containerId, text, dataValue) {
    const container = document.getElementById(containerId);
    if(container) {
        container.querySelector('.dropdown-choice').textContent = text;
        container.setAttribute('data-value', dataValue);
    }
}

document.getElementById('users-add').onclick = () => {
    editingUserId = null;
    form.reset();
    inputLogin.disabled = false;
    inputLogin.style.opacity = '1';
    errorMessage.style.display = 'none';
    
    setDropdownValue('user-position', 'Водитель', 2);
    setDropdownValue('user-state', 'Активная', 'true');
    
    inputPassword.value = '';
    inputPassword.placeholder = "Введите пароль...";
    inputPassword.required = true; 

    overlay.classList.remove('hidden');
};

window.openEditOverlay = (id) => {
    const user = allUsers.find(u => u.id === id);
    if (!user) return;

    editingUserId = id;
    errorMessage.style.display = 'none'; 
    
    inputName.value = user.name || '';
    inputLogin.value = user.login;
    inputLogin.disabled = true; 
    inputLogin.style.opacity = '0.6';

    setDropdownValue('user-position', getRoleName(user.permLevel), user.permLevel);
    setDropdownValue('user-state', user.active ? 'Активная' : 'Неактивная', user.active ? 'true' : 'false');

    inputPassword.value = '';
    inputPassword.placeholder = "Новый пароль (пусто = оставить старый)";
    inputPassword.required = false; 

    overlay.classList.remove('hidden');
};

form.onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const oldText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Сохранение...";
    errorMessage.style.display = 'none';

    const name = inputName.value.trim();
    const login = inputLogin.value.trim();
    const password = inputPassword.value.trim();
    const permLevel = parseInt(document.getElementById('user-position').getAttribute('data-value'));
    const isActive = document.getElementById('user-state').getAttribute('data-value') === 'true';

    try {
        if (editingUserId === null) {
            await apiCall('/Authorization/register', 'POST', {
                login: login, password: password, name: name, permissionLevel: permLevel 
            });
            
            if (!isActive) {
                const freshUsers = await apiCall('/Authorization/getAllUsers');
                const newUser = freshUsers.find(u => u.login === login);
                if (newUser) {
                    await apiCall('/Authorization/changeUserInfo', 'PATCH', {
                        id: newUser.id, name: name, permLevel: permLevel, active: false
                    });
                }
            }
        } else {
            await apiCall('/Authorization/changeUserInfo', 'PATCH', {
                id: editingUserId, name: name, permLevel: permLevel, active: isActive
            });

            if (password !== "") {
                await apiCall('/Authorization/changeUserPassword', 'PATCH', {
                    id: editingUserId, newPassword: password
                });
            }
        }

        overlay.classList.add('hidden'); 
        await fetchUsers(); 

    } catch (err) {
        errorMessage.textContent = "Не удалось сохранить изменения: " + err.message;
        errorMessage.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = oldText;
    }
};

function initUI() {
    document.querySelectorAll('#overlay-user-create .dropdown-button').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const menu = this.nextElementSibling;
            document.querySelectorAll('#overlay-user-create .dropdown-content').forEach(c => { 
                if(c !== menu) c.style.maxHeight = null; 
            });
            menu.style.maxHeight = menu.style.maxHeight ? null : menu.scrollHeight + "px";
        });
    });

    document.querySelectorAll('#user-position .dropdown-content div').forEach(div => {
        div.addEventListener('click', function() {
            const txt = this.textContent.trim();
            if(!txt) return;
            let val = 2; 
            if (txt === "Администратор") val = 0;
            if (txt === "Диспетчер") val = 1;
            setDropdownValue('user-position', txt, val);
            this.parentElement.style.maxHeight = null;
        });
    });

    document.querySelectorAll('#user-state .dropdown-content div').forEach(div => {
        div.addEventListener('click', function() {
            const txt = this.textContent.trim();
            if(!txt) return;
            setDropdownValue('user-state', txt, txt === "Активная" ? 'true' : 'false');
            this.parentElement.style.maxHeight = null;
        });
    });

    document.querySelectorAll('.form-control-buttons button[type="button"]').forEach(btn => {
        btn.onclick = () => overlay.classList.add('hidden');
    });

    const eyeBtn = document.getElementById('user-password-show');
    if (eyeBtn) {
        inputPassword.type = "password";
        eyeBtn.onclick = () => {
            if (inputPassword.type === "password") {
                inputPassword.type = "text";
                eyeBtn.style.opacity = "0.5";
            } else {
                inputPassword.type = "password";
                eyeBtn.style.opacity = "1";
            }
        };
    }

    const genBtn = document.getElementById('user-password-generate');
    if (genBtn) {
        genBtn.onclick = () => {
            inputPassword.value = Math.random().toString(36).slice(-8); 
            inputPassword.type = "text"; 
            if(eyeBtn) eyeBtn.style.opacity = "0.5";
        };
    }
}