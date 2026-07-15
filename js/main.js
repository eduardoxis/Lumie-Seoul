/*
 * Lumié Seoul - Global Interface Controls
 * Pure Vanilla ES6+ — integrado ao spa-router.js
 */

document.addEventListener('DOMContentLoaded', () => {
    initHeaderScroll();
    initMobileMenu();
    initSearchDrawer();
    initLazyLoading();
});

// 1. Header scroll effect (add class when user scrolls down)
function initHeaderScroll() {
    const header = document.querySelector('.main-header');
    if (!header) return;

    const handleScroll = () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check on init
}

// 2. Mobile drawer menu toggle
function initMobileMenu() {
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebarDrawer = document.querySelector('.sidebar-drawer');
    const overlay = document.querySelector('.sidebar-overlay');

    if (!menuToggle || !sidebarDrawer) return;

    const toggleMenu = () => {
        menuToggle.classList.toggle('active');
        sidebarDrawer.classList.toggle('active');
        overlay?.classList.toggle('active');
        document.body.style.overflow = sidebarDrawer.classList.contains('active') ? 'hidden' : '';
    };

    menuToggle.addEventListener('click', toggleMenu);

    // Fecha o menu ao clicar em qualquer link do drawer (a navegação real
    // já é tratada pelo spa-router.js via delegação de [data-page])
    sidebarDrawer.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            if (sidebarDrawer.classList.contains('active')) toggleMenu();
        });
    });

    overlay?.addEventListener('click', () => {
        if (sidebarDrawer.classList.contains('active')) toggleMenu();
    });
}

// 3. Search overlay modal trigger — navega para o catálogo e foca a busca
function initSearchDrawer() {
    document.querySelectorAll('.search-trigger').forEach(searchBtn => {
        searchBtn.addEventListener('click', () => {
            setTimeout(() => {
                document.querySelector('#page-catalogo .search-input')?.focus();
            }, 150);
        });
    });
}

// 4. Lazy loading images for performance
function initLazyLoading() {
    const lazyImages = document.querySelectorAll('img[loading="lazy"]');

    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const image = entry.target;
                    if (image.dataset.src) {
                        image.src = image.dataset.src;
                    }
                    imageObserver.unobserve(image);
                }
            });
        });

        lazyImages.forEach(image => imageObserver.observe(image));
    } else {
        lazyImages.forEach(image => {
            if (image.dataset.src) {
                image.src = image.dataset.src;
            }
        });
    }
}
