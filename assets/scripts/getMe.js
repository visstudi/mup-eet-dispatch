const API_BASE = "";

(async function initAuth() {
    const rawToken = localStorage.getItem('auth_token');
    const page = window.location.pathname.split('/').pop() || 'traffic.html';

    if (page.includes('login.html')) return;

    if (!rawToken || rawToken === "undefined" || rawToken === "null") {
        window.location.href = 'login.html';
        return;
    }

    try {
        const cleanToken = rawToken.replace(/^["']|["']$/g, '').trim();
        const response = await fetch(`${API_BASE}/Authorization/getMe`, {
            method: 'GET',
            headers: { 'Accept': '*/*', 'Authorization': cleanToken }
        });

        if (!response.ok) throw new Error("Unauthorized");

        const user = await response.json();
        window.currentUser = user; 

        const role = user.permLevel; 
        if (role === 2 && !page.includes('traffic.html')) {
            window.location.href = 'traffic.html';
        } else if (role === 1 && page.includes('users.html')) {
            window.location.href = 'traffic.html';
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => setupUI(role));
        } else {
            setupUI(role);
        }

    } catch (e) {
        localStorage.removeItem('auth_token');
        window.location.href = 'login.html';
    }
})();

function setupUI(role) {
    renderUserWidget();
    hideUnauthorizedNav(role);
}

function hideUnauthorizedNav(role) {
    const navButtons = document.querySelectorAll('nav button');
    if (role === 2) { // Водитель
        navButtons.forEach((btn, i) => { if (i > 0) btn.style.display = 'none'; });
    } else if (role === 1) { 
        if (navButtons[5]) navButtons[5].style.display = 'none';
    }
}

function renderUserWidget() {
    const header = document.querySelector('header');
    if (!header || document.getElementById('user-profile-widget')) return;

    const user = window.currentUser;
    const roles = { 0: "Администратор", 1: "Диспетчер", 2: "Водитель" };

    const container = document.createElement('div');
    container.id = 'user-profile-widget';
    container.className = 'user-widget-container';
    
    container.innerHTML = `
        <div class="user-card" id="userCard">
            <div class="user-card-header">
                <div class="user-card-names">
                    <span class="user-card-name">${user.name}</span>
                    <span class="user-card-role">${roles[user.permLevel]}</span>
                </div>
                <svg class="user-card-chevron" viewBox="0 0 14 7" fill="none"><path d="M1 1L7 4L13 1" stroke="black" stroke-width="2"/></svg>
            </div>
            <div class="user-card-logout">
                <button class="btn-logout-red" id="logoutBtn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    Выйти
                </button>
            </div>
        </div>
    `;

    header.appendChild(container);

    const card = document.getElementById('userCard');
    
    card.onclick = (e) => {
        if (e.target.closest('#logoutBtn')) return;
        card.classList.toggle('expanded');
    };

    document.getElementById('logoutBtn').onclick = () => {
        localStorage.removeItem('auth_token');
        window.location.href = 'login.html';
    };

    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) card.classList.remove('expanded');
    });
}