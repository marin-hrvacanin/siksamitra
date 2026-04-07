/**
 * Theme Manager for śikṣāmitra Editor (matching main2.pyw)
 */

class ThemeManager {
    constructor() {
        this.currentTheme = 'light';
        this.themeLightBtn = null;
        this.themeDarkBtn = null;
        this.themeSystemBtn = null;
        this.storageKey = 'siksamitra-theme';
        this.themeMode = 'system'; // 'light', 'dark', or 'system'
        
        this.init();
    }

    /**
     * Initialize theme manager
     */
    init() {
        // Wait for pywebview ready event to ensure API is available
        window.addEventListener('pywebviewready', () => {
            this.loadSavedThemeMode();
        });
        
        // Also try immediately (in case it's already ready or running in browser)
        this.loadSavedThemeMode();
        
        this.setupThemeButtons();
        this.applyCurrentTheme();
        this.detectSystemTheme();
    }

    /**
     * Load saved theme mode from localStorage or backend
     */
    async loadSavedThemeMode() {
        let savedMode = null;
        
        // Try loading from backend first
        if (window.pywebview && window.pywebview.api) {
            try {
                let prefs = await window.pywebview.api.get_preferences();
                if (typeof prefs === 'string') {
                    prefs = JSON.parse(prefs);
                }
                if (prefs && prefs.theme_mode) {
                    savedMode = prefs.theme_mode;
                }
            } catch (e) {
                console.warn('Failed to load theme from backend:', e);
            }
        }
        
        // Fallback to localStorage
        if (!savedMode) {
            savedMode = localStorage.getItem(this.storageKey);
        }
        
        if (savedMode && ['light', 'dark', 'system'].includes(savedMode)) {
            this.themeMode = savedMode;
        } else {
            this.themeMode = 'system';
        }
        
        // Re-apply theme after loading
        this.applyCurrentTheme();
        this.updateButtonStates();
    }

    /**
     * Detect system theme preference
     */
    detectSystemTheme() {
        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (this.themeMode === 'system') {
                this.currentTheme = e.matches ? 'dark' : 'light';
                this.applyTheme(this.currentTheme);
            }
        });
    }

    /**
     * Setup theme buttons
     */
    setupThemeButtons() {
        this.themeLightBtn = document.getElementById('themeLightBtn');
        this.themeDarkBtn = document.getElementById('themeDarkBtn');
        this.themeSystemBtn = document.getElementById('themeSystemBtn');
        
        if (this.themeLightBtn) {
            this.themeLightBtn.addEventListener('click', () => {
                this.setThemeMode('light');
            });
        }
        
        if (this.themeDarkBtn) {
            this.themeDarkBtn.addEventListener('click', () => {
                this.setThemeMode('dark');
            });
        }
        
        if (this.themeSystemBtn) {
            this.themeSystemBtn.addEventListener('click', () => {
                this.setThemeMode('system');
            });
        }
        
        // Update button states after a short delay to ensure DOM is ready
        setTimeout(() => this.updateButtonStates(), 50);
    }

    /**
     * Set theme mode (light, dark, or system)
     */
    async setThemeMode(mode) {
        this.themeMode = mode;
        localStorage.setItem(this.storageKey, mode);
        
        // Save to backend
        if (window.pywebview && window.pywebview.api) {
            try {
                await window.pywebview.api.set_preference('theme_mode', mode);
            } catch (e) {
                console.warn('Failed to save theme to backend:', e);
            }
        }
        
        this.applyCurrentTheme();
        this.updateButtonStates();
        
        // Trigger custom event
        window.dispatchEvent(new CustomEvent('themeChanged', {
            detail: { theme: this.currentTheme, mode: this.themeMode }
        }));
    }

    /**
     * Apply current theme based on mode
     */
    applyCurrentTheme() {
        if (this.themeMode === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.currentTheme = prefersDark ? 'dark' : 'light';
        } else {
            this.currentTheme = this.themeMode;
        }
        this.applyTheme(this.currentTheme);
    }

    /**
     * Update button states (active class)
     */
    updateButtonStates() {
        if (this.themeLightBtn) {
            if (this.themeMode === 'light') {
                this.themeLightBtn.classList.add('active');
            } else {
                this.themeLightBtn.classList.remove('active');
            }
        }
        
        if (this.themeDarkBtn) {
            if (this.themeMode === 'dark') {
                this.themeDarkBtn.classList.add('active');
            } else {
                this.themeDarkBtn.classList.remove('active');
            }
        }
        
        if (this.themeSystemBtn) {
            if (this.themeMode === 'system') {
                this.themeSystemBtn.classList.add('active');
            } else {
                this.themeSystemBtn.classList.remove('active');
            }
        }
    }

    /**
     * Apply theme to document (like main2.pyw)
     * @param {string} theme - 'light' or 'dark'
     */
    applyTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        this.currentTheme = theme;
        
        // Update meta theme-color for mobile browsers
        this.updateMetaThemeColor(theme);
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
     * Get current theme
     * @returns {string} Current theme ('light' or 'dark')
     */
    getCurrentTheme() {
        return this.currentTheme;
    }

    /**
     * Get current theme mode
     * @returns {string} Current theme mode ('light', 'dark', or 'system')
     */
    getThemeMode() {
        return this.themeMode;
    }

    /**
     * Set theme programmatically
     * @param {string} mode - 'light', 'dark', or 'system'
     */
    setTheme(mode) {
        if (['light', 'dark', 'system'].includes(mode)) {
            this.setThemeMode(mode);
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