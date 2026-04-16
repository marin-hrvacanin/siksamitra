/**
 * ModalDialogs — alert/confirm/prompt/saveChanges helpers.
 *
 * In a PyQt6 environment, dialogs are rendered as standalone OS windows via
 * the bridge (`pywebview.api.open_dialog('message')`). The popup reads its
 * config from `/api/message/state` and posts the user's response back via
 * `/api/dialog/action` (type: `message_response`).
 *
 * In environments without the bridge (plain browsers), the original in-page
 * overlay implementation is preserved as a fallback.
 */

(function() {
    'use strict';

    // ── OS-window message system ────────────────────────────────────────────
    if (!window._messageCallbacks) window._messageCallbacks = {};

    const dispatchMessageResponse = (id, value) => {
        const cb = window._messageCallbacks[id];
        if (cb) {
            delete window._messageCallbacks[id];
            try { cb(value); } catch(e) { console.error('message callback error', e); }
        }
    };
    // Make it globally callable so editor-quill.js can dispatch from its
    // dialog-action poll without circular references.
    window._dispatchMessageResponse = dispatchMessageResponse;

    function _generateMessageId() {
        return 'msg-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    }

    async function _postMessageState(state) {
        try {
            await fetch('/api/message/state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(state),
            });
        } catch(e) { console.error('Failed to POST message state', e); }
    }

    function _bridgeAvailable() {
        return typeof window.pywebview !== 'undefined'
            && window.pywebview.api
            && typeof window.pywebview.api.open_dialog === 'function';
    }

    /**
     * Show a message dialog as an OS popup. Returns a Promise that resolves
     * when the user clicks a button (or closes via Esc).
     *
     *  config: {
     *      type: 'alert' | 'confirm' | 'prompt' | 'savechanges',
     *      title, message, icon,
     *      defaultValue, selectRange,           // for prompt
     *      buttons: [{ label, value, primary, danger }],
     *      cancelValue,                         // returned on Esc / window close
     *  }
     */
    async function showOSMessage(config) {
        return new Promise(async (resolve) => {
            const id = _generateMessageId();
            const state = Object.assign({}, config, { id });
            window._messageCallbacks[id] = (val) => resolve(val);
            await _postMessageState(state);
            try {
                await window.pywebview.api.open_dialog('message');
            } catch(e) {
                console.error('open_dialog(message) failed', e);
                delete window._messageCallbacks[id];
                resolve(config.cancelValue);
            }
        });
    }

    // ── HTML overlay fallback (used when no bridge — browsers, dev) ─────────
    const ICONS = {
        info:    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12.01" y2="8"></line><line x1="11" y1="12" x2="13" y2="12"></line><line x1="12" y1="12" x2="12" y2="16"></line></svg>',
        question:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9 9a3 3 0 0 1 6 0c0 1.5-1 2-2 2s-1 1-1 2"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
        error:   '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="9" y1="9" x2="15" y2="15"></line><line x1="15" y1="9" x2="9" y2="15"></line></svg>',
        warning: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
        success: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="m8 12 2.5 2.5L16 9"></path></svg>',
        prompt:  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>',
        save:    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 21h10a2 2 0 0 0 2-2V7.5L16.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2Z"></path><path d="M17 21V13H7v8"></path><path d="M7 3v5h8"></path></svg>',
        delete:  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M5 6l1-3h12l1 3"></path></svg>',
        rename:  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21v-4.5a2 2 0 0 1 .586-1.414L16.086 2.586a2 2 0 0 1 2.828 0l2.5 2.5a2 2 0 0 1 0 2.828L8.914 21.586A2 2 0 0 1 7.5 22H3"></path><path d="m15 5 4 4"></path></svg>',
        folder:  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"></path></svg>',
        library: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 20h8"></path><path d="M12 4v16"></path><path d="M10 6h4"></path><path d="M10 10h4"></path><path d="M10 14h4"></path></svg>',
    };

    function _iconMarkupHTML(icon) {
        if (!icon) return ICONS.info;
        return ICONS[icon] || icon;
    }

    function _animateClose(overlay, callback) {
        overlay.classList.add('custom-modal-closing');
        setTimeout(callback, 220);
    }

    function _createOverlay() {
        const o = document.createElement('div');
        o.className = 'custom-modal-overlay';
        return o;
    }
    function _createModal() {
        const m = document.createElement('div');
        m.className = 'custom-modal';
        return m;
    }

    // ── ModalDialogs class ──────────────────────────────────────────────────
    class ModalDialogs {
        static icons = ICONS; // back-compat for any code that reads ModalDialogs.icons

        static async alert(message, title = 'Notice', icon = 'info') {
            if (_bridgeAvailable()) {
                return showOSMessage({
                    type: 'alert',
                    title, message, icon,
                    buttons: [{ label: 'OK', value: undefined, primary: true }],
                    cancelValue: undefined,
                });
            }
            return _alertOverlay(message, title, icon);
        }

        static async confirm(message, title = 'Confirm', icon = 'question') {
            if (_bridgeAvailable()) {
                const danger = (icon === 'delete' || icon === 'warning' || icon === 'error');
                return showOSMessage({
                    type: 'confirm',
                    title, message, icon,
                    buttons: [
                        { label: 'Cancel',  value: false },
                        { label: 'Confirm', value: true, primary: !danger, danger },
                    ],
                    cancelValue: false,
                });
            }
            return _confirmOverlay(message, title, icon);
        }

        static async prompt(message, options = {}) {
            const { defaultValue = '', title = 'Input Required', icon = 'prompt', selectRange = null } = options;
            if (_bridgeAvailable()) {
                return showOSMessage({
                    type: 'prompt',
                    title, message, icon,
                    defaultValue, selectRange,
                    buttons: [
                        { label: 'Cancel', value: null },
                        { label: 'OK',     value: '__INPUT__', primary: true },
                    ],
                    cancelValue: null,
                });
            }
            return _promptOverlay(message, options);
        }

        static async saveChanges(filename) {
            const displayName = filename || 'Untitled.smdoc';
            if (_bridgeAvailable()) {
                return showOSMessage({
                    type: 'savechanges',
                    title: 'Save Changes?',
                    message: 'Save changes before closing?',
                    filename: displayName,
                    icon: 'save',
                    buttons: [
                        { label: "Don't Save", value: 'dont-save' },
                        { label: 'Cancel',     value: 'cancel' },
                        { label: 'Save',       value: 'save', primary: true },
                    ],
                    cancelValue: 'cancel',
                });
            }
            return _saveChangesOverlay(filename);
        }
    }

    // ── HTML-overlay fallback implementations ──────────────────────────────
    function _alertOverlay(message, title, icon) {
        return new Promise((resolve) => {
            const overlay = _createOverlay();
            const modal = _createModal();
            modal.innerHTML = `
                <div class="custom-modal-header">
                    <span class="custom-modal-icon">${_iconMarkupHTML(icon)}</span>
                    <h3 class="custom-modal-title">${title}</h3>
                </div>
                <div class="custom-modal-body">${message}</div>
                <div class="custom-modal-actions">
                    <button class="custom-modal-btn custom-modal-btn-primary" id="modal-ok">OK</button>
                </div>`;
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            const okBtn = document.getElementById('modal-ok');
            okBtn.focus();
            let settled = false;
            const close = () => {
                if (settled) return;
                settled = true;
                _animateClose(overlay, () => {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    resolve();
                });
            };
            okBtn.addEventListener('click', close);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
            document.addEventListener('keydown', function h(e) {
                if (e.key === 'Enter' || e.key === 'Escape') {
                    document.removeEventListener('keydown', h);
                    close();
                }
            });
        });
    }

    function _confirmOverlay(message, title, icon) {
        return new Promise((resolve) => {
            const overlay = _createOverlay();
            const modal = _createModal();
            modal.innerHTML = `
                <div class="custom-modal-header">
                    <span class="custom-modal-icon">${_iconMarkupHTML(icon)}</span>
                    <h3 class="custom-modal-title">${title}</h3>
                </div>
                <div class="custom-modal-body">${message}</div>
                <div class="custom-modal-actions">
                    <button class="custom-modal-btn custom-modal-btn-secondary" id="modal-cancel">Cancel</button>
                    <button class="custom-modal-btn custom-modal-btn-primary" id="modal-confirm">Confirm</button>
                </div>`;
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            const c = document.getElementById('modal-confirm');
            const x = document.getElementById('modal-cancel');
            c.focus();
            let settled = false;
            const close = (r) => {
                if (settled) return;
                settled = true;
                _animateClose(overlay, () => {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    resolve(r);
                });
            };
            c.addEventListener('click', () => close(true));
            x.addEventListener('click', () => close(false));
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
            document.addEventListener('keydown', function h(e) {
                if (e.key === 'Enter') { document.removeEventListener('keydown', h); close(true); }
                else if (e.key === 'Escape') { document.removeEventListener('keydown', h); close(false); }
            });
        });
    }

    function _promptOverlay(message, options = {}) {
        const { defaultValue = '', title = 'Input Required', icon = 'prompt', selectRange = null } = options;
        return new Promise((resolve) => {
            const overlay = _createOverlay();
            const modal = _createModal();
            modal.innerHTML = `
                <div class="custom-modal-header">
                    <span class="custom-modal-icon">${_iconMarkupHTML(icon)}</span>
                    <h3 class="custom-modal-title">${title}</h3>
                </div>
                <div class="custom-modal-body">${message}</div>
                <input type="text" class="custom-modal-input" id="modal-input" value="${defaultValue}">
                <div class="custom-modal-actions">
                    <button class="custom-modal-btn custom-modal-btn-secondary" id="modal-cancel">Cancel</button>
                    <button class="custom-modal-btn custom-modal-btn-primary" id="modal-ok">OK</button>
                </div>`;
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            const inp = document.getElementById('modal-input');
            const ok = document.getElementById('modal-ok');
            const c = document.getElementById('modal-cancel');
            inp.focus();
            if (Array.isArray(selectRange) && selectRange.length === 2) {
                try { inp.setSelectionRange(selectRange[0], selectRange[1]); } catch(_) { inp.select(); }
            } else inp.select();
            let settled = false;
            const close = (r) => {
                if (settled) return;
                settled = true;
                _animateClose(overlay, () => {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    resolve(r);
                });
            };
            ok.addEventListener('click', () => close(inp.value));
            c.addEventListener('click', () => close(null));
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); close(inp.value); }
                else if (e.key === 'Escape') { e.preventDefault(); close(null); }
            });
        });
    }

    function _saveChangesOverlay(filename) {
        return new Promise((resolve) => {
            const displayName = filename || 'Untitled.smdoc';
            const overlay = _createOverlay();
            const modal = _createModal();
            modal.innerHTML = `
                <div class="custom-modal-header">
                    <span class="custom-modal-icon">${_iconMarkupHTML('save')}</span>
                    <h3 class="custom-modal-title">Save Changes?</h3>
                </div>
                <div class="custom-modal-body custom-modal-body-savechanges">
                    <div class="custom-modal-body-copy">Save changes before closing?</div>
                    <div class="custom-modal-filename" title="${displayName}">${displayName}</div>
                </div>
                <div class="custom-modal-actions">
                    <button class="custom-modal-btn custom-modal-btn-secondary" id="modal-dont-save">Don't Save</button>
                    <button class="custom-modal-btn custom-modal-btn-secondary" id="modal-cancel">Cancel</button>
                    <button class="custom-modal-btn custom-modal-btn-primary" id="modal-save">Save</button>
                </div>`;
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            const s  = document.getElementById('modal-save');
            const ds = document.getElementById('modal-dont-save');
            const c  = document.getElementById('modal-cancel');
            s.focus();
            let settled = false;
            const close = (r) => {
                if (settled) return;
                settled = true;
                _animateClose(overlay, () => {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    resolve(r);
                });
            };
            s.addEventListener('click', () => close('save'));
            ds.addEventListener('click', () => close('dont-save'));
            c.addEventListener('click', () => close('cancel'));
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close('cancel'); });
            document.addEventListener('keydown', function h(e) {
                if (e.key === 'Escape') { document.removeEventListener('keydown', h); close('cancel'); }
            });
        });
    }

    // Export
    window.ModalDialogs = ModalDialogs;
})();
