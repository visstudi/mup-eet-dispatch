document.addEventListener('DOMContentLoaded', () => {
    const navButtons = document.querySelectorAll('nav button');
    const pages = [
        'traffic.html', 'routes.html', 'appeals.html', 
        'vacancies.html', 'logs.html', 'users.html'
    ];

    navButtons.forEach((btn, index) => {
        btn.onclick = () => {
            if (pages[index]) window.location.href = pages[index];
        };
    });
});