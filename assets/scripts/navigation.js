document.addEventListener('DOMContentLoaded', () => {
    const navButtons = document.querySelectorAll('nav button');
    const pages = [
        'traffic.html', 'routes.html', 'requests.html', 
        'jobs.html', 'journal.html', 'users.html'
    ];

    navButtons.forEach((btn, index) => {
        btn.onclick = () => {
            if (pages[index]) window.location.href = pages[index];
        };
    });
});