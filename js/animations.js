/*
 * Lumié Seoul - Luxury Scroll Reveal & Loading Transitions
 * Pure Vanilla ES6+
 */

document.addEventListener('DOMContentLoaded', () => {
    initScrollReveal();
    initPageLoader();
});

/**
 * Uses IntersectionObserver to trigger smooth, luxurious fade-in animations 
 * as elements scroll into view.
 */
function initScrollReveal() {
    const reveals = document.querySelectorAll('.reveal, .reveal-fade');
    
    if (!reveals.length) return;

    const observerOptions = {
        root: null, // Viewport
        rootMargin: '0px 0px -80px 0px', // Trigger slightly before element enters view
        threshold: 0.1 // 10% of element visible
    };

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('reveal-active');
                
                // Once element is animated, we don't need to observe it anymore
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    reveals.forEach(element => {
        revealObserver.observe(element);
    });
}

/**
 * Handles page loading screen, adding fade out classes once window finishes loading.
 */
function initPageLoader() {
    const loader = document.getElementById('page-loader');
    if (!loader) return;

    window.addEventListener('load', () => {
        setTimeout(() => {
            loader.classList.add('loaded');
            // Allow scroll reveal of hero elements to run right after load
            triggerHeroAnimations();
        }, 800); // Luxury timeout for smooth feel
    });
}

/**
 * Explicitly triggers animations for hero sections so the user has an immediate feedback.
 */
function triggerHeroAnimations() {
    const heroElements = document.querySelectorAll('.hero-section .reveal, .hero-section .reveal-fade');
    heroElements.forEach(el => {
        el.classList.add('reveal-active');
    });
}

// Make scroll reveal reinitalizer available globally for dynamically rendered components
window.initScrollReveal = initScrollReveal;
