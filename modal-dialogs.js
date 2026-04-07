/**
 * Custom Modal Dialogs for śikṣāmitra
 * Replaces browser alert(), confirm(), and prompt() with styled modals
 */

class ModalDialogs {
    static icons = {
        info: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12.01" y2="8"></line><line x1="11" y1="12" x2="13" y2="12"></line><line x1="12" y1="12" x2="12" y2="16"></line></svg>',
        question: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9 9a3 3 0 0 1 6 0c0 1.5-1 2-2 2s-1 1-1 2"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
        error: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="9" y1="9" x2="15" y2="15"></line><line x1="15" y1="9" x2="9" y2="15"></line></svg>',
        warning: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
        success: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="m8 12 2.5 2.5L16 9"></path></svg>',
        prompt: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>',
        rename: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21v-4.5a2 2 0 0 1 .586-1.414L16.086 2.586a2 2 0 0 1 2.828 0l2.5 2.5a2 2 0 0 1 0 2.828L8.914 21.586A2 2 0 0 1 7.5 22H3"></path><path d="m15 5 4 4"></path></svg>',
        folder: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"></path></svg>',
        save: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 21h10a2 2 0 0 0 2-2V7.5L16.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2Z"></path><path d="M17 21V13H7v8"></path><path d="M7 3v5h8"></path></svg>',
        library: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 20h8"></path><path d="M12 4v16"></path><path d="M10 6h4"></path><path d="M10 10h4"></path><path d="M10 14h4"></path></svg>',
        delete: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M5 6l1-3h12l1 3"></path></svg>'
    };

    static _iconMarkup(icon) {
        if (!icon) return this.icons.info;
        if (this.icons[icon]) return this.icons[icon];
        return icon;
    }
    /**
     * Show a custom alert dialog
     * @param {string} message - Message to display
     * @param {string} title - Dialog title (optional)
     * @param {string} icon - Icon key or SVG markup (optional)
     */
    static _animateClose(overlay, callback) {
        overlay.classList.add('custom-modal-closing');
        setTimeout(callback, 220); // slightly after animation (0.18s) finishes
    }

    static async alert(message, title = 'Notice', icon = 'info') {
        return new Promise((resolve) => {
            const overlay = this.createOverlay();
            const modal = this.createModal();

            modal.innerHTML = `
                <div class="custom-modal-header">
                    <span class="custom-modal-icon" aria-hidden="true">${this._iconMarkup(icon)}</span>
                    <h3 class="custom-modal-title">${title}</h3>
                </div>
                <div class="custom-modal-body">${message}</div>
                <div class="custom-modal-actions">
                    <button class="custom-modal-btn custom-modal-btn-primary" id="modal-ok">OK</button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            const okBtn = document.getElementById('modal-ok');
            okBtn.focus();

            let settled = false;
            const close = () => {
                if (settled) return;
                settled = true;
                this._animateClose(overlay, () => {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    resolve();
                });
            };

            okBtn.addEventListener('click', close);
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close();
            });

            document.addEventListener('keydown', function handler(e) {
                if (e.key === 'Enter' || e.key === 'Escape') {
                    document.removeEventListener('keydown', handler);
                    close();
                }
            });
        });
    }

    /**
     * Show a custom confirm dialog
     * @param {string} message - Message to display
     * @param {string} title - Dialog title (optional)
     * @param {string} icon - Icon key or SVG markup (optional)
     */
    static async confirm(message, title = 'Confirm', icon = 'question') {
        return new Promise((resolve) => {
            const overlay = this.createOverlay();
            const modal = this.createModal();

            modal.innerHTML = `
                <div class="custom-modal-header">
                    <span class="custom-modal-icon" aria-hidden="true">${this._iconMarkup(icon)}</span>
                    <h3 class="custom-modal-title">${title}</h3>
                </div>
                <div class="custom-modal-body">${message}</div>
                <div class="custom-modal-actions">
                    <button class="custom-modal-btn custom-modal-btn-secondary" id="modal-cancel">Cancel</button>
                    <button class="custom-modal-btn custom-modal-btn-primary" id="modal-confirm">Confirm</button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            const confirmBtn = document.getElementById('modal-confirm');
            const cancelBtn = document.getElementById('modal-cancel');
            confirmBtn.focus();

            let settled = false;
            const close = (result) => {
                if (settled) return;
                settled = true;
                this._animateClose(overlay, () => {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    resolve(result);
                });
            };

            confirmBtn.addEventListener('click', () => close(true));
            cancelBtn.addEventListener('click', () => close(false));
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close(false);
            });

            document.addEventListener('keydown', function handler(e) {
                if (e.key === 'Enter') {
                    document.removeEventListener('keydown', handler);
                    close(true);
                } else if (e.key === 'Escape') {
                    document.removeEventListener('keydown', handler);
                    close(false);
                }
            });
        });
    }

    /**
     * Show a custom prompt dialog
     * @param {string} message - Message to display
     * @param {object} options - { defaultValue, title, icon, selectRange }
     */
    static async prompt(message, options = {}) {
        const {
            defaultValue = '',
            title = 'Input Required',
            icon = 'prompt',
            selectRange = null
        } = options;
        return new Promise((resolve) => {
            const overlay = this.createOverlay();
            const modal = this.createModal();

            modal.innerHTML = `
                <div class="custom-modal-header">
                    <span class="custom-modal-icon" aria-hidden="true">${this._iconMarkup(icon)}</span>
                    <h3 class="custom-modal-title">${title}</h3>
                </div>
                <div class="custom-modal-body">${message}</div>
                <input type="text" class="custom-modal-input" id="modal-input" value="${defaultValue}">
                <div class="custom-modal-actions">
                    <button class="custom-modal-btn custom-modal-btn-secondary" id="modal-cancel">Cancel</button>
                    <button class="custom-modal-btn custom-modal-btn-primary" id="modal-ok">OK</button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            const input = document.getElementById('modal-input');
            const okBtn = document.getElementById('modal-ok');
            const cancelBtn = document.getElementById('modal-cancel');
            
            input.focus();
            if (selectRange && Array.isArray(selectRange) && selectRange.length === 2) {
                try {
                    input.setSelectionRange(selectRange[0], selectRange[1]);
                } catch (e) {
                    input.select();
                }
            } else {
                input.select();
            }

            let settled = false;
            const close = (result) => {
                if (settled) return;
                settled = true;
                this._animateClose(overlay, () => {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    resolve(result);
                });
            };

            okBtn.addEventListener('click', () => close(input.value));
            cancelBtn.addEventListener('click', () => close(null));
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close(null);
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    close(input.value);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    close(null);
                }
            });
        });
    }

    /**
     * Show a save changes dialog
     * @param {string} filename - Name of the file
     */
    static async saveChanges(filename) {
        return new Promise((resolve) => {
            const overlay = this.createOverlay();
            const modal = this.createModal();

            modal.innerHTML = `
                <div class="custom-modal-header">
                    <span class="custom-modal-icon" aria-hidden="true">${this._iconMarkup('save')}</span>
                    <h3 class="custom-modal-title">Save Changes?</h3>
                </div>
                <div class="custom-modal-body">Do you want to save changes to "${filename}"?</div>
                <div class="custom-modal-actions">
                    <button class="custom-modal-btn custom-modal-btn-secondary" id="modal-dont-save">Don't Save</button>
                    <button class="custom-modal-btn custom-modal-btn-secondary" id="modal-cancel">Cancel</button>
                    <button class="custom-modal-btn custom-modal-btn-primary" id="modal-save">Save</button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            const saveBtn = document.getElementById('modal-save');
            const dontSaveBtn = document.getElementById('modal-dont-save');
            const cancelBtn = document.getElementById('modal-cancel');
            saveBtn.focus();

            let settled = false;
            const close = (result) => {
                if (settled) return;
                settled = true;
                this._animateClose(overlay, () => {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    resolve(result);
                });
            };

            saveBtn.addEventListener('click', () => close('save'));
            dontSaveBtn.addEventListener('click', () => close('dont-save'));
            cancelBtn.addEventListener('click', () => close('cancel'));
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close('cancel');
            });

            document.addEventListener('keydown', function handler(e) {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', handler);
                    close('cancel');
                }
            });
        });
    }

    /**
     * Create modal overlay
     */
    static createOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay';
        return overlay;
    }

    /**
     * Create modal container
     */
    static createModal() {
        const modal = document.createElement('div');
        modal.className = 'custom-modal';
        return modal;
    }
}

// Export for use in other modules
window.ModalDialogs = ModalDialogs;
