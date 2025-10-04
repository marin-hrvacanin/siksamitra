/**
 * Theme Manager for śikṣāmitra Editor (matching main2.pyw)
 */

class ThemeManager {
    constructor() {
        this.currentTheme = 'light';
        this.themeToggleBtn = null;
        this.storageKey = 'siksamitra-theme';
        
        this.init();
    }

    /**
     * Initialize theme manager
     */
    init() {
        this.loadSavedTheme();
        this.setupThemeToggle();
        this.detectSystemTheme();
        this.applyTheme(this.currentTheme);
    }

    /**
     * Load saved theme from localStorage
     */
    loadSavedTheme() {
        const savedTheme = localStorage.getItem(this.storageKey);
        if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
            this.currentTheme = savedTheme;
        }
    }

    /**
     * Detect system theme preference
     */
    detectSystemTheme() {
        if (!localStorage.getItem(this.storageKey)) {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.currentTheme = prefersDark ? 'dark' : 'light';
        }

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem(this.storageKey)) {
                this.currentTheme = e.matches ? 'dark' : 'light';
                this.applyTheme(this.currentTheme);
                this.updateToggleIcon();
            }
        });
    }

    /**
     * Setup theme toggle button
     */
    setupThemeToggle() {
        this.themeToggleBtn = document.getElementById('themeToggle');
        if (this.themeToggleBtn) {
            this.themeToggleBtn.addEventListener('click', () => {
                this.toggleTheme();
            });
        }
    }

    /**
     * Toggle between light and dark themes
     */
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(this.currentTheme);
        this.saveTheme();
        this.updateToggleIcon();
        
        // Trigger custom event
        window.dispatchEvent(new CustomEvent('themeChanged', {
            detail: { theme: this.currentTheme }
        }));
    }

    /**
     * Apply theme to document (like main2.pyw)
     * @param {string} theme - 'light' or 'dark'
     */
    applyTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        this.currentTheme = theme;
        this.updateToggleIcon();
        
        // Update meta theme-color for mobile browsers
        this.updateMetaThemeColor(theme);
    }

    /**
     * Update toggle button icon
     */
    updateToggleIcon() {
        if (!this.themeToggleBtn) return;
        
        // Show sun icon in light mode, moon icon in dark mode
        this.themeToggleBtn.textContent = this.currentTheme === 'light' ? '🌞' : '🌙';
        this.themeToggleBtn.title = this.currentTheme === 'light' ? 
            'Switch to dark mode' : 'Switch to light mode';
    }

    /**
     * Update meta theme-color for mobile browsers
     * @param {string} theme - Current theme
     */
    updateMetaThemeColor(theme) {
        let metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (!metaThemeColor) {
            metaThemeColor = document.createElement('meta');
            metaThemeColor.name = 'theme-color';
            document.head.appendChild(metaThemeColor);
        }
        
        const color = theme === 'dark' ? '#1a1a1a' : '#f8f9fa';
        metaThemeColor.content = color;
    }

    /**
     * Save current theme to localStorage
     */
    saveTheme() {
        localStorage.setItem(this.storageKey, this.currentTheme);
    }

    /**
     * Get current theme
     * @returns {string} Current theme ('light' or 'dark')
     */
    getCurrentTheme() {
        return this.currentTheme;
    }

    /**
     * Set theme programmatically
     * @param {string} theme - 'light' or 'dark'
     */
    setTheme(theme) {
        if (theme === 'light' || theme === 'dark') {
            this.applyTheme(theme);
            this.saveTheme();
        }
    }
}

// Initialize theme manager when DOM is loaded
let themeManager;

document.addEventListener('DOMContentLoaded', () => {
    themeManager = new ThemeManager();
});

// Export for use in other modules
window.ThemeManager = ThemeManager;

// Export instance for immediate use
window.getThemeManager = () => themeManager;