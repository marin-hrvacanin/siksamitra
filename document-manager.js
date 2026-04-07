/**
 * Document Management for śikṣāmitra Editor
 * Handles file operations, auto-save, and unsaved changes detection
 */

// Add document management methods to the SiksamitraEditor class
Object.assign(SiksamitraEditor.prototype, {
    /**
     * Get all audio attachments from the editor for saving in .smdoc format.
     * Extracts audio data as base64 data URIs from the embedded audio elements.
     * @returns {Array} Array of audio attachment objects
     */
    getAudioAttachments() {
        if (!this.quill || !this.quill.root) return [];
        
        const attachments = Array.from(this.quill.root.querySelectorAll('.ql-audio-attachment'));
        const result = [];
        
        for (const attachment of attachments) {
            const audioId = attachment.dataset.audioId;
            const label = attachment.dataset.audioLabel || 'Audio';
            const src = attachment.dataset.audioSrc || ''; // Base64 data URI
            const startTime = parseFloat(attachment.dataset.startTime) || 0;
            const endTime = attachment.dataset.endTime ? parseFloat(attachment.dataset.endTime) : null;
            
            if (audioId && src) {
                result.push({
                    id: audioId,
                    label: label,
                    src: src,
                    startTime: startTime,
                    endTime: endTime
                });
            }
        }
        
        return result;
    },
    
    /**
     * Load audio attachments into the editor when opening a .smdoc file.
     * Restores audio data URIs to the embedded audio elements.
     * @param {Array} attachments - Array of audio attachment objects from .smdoc file
     */
    loadAudioAttachments(attachments) {
        if (!this.quill || !this.quill.root || !attachments || !Array.isArray(attachments)) return;
        
        // Create a map of audio ID to attachment data
        const audioMap = new Map();
        for (const att of attachments) {
            if (att.id) {
                audioMap.set(att.id, att);
            }
        }
        
        // Find all audio attachment elements in the editor and restore their data
        const elements = Array.from(this.quill.root.querySelectorAll('.ql-audio-attachment'));
        for (const element of elements) {
            const audioId = element.dataset.audioId;
            if (audioId && audioMap.has(audioId)) {
                const data = audioMap.get(audioId);
                
                // Restore the audio source
                if (data.src) {
                    element.dataset.audioSrc = data.src;
                    
                    // Also update the actual audio element
                    const audio = element.querySelector('audio');
                    if (audio) {
                        audio.src = data.src;
                    }
                }
                
                // Restore other metadata
                if (data.label) element.dataset.audioLabel = data.label;
                if (data.startTime !== undefined) element.dataset.startTime = data.startTime;
                if (data.endTime !== undefined && data.endTime !== null) {
                    element.dataset.endTime = data.endTime;
                }
            }
        }
        
        // Refresh audio attachment UI
        if (typeof this.refreshAudioAttachments === 'function') {
            this.refreshAudioAttachments();
        }
    },

    async _postContentLoadRefresh() {
        const quill = this.quill;
        if (!quill) return;

        const silentSource = (typeof Quill !== 'undefined' && Quill.sources && Quill.sources.SILENT)
            ? Quill.sources.SILENT
            : 'silent';

        const doOne = () => {
            try { quill.update(silentSource); } catch {}
            try { this.refreshAudioAttachments?.(); } catch {}
            try { this.buildNavigationTree?.(); } catch {}
        };

        // Run a few times to catch layout settling (tab switch, fonts, images).
        doOne();
        await this._nextFrame?.();
        doOne();
        await this._nextFrame?.();
        doOne();
        setTimeout(doOne, 120);
        setTimeout(doOne, 300);
    },

    _openViewWindowForPath(path) {
        const url = `/api/file/view?path=${encodeURIComponent(path || '')}`;
        let win = null;
        try {
            win = window.open('', '_blank');
        } catch {
            win = null;
        }

        if (!win) {
            window.open(url, '_blank');
            return;
        }

        try {
            win.document.open();
            win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Loading…</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#fff;color:#111}
.box{display:flex;gap:12px;align-items:center;padding:18px 20px;border:1px solid rgba(0,0,0,.08);border-radius:10px}
.spinner{width:16px;height:16px;border:2px solid rgba(0,0,0,.18);border-top-color:rgba(0,0,0,.6);border-radius:50%;animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
</style></head><body><div class="box"><div class="spinner"></div><div>Loading document…</div></div></body></html>`);
            win.document.close();
        } catch {
            // ignore
        }

        setTimeout(() => {
            try {
                win.location.replace(url);
            } catch {
                try { win.location.href = url; } catch {}
            }
        }, 50);
    },

    async _fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
        if (typeof AbortController === 'undefined') {
            return fetch(url, options);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            return await fetch(url, { ...options, signal: controller.signal });
        } finally {
            clearTimeout(timeoutId);
        }
    },

    /**
     * Initialize file browser
     */
    initFileBrowser() {
        // File hub UI is rendered dynamically in renderFileBrowser().
        // (Legacy File header controls were removed from editor.html.)
        
        // Setup tab switching to load browser when File tab is clicked
        const fileTabButton = document.querySelector('[data-tab="file"]');
        if (fileTabButton) {
            fileTabButton.addEventListener('click', () => {
                setTimeout(() => this.loadFileBrowser(), 100);
                this.hideEditorArea();
            });

            // If File tab is the default active tab on startup, show the file browser immediately.
            if (fileTabButton.classList.contains('active')) {
                // During boot we keep the fullscreen loader visible and load the library from init().
                // Avoid racing duplicate requests here.
                if (!this._booting) {
                    setTimeout(() => this.loadFileBrowser(), 50);
                }
                this.hideEditorArea();
            }
        }
        
        // Show editor when switching away from File tab
        const otherTabs = document.querySelectorAll('.tab-header:not([data-tab="file"])');
        otherTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.showEditorArea();
            });
        });
    },

    /**
     * Load last session metadata on startup.
     * Note: scratch content is stored as a standalone HTML file in cache (see /api/cache/untitled).
     */
    async loadLastSession() {
        try {
            const response = await this._fetchWithTimeout('/api/cache/session', {}, 3000);
            if (!response.ok) return;

            const data = await response.json();
            const state = data.state;
            if (!state) return;

            this._sessionState = state;
            // Do not auto-load content on startup.
            this.currentFilePath = null;
            this.currentFileName = null;
            this.isDirty = false;
            this.updateTitle();
        } catch (error) {
            console.error('Error loading last session state:', error);
        }
    },

    _basenameFromPath(path) {
        if (!path) return '';
        const p = String(path).replace(/\\/g, '/');
        const parts = p.split('/');
        return parts[parts.length - 1] || '';
    },

    _dirnameFromPath(path) {
        if (!path) return '';
        const p = String(path).replace(/\\/g, '/');
        const parts = p.split('/');
        parts.pop();
        return parts.join('/') || '';
    },

    _setEditorFromHtml(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html || '', 'text/html');
        const editorDiv = doc.querySelector('.ql-editor');
        let htmlToLoad = '';
        if (editorDiv) {
            htmlToLoad = editorDiv.innerHTML.trim();
            htmlToLoad = htmlToLoad.replace(/^(<p><br><\/p>\s*)+/, '');
        } else {
            const body = doc.querySelector('body');
            htmlToLoad = body ? body.innerHTML.trim() : String(html || '').trim();
        }

        // Use Quill clipboard parsing so custom formats are recognized in the delta.
        this.setHTML(htmlToLoad);
        this.updateButtonStates(this.quill.getSelection(true));
    },

    async _openRecentByPath(path) {
        this.showBlockingLoader?.({
            title: 'Opening File',
            message: 'Loading document…'
        });
        await this._nextFrame?.();

        try {
            const resp = await fetch('/api/file/read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });
            if (!resp.ok) throw new Error('Failed to open recent file');
            const data = await resp.json();
            if (!data || !data.content) throw new Error('Empty response');

            // Handle .smdoc format
            const isSmdoc = SMDocFormat.isSMDoc(path);
            if (isSmdoc) {
                const smdoc = SMDocFormat.parse(data.content);
                this.setHTML(smdoc.content);
                
                // Load audio attachments if present
                if (smdoc.audio && smdoc.audio.attachments && typeof this.loadAudioAttachments === 'function') {
                    this.loadAudioAttachments(smdoc.audio.attachments);
                }
            } else {
                this._setEditorFromHtml(data.content);
            }
            
            this.currentFilePath = data.path || path;
            this.currentFileName = this._basenameFromPath(this.currentFilePath);
            this.isDirty = false;
            this.updateTitle();
            await this.loadAutoSavePreference();
            await this.saveSessionState();

            const editTab = document.querySelector('[data-tab="edit"]');
            if (editTab) editTab.click();
            await this._nextFrame?.();
            await this._nextFrame?.();
            await this._postContentLoadRefresh();
        } finally {
            this.hideBlockingLoader?.();
        }
    },

    async _cloneRecentByPath(path) {
        this.showBlockingLoader?.({
            title: 'Opening File',
            message: 'Cloning document…'
        });
        await this._nextFrame?.();

        try {
            const resp = await fetch('/api/file/read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });
            if (!resp.ok) throw new Error('Failed to load file for cloning');
            const data = await resp.json();
            if (!data || !data.content) throw new Error('Empty response');

            // Handle .smdoc format
            const isSmdoc = SMDocFormat.isSMDoc(path);
            if (isSmdoc) {
                const smdoc = SMDocFormat.parse(data.content);
                this.setHTML(smdoc.content);
                
                // Load audio attachments if present
                if (smdoc.audio && smdoc.audio.attachments && typeof this.loadAudioAttachments === 'function') {
                    this.loadAudioAttachments(smdoc.audio.attachments);
                }
            } else {
                this._setEditorFromHtml(data.content);
            }
            this.currentFilePath = null;

            const base = this._basenameFromPath(data.path || path) || 'Untitled.smdoc';
            const baseNoExt = base.replace(/\.(smdoc|html?)$/i, '');
            // Use same format for the copy
            const ext = isSmdoc ? '.smdoc' : '.html';
            this.currentFileName = `${baseNoExt} copy${ext}`;
            this.isDirty = true;
            this.updateTitle();
            await this.loadAutoSavePreference();
            await this.saveSessionState();

            const editTab = document.querySelector('[data-tab="edit"]');
            if (editTab) editTab.click();
            await this._nextFrame?.();
            await this._nextFrame?.();
            await this._postContentLoadRefresh();
        } finally {
            this.hideBlockingLoader?.();
        }
    },

    async _removeRecentByPath(path) {
        const resp = await fetch('/api/recents/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });
        if (!resp.ok) throw new Error('Failed to remove recent');
    },

    async _deleteFileByPath(path) {
        const resp = await fetch('/api/file/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });
        if (!resp.ok) throw new Error('Failed to delete file');
    },

    /**
     * Load file browser with recent documents
     */
    async loadFileBrowser(options = {}) {
        const autoRetry = !!options.autoRetry;
        const maxAttempts = Number.isFinite(options.maxAttempts)
            ? Math.max(1, options.maxAttempts)
            : (autoRetry ? 9999 : 15);

        let attempt = 0;
        let lastError = null;

        while (attempt < maxAttempts) {
            attempt += 1;
            try {
                const response = await this._fetchWithTimeout(`/api/library?t=${Date.now()}`, {}, 4000);
                if (!response.ok) throw new Error('Failed to load library');

                const library = await response.json();
                this._libraryState = library;
                this.renderFileBrowser(library);
                return library;
            } catch (error) {
                lastError = error;
                console.error('Error loading file browser:', error);

                if (!autoRetry) break;

                // Keep the fullscreen loader visible during boot; otherwise just retry silently.
                if (this._booting && typeof this.setFullscreenLoaderSubtitle === 'function') {
                    this.setFullscreenLoaderSubtitle(`Loading preferences and recents… retrying (${attempt}/${maxAttempts})`);
                }

                const backoffMs = Math.min(2000, 150 + Math.floor(150 * Math.pow(1.35, attempt)));
                await new Promise((r) => setTimeout(r, backoffMs));
            }
        }

        // If we got here, retries are exhausted (or autoRetry off).
        if (autoRetry) {
            throw lastError || new Error('Failed to load library');
        }

        const container = document.getElementById('fileBrowserList');
        if (container) {
            container.innerHTML = `
                <div class="file-home">
                    <div class="file-panel" style="max-width: 720px;">
                        <h3>File</h3>
                        <div class="file-panel-subtitle">Failed to load library data. This is usually caused by a corrupted cache/preferences file or the local server not responding.</div>
                        <div class="file-actions-grid">
                            <button class="file-home-action primary" id="fileFallbackNew">New</button>
                            <button class="file-home-action" id="fileFallbackOpen">Open</button>
                            <button class="file-home-action" id="fileFallbackRetry">Retry</button>
                        </div>
                    </div>
                </div>
            `;
            container.querySelector('#fileFallbackNew')?.addEventListener('click', async () => {
                await this.createNewDocument();
            });
            container.querySelector('#fileFallbackOpen')?.addEventListener('click', async () => {
                await this.openDocument();
            });
            container.querySelector('#fileFallbackRetry')?.addEventListener('click', () => this.loadFileBrowser());
        }
        return null;
    },

    /**
     * Render file browser - Elegant two-column design inspired by palm leaf manuscripts
     */
    renderFileBrowser(docs) {
        const container = document.getElementById('fileBrowserList');
        if (!container) return;

        const library = docs || {};
        const recentsRaw = Array.isArray(library.recents) ? library.recents : [];
        const query = (this._recentSearchQuery || '').trim().toLowerCase();
        const currentNorm = this._normalizeForCompare(this.currentFilePath);
        const recentsFiltered = recentsRaw.filter(r => this._normalizeForCompare(r?.path) !== currentNorm);
        const recents = query
            ? recentsFiltered.filter(r => {
                const hay = `${r.name || ''} ${r.dir || ''} ${r.path || ''}`.toLowerCase();
                return hay.includes(query);
            })
            : recentsFiltered;

        const scratch = library.scratch || {};
        const hasScratchRaw = !!(scratch && scratch.exists && (scratch.size || 0) > 0);
        // Only suppress the Continue banner when the user explicitly loaded the cached scratch.
        // Otherwise, even if the current doc is "Untitled", the cache may contain a prior draft.
        const isScratchOpen = !!this._scratchOpenedFromCache && !this.currentFilePath;
        const hasScratch = hasScratchRaw && !isScratchOpen;

        const formatWhen = (tsSec) => {
            if (!tsSec) return '';
            try {
                const d = new Date(tsSec * 1000);
                const now = new Date();
                const diff = now - d;
                if (diff < 60000) return 'Just now';
                if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
                if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
                if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;
                return d.toLocaleDateString();
            } catch { return ''; }
        };

        container.innerHTML = '';

        // Main two-column layout
        const fileHome = document.createElement('div');
        fileHome.className = 'file-home';

        // === LEFT COLUMN - Actions ===
        const leftCol = document.createElement('div');
        leftCol.className = 'file-home-left';

        // Continue scratch banner (if applicable)
        if (hasScratch) {
            const when = formatWhen(scratch.modified);
            const continuePanel = document.createElement('div');
            continuePanel.className = 'file-panel continue-panel';
            continuePanel.innerHTML = `
                <h3>Continue Editing</h3>
                <div class="continue-row">
                    <div class="continue-meta">
                        <div class="continue-name">Untitled.smdoc</div>
                        <div class="continue-hint">${when ? when : 'Unsaved document'}</div>
                    </div>
                    <span class="continue-badge">Draft</span>
                </div>
                <div class="file-actions-grid" style="margin-top: 12px;">
                    <button class="file-home-action primary" data-action="continue">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9.65661 17L6.99975 17L6.99975 14M6.10235 14.8974L17.4107 3.58902C18.1918 2.80797 19.4581 2.80797 20.2392 3.58902C21.0202 4.37007 21.0202 5.6364 20.2392 6.41745L8.764 17.8926C8.22794 18.4287 7.95992 18.6967 7.6632 18.9271C7.39965 19.1318 7.11947 19.3142 6.8256 19.4723C6.49475 19.6503 6.14115 19.7868 5.43395 20.0599L3 20.9998L3.78312 18.6501C4.05039 17.8483 4.18403 17.4473 4.3699 17.0729C4.53497 16.7404 4.73054 16.424 4.95409 16.1276C5.20582 15.7939 5.50466 15.4951 6.10235 14.8974Z"></path>
                        </svg>
                        <span>Continue</span>
                    </button>
                    <button class="file-home-action" data-action="discard">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 6L17.1991 18.0129C17.129 19.065 17.0939 19.5911 16.8667 19.99C16.6666 20.3412 16.3648 20.6235 16.0011 20.7998C15.588 21 15.0607 21 14.0062 21H9.99377C8.93927 21 8.41202 21 7.99889 20.7998C7.63517 20.6235 7.33339 20.3412 7.13332 19.99C6.90607 19.5911 6.871 19.065 6.80086 18.0129L6 6M4 6H20M16 6L15.7294 5.18807C15.4671 4.40125 15.3359 4.00784 15.0927 3.71698C14.8779 3.46013 14.6021 3.26132 14.2905 3.13878C13.9376 3 13.523 3 12.6936 3H11.3064C10.477 3 10.0624 3 9.70951 3.13878C9.39792 3.26132 9.12208 3.46013 8.90729 3.71698C8.66405 4.00784 8.53292 4.40125 8.27064 5.18807L8 6M14 10V17M10 10V17"></path>
                        </svg>
                        <span>Discard</span>
                    </button>
                </div>
            `;
            continuePanel.querySelector('[data-action="continue"]').addEventListener('click', async () => {
                if (!(await this.checkUnsavedChanges())) return;
                await this._continueScratch();
            });
            continuePanel.querySelector('[data-action="discard"]').addEventListener('click', async () => {
                const ok = await ModalDialogs.confirm('Discard unsaved document?', 'Discard');
                if (!ok) return;
                await this.clearUntitled();
                await this.loadFileBrowser();
            });
            leftCol.appendChild(continuePanel);
        }

        // Actions panel
        const actionsPanel = document.createElement('div');
        actionsPanel.className = 'file-panel';
        actionsPanel.innerHTML = `
            <h3>Actions</h3>
            <div class="file-actions-grid">
                <button class="file-home-action primary" data-action="new">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M13 3H8.2C7.0799 3 6.51984 3 6.09202 3.21799C5.71569 3.40973 5.40973 3.71569 5.21799 4.09202C5 4.51984 5 5.0799 5 6.2V17.8C5 18.9201 5 19.4802 5.21799 19.908C5.40973 20.2843 5.71569 20.5903 6.09202 20.782C6.51984 21 7.0799 21 8.2 21H12M13 3L19 9M13 3V7.4C13 7.96005 13 8.24008 13.109 8.45399C13.2049 8.64215 13.3578 8.79513 13.546 8.89101C13.7599 9 14.0399 9 14.6 9H19M19 9V12M17 19H21M19 17V21"></path>
                    </svg>
                    <span>New</span>
                </button>
                <button class="file-home-action" data-action="open">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 8.2C3 7.07989 3 6.51984 3.21799 6.09202C3.40973 5.71569 3.71569 5.40973 4.09202 5.21799C4.51984 5 5.0799 5 6.2 5H9.67452C10.1637 5 10.4083 5 10.6385 5.05526C10.8425 5.10425 11.0376 5.18506 11.2166 5.29472C11.4184 5.4184 11.5914 5.59135 11.9373 5.93726L12.0627 6.06274C12.4086 6.40865 12.5816 6.5816 12.7834 6.70528C12.9624 6.81494 13.1575 6.89575 13.3615 6.94474C13.5917 7 13.8363 7 14.3255 7H17.8C18.9201 7 19.4802 7 19.908 7.21799C20.2843 7.40973 20.5903 7.71569 20.782 8.09202C21 8.51984 21 9.0799 21 10.2V15.8C21 16.9201 21 17.4802 20.782 17.908C20.5903 18.2843 20.2843 18.5903 19.908 18.782C19.4802 19 18.9201 19 17.8 19H6.2C5.07989 19 4.51984 19 4.09202 18.782C3.71569 18.5903 3.40973 18.2843 3.21799 17.908C3 17.4802 3 16.9201 3 15.8V8.2Z"></path>
                    </svg>
                    <span>Open</span>
                </button>
                <button class="file-home-action" data-action="save">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M19 15V21M19 21L17 19M19 21L21 19M13 3H8.2C7.0799 3 6.51984 3 6.09202 3.21799C5.71569 3.40973 5.40973 3.71569 5.21799 4.09202C5 4.51984 5 5.0799 5 6.2V17.8C5 18.9201 5 19.4802 5.21799 19.908C5.40973 20.2843 5.71569 20.5903 6.09202 20.782C6.51984 21 7.0799 21 8.2 21H14M13 3L19 9M13 3V7.4C13 7.96005 13 8.24008 13.109 8.45399C13.2049 8.64215 13.3578 8.79513 13.546 8.89101C13.7599 9 14.0399 9 14.6 9H19M19 9V11M9 17H13M9 13H15M9 9H10"></path>
                    </svg>
                    <span>Save</span>
                </button>
                <button class="file-home-action" data-action="saveAs">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M8 3.00152C8.06462 3.00146 8.13126 3.00146 8.2 3.00146H13.462C14.0268 3.00146 14.3092 3.00146 14.5699 3.07329C14.7198 3.11459 14.8641 3.17315 15 3.24761M8 3.00152C7.01165 3.00229 6.49359 3.01484 6.09202 3.21945C5.71569 3.4112 5.40973 3.71716 5.21799 4.09348C5 4.52131 5 5.08136 5 6.20146V17.8015C5 18.9216 5 19.4816 5.21799 19.9094C5.40973 20.2858 5.71569 20.5917 6.09202 20.7835C6.51984 21.0015 7.0799 21.0015 8.2 21.0015H15.8C16.9201 21.0015 17.4802 21.0015 17.908 20.7835C18.2843 20.5917 18.5903 20.2858 18.782 19.9094C19 19.4816 19 18.9216 19 17.8015V9.12396C19 8.70793 19 8.49991 18.9592 8.30094C18.9229 8.12442 18.863 7.9536 18.781 7.79312C18.6886 7.61224 18.5587 7.44981 18.2988 7.12494L15.9608 4.20244C15.608 3.76141 15.4315 3.54089 15.2126 3.38216C15.1445 3.33281 15.0735 3.28788 15 3.24761M8 3.00152V7.00002H15V3.24761M15 15C15 16.6569 13.6569 18 12 18C10.3431 18 9 16.6569 9 15C9 13.3432 10.3431 12 12 12C13.6569 12 15 13.3432 15 15Z"></path>
                    </svg>
                    <span>Save As</span>
                </button>
            </div>
        `;
        actionsPanel.querySelector('[data-action="new"]').addEventListener('click', () => this.createNewDocument());
        actionsPanel.querySelector('[data-action="open"]').addEventListener('click', () => this.openDocument());
        actionsPanel.querySelector('[data-action="save"]').addEventListener('click', () => this.saveDocument());
        actionsPanel.querySelector('[data-action="saveAs"]').addEventListener('click', () => this.saveAsDocument());
        leftCol.appendChild(actionsPanel);

        // Options panel
        const optionsPanel = document.createElement('div');
        optionsPanel.className = 'file-panel';
        optionsPanel.innerHTML = `
            <h3>Options</h3>
            <label class="file-option-row">
                <input type="checkbox" id="autoSaveToggleHub" ${this.autoSaveEnabled ? 'checked' : ''}>
                <span>Auto-save for this document</span>
            </label>
        `;
        optionsPanel.querySelector('#autoSaveToggleHub').addEventListener('change', async (e) => {
            await this.toggleAutoSaveForCurrentDoc();
            e.target.checked = this.autoSaveEnabled;
        });
        leftCol.appendChild(optionsPanel);

        fileHome.appendChild(leftCol);

        // === RIGHT COLUMN - Recents first, then Library ===
        const rightCol = document.createElement('div');
        rightCol.className = 'file-home-right';

        // Recent documents panel (top)
        const recentsPanel = document.createElement('div');
        recentsPanel.className = 'file-panel';
        recentsPanel.innerHTML = `
            <div class="file-panel-header">
                <h3>Recent</h3>
                <span class="file-panel-count">${recents.length}</span>
            </div>
            <div class="file-browser-search">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input type="text" class="file-browser-search-input" placeholder="Search..." value="${this._recentSearchQuery || ''}" id="recentSearchInput">
            </div>
            <div class="recent-tree" id="recentsContainer"></div>
        `;

        const searchInput = recentsPanel.querySelector('#recentSearchInput');
        searchInput.addEventListener('input', (e) => {
            this._recentSearchQuery = e.target.value;
            if (this._libraryState) {
                this.renderFileBrowser(this._libraryState);
                setTimeout(() => {
                    const input = document.getElementById('recentSearchInput');
                    if (input) {
                        input.focus();
                        input.setSelectionRange(input.value.length, input.value.length);
                    }
                }, 50);
            }
        });

        const recentsContainer = recentsPanel.querySelector('#recentsContainer');
        if (!recents || recents.length === 0) {
            recentsContainer.innerHTML = `
                <div class="library-empty">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <p>${query ? 'No matching documents' : 'No recent documents'}</p>
                </div>
            `;
        } else {
            recents.forEach(r => {
                const item = document.createElement('div');
                item.className = `library-item recent-item${r.exists ? '' : ' deleted'}`;
                item.dataset.path = r.path || '';

                const name = r.name || this._basenameFromPath(r.path) || 'Untitled.smdoc';
                const path = r.path || '';
                const when = formatWhen(r.modified);
                const size = (typeof r.size === 'number' && r.size > 0) ? this._formatFileSize(r.size) : '';

                // Determine icon based on file type, aligned with Library logic
                let iconPath = '<path d="M19 9V17.8C19 18.9201 19 19.4802 18.782 19.908C18.5903 20.2843 18.2843 20.5903 17.908 20.782C17.4802 21 16.9201 21 15.8 21H8.2C7.07989 21 6.51984 21 6.09202 20.782C5.71569 20.5903 5.40973 20.2843 5.21799 19.908C5 19.4802 5 18.9201 5 17.8V6.2C5 5.07989 5 4.51984 5.21799 4.09202C5.40973 3.71569 5.71569 3.40973 6.09202 3.21799C6.51984 3 7.0799 3 8.2 3H13M19 9L13 3M19 9H14C13.4477 9 13 8.55228 13 8V3"></path>'; // Default file
                const ext = (name || path).split('.').pop().toLowerCase();
                if (['html', 'htm', 'xml', 'js', 'py', 'cpp', 'c', 'cxx', 'css', 'json', 'java', 'ts'].includes(ext)) {
                    iconPath = '<path d="M10 17L8 15L10 13M14 13L16 15L14 17M13 3H8.2C7.0799 3 6.51984 3 6.09202 3.21799C5.71569 3.40973 5.40973 3.71569 5.21799 4.09202C5 4.51984 5 5.0799 5 6.2V17.8C5 18.9201 5 19.4802 5.21799 19.908C5.40973 20.2843 5.71569 20.5903 6.09202 20.782C6.51984 21 7.0799 21 8.2 21H15.8C16.9201 21 17.4802 21 17.908 20.782C18.2843 20.5903 18.5903 20.2843 18.782 19.908C19 19.4802 19 18.9201 19 17.8V9M13 3L19 9M13 3V8C13 8.55228 13.4477 9 14 9H19"></path>';
                } else if (['svg', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'ico'].includes(ext)) {
                    iconPath = '<path d="M14.2639 15.9375L12.5958 14.2834C11.7909 13.4851 11.3884 13.086 10.9266 12.9401C10.5204 12.8118 10.0838 12.8165 9.68048 12.9536C9.22188 13.1095 8.82814 13.5172 8.04068 14.3326L4.04409 18.2801M14.2639 15.9375L14.6053 15.599C15.4112 14.7998 15.8141 14.4002 16.2765 14.2543C16.6831 14.126 17.12 14.1311 17.5236 14.2687C17.9824 14.4251 18.3761 14.8339 19.1634 15.6514L20 16.4934M14.2639 15.9375L18.275 19.9565M18.275 19.9565C17.9176 20 17.4543 20 16.8 20H7.2C6.07989 20 5.51984 20 5.09202 19.782C4.71569 19.5903 4.40973 19.2843 4.21799 18.908C4.12796 18.7313 4.07512 18.5321 4.04409 18.2801M18.275 19.9565C18.5293 19.9256 18.7301 19.8727 18.908 19.782C19.2843 19.5903 19.5903 19.2843 19.782 18.908C20 18.4802 20 17.9201 20 16.8V16.4934M4.04409 18.2801C4 17.9221 4 17.4575 4 16.8V7.2C4 6.0799 4 5.51984 4.21799 5.09202C4.40973 4.71569 4.71569 4.40973 5.09202 4.21799C5.51984 4 6.07989 4 7.2 4H16.8C17.9201 4 18.4802 4 18.908 4.21799C19.2843 4.40973 19.5903 4.71569 19.782 5.09202C20 5.51984 20 6.0799 20 7.2V16.4934M17 8.99989C17 10.1045 16.1046 10.9999 15 10.9999C13.8954 10.9999 13 10.1045 13 8.99989C13 7.89532 13.8954 6.99989 15 6.99989C16.1046 6.99989 17 7.89532 17 8.99989Z"></path>';
                } else if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(ext)) {
                    iconPath = '<path d="M7 5V19M17 5V19M3 8H7M17 8H21M3 16H7M17 16H21M3 12H21M6.2 20H17.8C18.9201 20 19.4802 20 19.908 19.782C20.2843 19.5903 20.5903 19.2843 20.782 18.908C21 18.4802 21 17.9201 21 16.8V7.2C21 6.0799 21 5.51984 20.782 5.09202C20.5903 4.71569 20.2843 4.40973 19.908 4.21799C19.4802 4 18.9201 4 17.8 4H6.2C5.0799 4 4.51984 4 4.09202 4.21799C3.71569 4.40973 3.40973 4.71569 3.21799 5.09202C3 5.51984 3 6.07989 3 7.2V16.8C3 17.9201 3 18.4802 3.21799 18.908C3.40973 19.2843 3.71569 19.5903 4.09202 19.782C4.51984 20 5.07989 20 6.2 20Z"></path>';
                } else if (['txt', 'doc', 'docx', 'md', 'rtf'].includes(ext)) {
                    iconPath = '<path d="M9 17H15M9 13H15M9 9H10M13 3H8.2C7.0799 3 6.51984 3 6.09202 3.21799C5.71569 3.40973 5.40973 3.71569 5.21799 4.09202C5 4.51984 5 5.0799 5 6.2V17.8C5 18.9201 5 19.4802 5.21799 19.908C5.40973 20.2843 5.71569 20.5903 6.09202 20.782C6.51984 21 7.0799 21 8.2 21H15.8C16.9201 21 17.4802 21 17.908 20.782C18.2843 20.5903 18.5903 20.2843 18.782 19.908C19 19.4802 19 18.9201 19 17.8V9M13 3L19 9M13 3V7.4C13 7.96005 13 8.24008 13.109 8.45399C13.2049 8.64215 13.3578 8.79513 13.546 8.89101C13.7599 9 14.0399 9 14.6 9H19"></path>';
                } else if (['mp3', 'wav', 'aac', 'flac', 'm4a'].includes(ext)) {
                    iconPath = '<path d="M19 9V17.8C19 18.9201 19 19.4802 18.782 19.908C18.5903 20.2843 18.2843 20.5903 17.908 20.782C17.4802 21 16.9201 21 15.8 21H8.2C7.07989 21 6.51984 21 6.09202 20.782C5.71569 20.5903 5.40973 20.2843 5.21799 19.908C5 19.4802 5 18.9201 5 17.8V6.2C5 5.07989 5 4.51984 5.21799 4.09202C5.40973 3.71569 5.71569 3.40973 6.09202 3.21799C6.51984 3 7.0799 3 8.2 3H13M19 9L13 3M19 9H16.2C15.0799 9 14.5198 9 14.092 8.78201C13.7157 8.59027 13.4097 8.28431 13.218 7.90798C13 7.48016 13 6.9201 13 5.8V3M14.5 13C15.1137 13.4913 15.5 14.2053 15.5 15C15.5 15.7947 15.1137 16.5087 14.5 17M8.5 14H9.83333L11.5 12V18L9.83333 16H8.5V14Z"></path>';
                }

                const formatPath = (p, maxLen = 72) => {
                    if (!p) return '';
                    const s = String(p);
                    if (s.length <= maxLen) return s;
                    const head = Math.max(10, Math.floor(maxLen * 0.25));
                    const tail = Math.max(18, maxLen - head - 1);
                    return `${s.slice(0, head)}…${s.slice(-tail)}`;
                };
                const pathShort = formatPath(path);

                item.innerHTML = `
                    <div class="library-item-main">
                        <svg class="library-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            ${iconPath}
                        </svg>
                        <div class="recent-text">
                            <span class="library-name" title="${name}">${name}</span>
                            ${path ? `<button class="recent-path-btn" data-action="copyPath" title="${path}">${pathShort}</button>` : ''}
                        </div>
                        ${(when || size) ? `
                            <div class="recent-meta">
                                ${when ? `<div class="recent-when">${when}</div>` : '<div class="recent-when"></div>'}
                                ${size ? `<div class="recent-size">${size}</div>` : '<div class="recent-size"></div>'}
                            </div>
                        ` : ''}
                    </div>
                    <div class="library-actions">
                        ${r.exists ? `
                            <button class="library-action-btn view" data-action="view" title="Read">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 10.4V20M12 10.4C12 8.15979 12 7.03969 11.564 6.18404C11.1805 5.43139 10.5686 4.81947 9.81596 4.43597C8.96031 4 7.84021 4 5.6 4H4.6C4.03995 4 3.75992 4 3.54601 4.10899C3.35785 4.20487 3.20487 4.35785 3.10899 4.54601C3 4.75992 3 5.03995 3 5.6V16.4C3 16.9601 3 17.2401 3.10899 17.454C3.20487 17.6422 3.35785 17.7951 3.54601 17.891C3.75992 18 4.03995 18 4.6 18H7.54668C8.08687 18 8.35696 18 8.61814 18.0466C8.84995 18.0879 9.0761 18.1563 9.29191 18.2506C9.53504 18.3567 9.75977 18.5065 10.2092 18.8062L12 20M12 10.4C12 8.15979 12 7.03969 12.436 6.18404C12.8195 5.43139 13.4314 4.81947 14.184 4.43597C15.0397 4 16.1598 4 18.4 4H19.4C19.9601 4 20.2401 4 20.454 4.10899C20.6422 4.20487 20.7951 4.35785 20.891 4.54601C21 4.75992 21 5.03995 21 5.6V16.4C21 16.9601 21 17.2401 20.891 17.454C20.7951 17.6422 20.6422 17.7951 20.454 17.891C20.2401 18 19.9601 18 19.4 18H16.4533C15.9131 18 15.643 18 15.3819 18.0466C15.15 18.0879 14.9239 18.1563 14.7081 18.2506C14.465 18.3567 14.2402 18.5065 13.7908 18.8062L12 20"></path>
                                </svg>
                            </button>
                            <button class="library-action-btn" data-action="edit" title="Edit">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M9.65661 17L6.99975 17L6.99975 14M6.10235 14.8974L17.4107 3.58902C18.1918 2.80797 19.4581 2.80797 20.2392 3.58902C21.0202 4.37007 21.0202 5.6364 20.2392 6.41745L8.764 17.8926C8.22794 18.4287 7.95992 18.6967 7.6632 18.9271C7.39965 19.1318 7.11947 19.3142 6.8256 19.4723C6.49475 19.6503 6.14115 19.7868 5.43395 20.0599L3 20.9998L3.78312 18.6501C4.05039 17.8483 4.18403 17.4473 4.3699 17.0729C4.53497 16.7404 4.73054 16.424 4.95409 16.1276C5.20582 15.7939 5.50466 15.4951 6.10235 14.8974Z"></path>
                                </svg>
                            </button>
                            <button class="library-action-btn" data-action="clone" title="Clone">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M15 3V6.4C15 6.96005 15 7.24008 15.109 7.45399C15.2049 7.64215 15.3578 7.79513 15.546 7.89101C15.7599 8 16.0399 8 16.6 8H20M10 8H6C4.89543 8 4 8.89543 4 10V19C4 20.1046 4.89543 21 6 21H12C13.1046 21 14 20.1046 14 19V16M16 3H13.2C12.0799 3 11.5198 3 11.092 3.21799C10.7157 3.40973 10.4097 3.71569 10.218 4.09202C10 4.51984 10 5.0799 10 6.2V12.8C10 13.9201 10 14.4802 10.218 14.908C10.4097 15.2843 10.7157 15.5903 11.092 15.782C11.5198 16 12.0799 16 13.2 16H16.8C17.9201 16 18.4802 16 18.908 15.782C19.2843 15.5903 19.5903 15.2843 19.782 14.908C20 14.4802 20 13.9201 20 12.8V7L16 3Z"></path>
                                </svg>
                            </button>
                            <button class="library-action-btn" data-action="share" title="Show in folder">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M9 13H15M15 13L13 11M15 13L13 15M12.0627 6.06274L11.9373 5.93726C11.5914 5.59135 11.4184 5.4184 11.2166 5.29472C11.0376 5.18506 10.8425 5.10425 10.6385 5.05526C10.4083 5 10.1637 5 9.67452 5H6.2C5.0799 5 4.51984 5 4.09202 5.21799C3.71569 5.40973 3.40973 5.71569 3.21799 6.09202C3 6.51984 3 7.07989 3 8.2V15.8C3 16.9201 3 17.4802 3.21799 17.908C3.40973 18.2843 3.71569 18.5903 4.09202 18.782C4.51984 19 5.07989 19 6.2 19H17.8C18.9201 19 19.4802 19 19.908 18.782C20.2843 18.5903 20.5903 18.2843 20.782 17.908C21 17.4802 21 16.9201 21 15.8V10.2C21 9.0799 21 8.51984 20.782 8.09202C20.5903 7.71569 20.2843 7.40973 19.908 7.21799C19.4802 7 18.9201 7 17.8 7H14.3255C13.8363 7 13.5917 7 13.3615 6.94474C13.1575 6.89575 12.9624 6.81494 12.7834 6.70528C12.5816 6.5816 12.4086 6.40865 12.0627 6.06274Z"></path>
                                </svg>
                            </button>
                        ` : ''}
                        <button class="library-action-btn" data-action="remove" title="Remove from list">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M6 6L18 18M18 6L6 18"></path>
                            </svg>
                        </button>
                        ${r.exists ? `
                            <button class="library-action-btn danger" data-action="delete" title="Delete file">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M18 6L17.1991 18.0129C17.129 19.065 17.0939 19.5911 16.8667 19.99C16.6666 20.3412 16.3648 20.6235 16.0011 20.7998C15.588 21 15.0607 21 14.0062 21H9.99377C8.93927 21 8.41202 21 7.99889 20.7998C7.63517 20.6235 7.33339 20.3412 7.13332 19.99C6.90607 19.5911 6.871 19.065 6.80086 18.0129L6 6M4 6H20M16 6L15.7294 5.18807C15.4671 4.40125 15.3359 4.00784 15.0927 3.71698C14.8779 3.46013 14.6021 3.26132 14.2905 3.13878C13.9376 3 13.523 3 12.6936 3H11.3064C10.477 3 10.0624 3 9.70951 3.13878C9.39792 3.26132 9.12208 3.46013 8.90729 3.71698C8.66405 4.00784 8.53292 4.40125 8.27064 5.18807L8 6M14 10V17M10 10V17"></path>
                                </svg>
                            </button>
                        ` : ''}
                    </div>
                `;

                item.querySelector('[data-action="copyPath"]')?.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    try {
                        await navigator.clipboard.writeText(path);
                    } catch (err) {
                        await ModalDialogs.alert(path, 'Path', '📎');
                    }
                });

                item.addEventListener('click', (e) => {
                    if (!r.exists) return;
                    // Single-click opens the viewer by default.
                    if (e.target && e.target.closest && e.target.closest('button')) return;
                    this._openViewerWindow(path);
                });

                item.querySelector('[data-action="view"]')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._openViewerWindow(path);
                });

                item.querySelector('[data-action="edit"]')?.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!(await this.checkUnsavedChanges())) return;
                    await this._openRecentByPath(path);
                });

                item.querySelector('[data-action="clone"]')?.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!(await this.checkUnsavedChanges())) return;
                    await this._cloneRecentByPath(path);
                });

                item.querySelector('[data-action="share"]')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._shareFile(path);
                });

                item.querySelector('[data-action="remove"]')?.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await this._removeRecentByPath(path);
                    await this.loadFileBrowser();
                });

                item.querySelector('[data-action="delete"]')?.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const ok = await ModalDialogs.confirm(`Delete this file?\n\n${name}`, 'Delete');
                    if (!ok) return;
                    await this._deleteFileByPath(path);
                    await this.loadFileBrowser();
                });

                recentsContainer.appendChild(item);
            });
        }
        rightCol.appendChild(recentsPanel);

        // Library panel below Recents
        const libraryPanel = document.createElement('div');
        libraryPanel.className = 'file-panel';
        libraryPanel.innerHTML = `
            <div class="file-panel-header">
                <h3>Library</h3>
                <div class="file-panel-toolbar">
                    <button class="file-toolbar-btn" data-action="openFolder" title="Open Library folder">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9 13H15M15 13L13 11M15 13L13 15M12.0627 6.06274L11.9373 5.93726C11.5914 5.59135 11.4184 5.4184 11.2166 5.29472C11.0376 5.18506 10.8425 5.10425 10.6385 5.05526C10.4083 5 10.1637 5 9.67452 5H6.2C5.0799 5 4.51984 5 4.09202 5.21799C3.71569 5.40973 3.40973 5.71569 3.21799 6.09202C3 6.51984 3 7.07989 3 8.2V15.8C3 16.9201 3 17.4802 3.21799 17.908C3.40973 18.2843 3.71569 18.5903 4.09202 18.782C4.51984 19 5.07989 19 6.2 19H17.8C18.9201 19 19.4802 19 19.908 18.782C20.2843 18.5903 20.5903 18.2843 20.782 17.908C21 17.4802 21 16.9201 21 15.8V10.2C21 9.0799 21 8.51984 20.782 8.09202C20.5903 7.71569 20.2843 7.40973 19.908 7.21799C19.4802 7 18.9201 7 17.8 7H14.3255C13.8363 7 13.5917 7 13.3615 6.94474C13.1575 6.89575 12.9624 6.81494 12.7834 6.70528C12.5816 6.5816 12.4086 6.40865 12.0627 6.06274Z"></path>
                        </svg>
                    </button>
                    <button class="file-toolbar-btn" data-action="newFolder" title="New Folder">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9 13H15M12 10V16M12.0627 6.06274L11.9373 5.93726C11.5914 5.59135 11.4184 5.4184 11.2166 5.29472C11.0376 5.18506 10.8425 5.10425 10.6385 5.05526C10.4083 5 10.1637 5 9.67452 5H6.2C5.0799 5 4.51984 5 4.09202 5.21799C3.71569 5.40973 3.40973 5.71569 3.21799 6.09202C3 6.51984 3 7.07989 3 8.2V15.8C3 16.9201 3 17.4802 3.21799 17.908C3.40973 18.2843 3.71569 18.5903 4.09202 18.782C4.51984 19 5.07989 19 6.2 19H17.8C18.9201 19 19.4802 19 19.908 18.782C20.2843 18.5903 20.5903 18.2843 20.782 17.908C21 17.4802 21 16.9201 21 15.8V10.2C21 9.0799 21 8.51984 20.782 8.09202C20.5903 7.71569 20.2843 7.40973 19.908 7.21799C19.4802 7 18.9201 7 17.8 7H14.3255C13.8363 7 13.5917 7 13.3615 6.94474C13.1575 6.89575 12.9624 6.81494 12.7834 6.70528C12.5816 6.5816 12.4086 6.40865 12.0627 6.06274Z"></path>
                        </svg>
                    </button>
                    <button class="file-toolbar-btn" data-action="refresh" title="Refresh">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 12a9 9 0 1 1-2.64-6.36"></path>
                            <polyline points="21 4 21 10 15 10"></polyline>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="library-tree" id="libraryContent"></div>
        `;

        libraryPanel.querySelector('[data-action="openFolder"]').addEventListener('click', async () => {
            // Try pywebview explorer first
            if (window.pywebview && window.pywebview.api && window.pywebview.api.open_in_explorer) {
                try {
                    if (!this._libraryRoot) {
                        const resp = await fetch('/api/library/browse');
                        if (!resp.ok) throw new Error('Failed to load library root');
                        const data = await resp.json();
                        this._libraryRoot = data.root;
                    }
                    if (this._libraryRoot) {
                        await window.pywebview.api.open_in_explorer(this._libraryRoot);
                        return;
                    }
                } catch (e) {
                    // Fall through to generic share flow
                }
            }

            // Fallback: fetch the root once.
            try {
                const resp = await fetch('/api/library/browse');
                if (!resp.ok) throw new Error('Failed to load library root');
                const data = await resp.json();
                this._libraryRoot = data.root;
                if (this._libraryRoot) await this._shareFile(this._libraryRoot);
            } catch (e) {
                await ModalDialogs.alert(`Failed to open Library folder: ${e.message}`, 'Error', ModalDialogs.icons.error);
            }
        });
        libraryPanel.querySelector('[data-action="newFolder"]').addEventListener('click', () => this._createLibraryFolder());
        libraryPanel.querySelector('[data-action="refresh"]').addEventListener('click', () => this._loadLibraryTree());
        rightCol.appendChild(libraryPanel);

        fileHome.appendChild(rightCol);
        container.appendChild(fileHome);

        // Load library tree
        this._loadLibraryTree();

        this.updateAutoSaveButtonState();
        this.updateAutoSaveVisibility();
    },

    // === LIBRARY MANAGEMENT METHODS ===

    async _loadLibraryTree() {
        const contentEl = document.getElementById('libraryContent');
        if (!contentEl) return;

        // Preserve scroll position so expanding/collapsing folders doesn't look like items disappear.
        const prevScrollTop = contentEl.scrollTop;

        try {
            const resp = await fetch('/api/library/browse');
            if (!resp.ok) throw new Error('Failed to load library');
            const data = await resp.json();
            this._libraryData = data;
            this._libraryRoot = data?.root;
            if (!this._activeLibraryFolderPath) {
                this._activeLibraryFolderPath = this._libraryRoot || '';
            }
            if (!this._selectedLibraryPath) {
                this._selectedLibraryPath = this._activeLibraryFolderPath;
            }
            this._renderLibraryTree(data.items, contentEl, 0);
            try { contentEl.scrollTop = prevScrollTop; } catch {}
        } catch (err) {
            console.error('Failed to load library:', err);
            contentEl.innerHTML = `
                <div class="library-error">
                    <p>Failed to load Library</p>
                    <button class="file-home-action" onclick="window.sikshamitra?._loadLibraryTree()">Retry</button>
                </div>
            `;
        }
    },

    _renderLibraryTree(items, container, depth, options = {}) {
        const { clear = true } = options;
        if (clear) {
            container.innerHTML = '';
        }

        // Always render root folder header at top level
        if (depth === 0 && clear) {
            const rootEl = document.createElement('div');
            rootEl.className = 'library-item folder library-root-item';
            rootEl.dataset.path = '';
            rootEl.dataset.isRoot = 'true';
            if (this._selectedLibraryPath === '' || !this._selectedLibraryPath) {
                rootEl.classList.add('selected');
            }
            rootEl.innerHTML = `
                <div class="library-item-main">
                    <svg class="library-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"></path>
                    </svg>
                    <span class="library-name">Library</span>
                </div>
            `;
            rootEl.addEventListener('click', () => {
                this._selectedLibraryPath = '';
                this._activeLibraryFolderPath = '';
                const cachedItems = this._libraryData?.items;
                if (cachedItems) {
                    this._renderLibraryTree(cachedItems, container, 0);
                }
            });
            // Drop target for root
            this._setupDropTarget(rootEl, '');
            container.appendChild(rootEl);
        }

        if (!items || items.length === 0) {
            if (depth === 0) {
                const emptyEl = document.createElement('div');
                emptyEl.className = 'library-empty';
                emptyEl.innerHTML = `
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                    </svg>
                    <p>Library is empty</p>
                `;
                container.appendChild(emptyEl);
            }
            return;
        }

        // Initialize expanded state if needed
        if (!this._libraryExpanded) {
            this._libraryExpanded = {};
        }

        items.forEach(item => {
            const el = document.createElement('div');
            el.className = `library-item${item.is_folder ? ' folder' : ''}`;
            el.style.paddingLeft = `${12 + (depth + 1) * 16}px`;
            el.dataset.path = item.path;

            if (item.is_folder && this._activeLibraryFolderPath === item.path) {
                el.classList.add('active');
            }
            if (this._selectedLibraryPath === item.path) {
                el.classList.add('selected');
            }

            const isExpanded = this._libraryExpanded[item.path];
            const meta = item.is_folder ? '' : this._formatFileSize(item.size);
            const lowerName = item.name.toLowerCase();
            const isEditable = !item.is_folder && (lowerName.endsWith('.html') || lowerName.endsWith('.htm') || lowerName.endsWith('.smdoc'));

            // Determine icon based on file type
            let iconPath = '<path d="M19 9V17.8C19 18.9201 19 19.4802 18.782 19.908C18.5903 20.2843 18.2843 20.5903 17.908 20.782C17.4802 21 16.9201 21 15.8 21H8.2C7.07989 21 6.51984 21 6.09202 20.782C5.71569 20.5903 5.40973 20.2843 5.21799 19.908C5 19.4802 5 18.9201 5 17.8V6.2C5 5.07989 5 4.51984 5.21799 4.09202C5.40973 3.71569 5.71569 3.40973 6.09202 3.21799C6.51984 3 7.0799 3 8.2 3H13M19 9L13 3M19 9H14C13.4477 9 13 8.55228 13 8V3"></path>'; // Default file
            
            if (item.is_folder) {
                iconPath = '<path d="M3 8.2C3 7.07989 3 6.51984 3.21799 6.09202C3.40973 5.71569 3.71569 5.40973 4.09202 5.21799C4.51984 5 5.0799 5 6.2 5H9.67452C10.1637 5 10.4083 5 10.6385 5.05526C10.8425 5.10425 11.0376 5.18506 11.2166 5.29472C11.4184 5.4184 11.5914 5.59135 11.9373 5.93726L12.0627 6.06274C12.4086 6.40865 12.5816 6.5816 12.7834 6.70528C12.9624 6.81494 13.1575 6.89575 13.3615 6.94474C13.5917 7 13.8363 7 14.3255 7H17.8C18.9201 7 19.4802 7 19.908 7.21799C20.2843 7.40973 20.5903 7.71569 20.782 8.09202C21 8.51984 21 9.0799 21 10.2V15.8C21 16.9201 21 17.4802 20.782 17.908C20.5903 18.2843 20.2843 18.5903 19.908 18.782C19.4802 19 18.9201 19 17.8 19H6.2C5.07989 19 4.51984 19 4.09202 18.782C3.71569 18.5903 3.40973 18.2843 3.21799 17.908C3 17.4802 3 16.9201 3 15.8V8.2Z"></path>';
            } else {
                const ext = item.name.split('.').pop().toLowerCase();
                if (['smdoc'].includes(ext)) {
                    // śikṣāmitra document icon - special document icon
                    iconPath = '<path d="M14 3V8C14 8.55228 14.4477 9 15 9H20M14 3H8.2C7.0799 3 6.51984 3 6.09202 3.21799C5.71569 3.40973 5.40973 3.71569 5.21799 4.09202C5 4.51984 5 5.0799 5 6.2V17.8C5 18.9201 5 19.4802 5.21799 19.908C5.40973 20.2843 5.71569 20.5903 6.09202 20.782C6.51984 21 7.0799 21 8.2 21H15.8C16.9201 21 17.4802 21 17.908 20.782C18.2843 20.5903 18.5903 20.2843 18.782 19.908C19 19.4802 19 18.9201 19 17.8V9L14 3Z"></path><path d="M9 13L15 13M9 17H12"></path>';
                } else if (['html', 'htm', 'xml', 'js', 'py', 'cpp', 'c', 'cxx', 'css', 'json', 'java', 'ts'].includes(ext)) {
                    iconPath = '<path d="M10 17L8 15L10 13M14 13L16 15L14 17M13 3H8.2C7.0799 3 6.51984 3 6.09202 3.21799C5.71569 3.40973 5.40973 3.71569 5.21799 4.09202C5 4.51984 5 5.0799 5 6.2V17.8C5 18.9201 5 19.4802 5.21799 19.908C5.40973 20.2843 5.71569 20.5903 6.09202 20.782C6.51984 21 7.0799 21 8.2 21H15.8C16.9201 21 17.4802 21 17.908 20.782C18.2843 20.5903 18.5903 20.2843 18.782 19.908C19 19.4802 19 18.9201 19 17.8V9M13 3L19 9M13 3V8C13 8.55228 13.4477 9 14 9H19"></path>';
                } else if (['svg', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'ico'].includes(ext)) {
                    iconPath = '<path d="M14.2639 15.9375L12.5958 14.2834C11.7909 13.4851 11.3884 13.086 10.9266 12.9401C10.5204 12.8118 10.0838 12.8165 9.68048 12.9536C9.22188 13.1095 8.82814 13.5172 8.04068 14.3326L4.04409 18.2801M14.2639 15.9375L14.6053 15.599C15.4112 14.7998 15.8141 14.4002 16.2765 14.2543C16.6831 14.126 17.12 14.1311 17.5236 14.2687C17.9824 14.4251 18.3761 14.8339 19.1634 15.6514L20 16.4934M14.2639 15.9375L18.275 19.9565M18.275 19.9565C17.9176 20 17.4543 20 16.8 20H7.2C6.07989 20 5.51984 20 5.09202 19.782C4.71569 19.5903 4.40973 19.2843 4.21799 18.908C4.12796 18.7313 4.07512 18.5321 4.04409 18.2801M18.275 19.9565C18.5293 19.9256 18.7301 19.8727 18.908 19.782C19.2843 19.5903 19.5903 19.2843 19.782 18.908C20 18.4802 20 17.9201 20 16.8V16.4934M4.04409 18.2801C4 17.9221 4 17.4575 4 16.8V7.2C4 6.0799 4 5.51984 4.21799 5.09202C4.40973 4.71569 4.71569 4.40973 5.09202 4.21799C5.51984 4 6.07989 4 7.2 4H16.8C17.9201 4 18.4802 4 18.908 4.21799C19.2843 4.40973 19.5903 4.71569 19.782 5.09202C20 5.51984 20 6.0799 20 7.2V16.4934M17 8.99989C17 10.1045 16.1046 10.9999 15 10.9999C13.8954 10.9999 13 10.1045 13 8.99989C13 7.89532 13.8954 6.99989 15 6.99989C16.1046 6.99989 17 7.89532 17 8.99989Z"></path>';
                } else if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(ext)) {
                    iconPath = '<path d="M7 5V19M17 5V19M3 8H7M17 8H21M3 16H7M17 16H21M3 12H21M6.2 20H17.8C18.9201 20 19.4802 20 19.908 19.782C20.2843 19.5903 20.5903 19.2843 20.782 18.908C21 18.4802 21 17.9201 21 16.8V7.2C21 6.0799 21 5.51984 20.782 5.09202C20.5903 4.71569 20.2843 4.40973 19.908 4.21799C19.4802 4 18.9201 4 17.8 4H6.2C5.0799 4 4.51984 4 4.09202 4.21799C3.71569 4.40973 3.40973 4.71569 3.21799 5.09202C3 5.51984 3 6.07989 3 7.2V16.8C3 17.9201 3 18.4802 3.21799 18.908C3.40973 19.2843 3.71569 19.5903 4.09202 19.782C4.51984 20 5.07989 20 6.2 20Z"></path>';
                } else if (['txt', 'doc', 'docx', 'md', 'rtf'].includes(ext)) {
                    iconPath = '<path d="M9 17H15M9 13H15M9 9H10M13 3H8.2C7.0799 3 6.51984 3 6.09202 3.21799C5.71569 3.40973 5.40973 3.71569 5.21799 4.09202C5 4.51984 5 5.0799 5 6.2V17.8C5 18.9201 5 19.4802 5.21799 19.908C5.40973 20.2843 5.71569 20.5903 6.09202 20.782C6.51984 21 7.0799 21 8.2 21H15.8C16.9201 21 17.4802 21 17.908 20.782C18.2843 20.5903 18.5903 20.2843 18.782 19.908C19 19.4802 19 18.9201 19 17.8V9M13 3L19 9M13 3V7.4C13 7.96005 13 8.24008 13.109 8.45399C13.2049 8.64215 13.3578 8.79513 13.546 8.89101C13.7599 9 14.0399 9 14.6 9H19"></path>';
                } else if (['mp3', 'wav', 'aac', 'flac', 'm4a'].includes(ext)) {
                    iconPath = '<path d="M19 9V17.8C19 18.9201 19 19.4802 18.782 19.908C18.5903 20.2843 18.2843 20.5903 17.908 20.782C17.4802 21 16.9201 21 15.8 21H8.2C7.07989 21 6.51984 21 6.09202 20.782C5.71569 20.5903 5.40973 20.2843 5.21799 19.908C5 19.4802 5 18.9201 5 17.8V6.2C5 5.07989 5 4.51984 5.21799 4.09202C5.40973 3.71569 5.71569 3.40973 6.09202 3.21799C6.51984 3 7.0799 3 8.2 3H13M19 9L13 3M19 9H16.2C15.0799 9 14.5198 9 14.092 8.78201C13.7157 8.59027 13.4097 8.28431 13.218 7.90798C13 7.48016 13 6.9201 13 5.8V3M14.5 13C15.1137 13.4913 15.5 14.2053 15.5 15C15.5 15.7947 15.1137 16.5087 14.5 17M8.5 14H9.83333L11.5 12V18L9.83333 16H8.5V14Z"></path>';
                }
            }

            el.innerHTML = `
                <div class="library-item-main">
                    ${item.is_folder ? `
                        <svg class="library-chevron${isExpanded ? ' expanded' : ''}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    ` : ''}
                    <svg class="library-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        ${iconPath}
                    </svg>
                    <span class="library-name">${item.name}</span>
                    ${meta ? `<span class="library-meta">${meta}</span>` : ''}
                </div>
                <div class="library-actions">
                    ${!item.is_folder ? `
                        <button class="library-action-btn view" data-action="view" title="Read">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 10.4V20M12 10.4C12 8.15979 12 7.03969 11.564 6.18404C11.1805 5.43139 10.5686 4.81947 9.81596 4.43597C8.96031 4 7.84021 4 5.6 4H4.6C4.03995 4 3.75992 4 3.54601 4.10899C3.35785 4.20487 3.20487 4.35785 3.10899 4.54601C3 4.75992 3 5.03995 3 5.6V16.4C3 16.9601 3 17.2401 3.10899 17.454C3.20487 17.6422 3.35785 17.7951 3.54601 17.891C3.75992 18 4.03995 18 4.6 18H7.54668C8.08687 18 8.35696 18 8.61814 18.0466C8.84995 18.0879 9.0761 18.1563 9.29191 18.2506C9.53504 18.3567 9.75977 18.5065 10.2092 18.8062L12 20M12 10.4C12 8.15979 12 7.03969 12.436 6.18404C12.8195 5.43139 13.4314 4.81947 14.184 4.43597C15.0397 4 16.1598 4 18.4 4H19.4C19.9601 4 20.2401 4 20.454 4.10899C20.6422 4.20487 20.7951 4.35785 20.891 4.54601C21 4.75992 21 5.03995 21 5.6V16.4C21 16.9601 21 17.2401 20.891 17.454C20.7951 17.6422 20.6422 17.7951 20.454 17.891C20.2401 18 19.9601 18 19.4 18H16.4533C15.9131 18 15.643 18 15.3819 18.0466C15.15 18.0879 14.9239 18.1563 14.7081 18.2506C14.465 18.3567 14.2402 18.5065 13.7908 18.8062L12 20"/>
                            </svg>
                        </button>
                        ${isEditable ? `
                        <button class="library-action-btn" data-action="edit" title="Edit">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M9.65661 17L6.99975 17L6.99975 14M6.10235 14.8974L17.4107 3.58902C18.1918 2.80797 19.4581 2.80797 20.2392 3.58902C21.0202 4.37007 21.0202 5.6364 20.2392 6.41745L8.764 17.8926C8.22794 18.4287 7.95992 18.6967 7.6632 18.9271C7.39965 19.1318 7.11947 19.3142 6.8256 19.4723C6.49475 19.6503 6.14115 19.7868 5.43395 20.0599L3 20.9998L3.78312 18.6501C4.05039 17.8483 4.18403 17.4473 4.3699 17.0729C4.53497 16.7404 4.73054 16.424 4.95409 16.1276C5.20582 15.7939 5.50466 15.4951 6.10235 14.8974Z"></path>
                            </svg>
                        </button>
                        <button class="library-action-btn" data-action="clone" title="Duplicate">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M15 3V6.4C15 6.96005 15 7.24008 15.109 7.45399C15.2049 7.64215 15.3578 7.79513 15.546 7.89101C15.7599 8 16.0399 8 16.6 8H20M10 8H6C4.89543 8 4 8.89543 4 10V19C4 20.1046 4.89543 21 6 21H12C13.1046 21 14 20.1046 14 19V16M16 3H13.2C12.0799 3 11.5198 3 11.092 3.21799C10.7157 3.40973 10.4097 3.71569 10.218 4.09202C10 4.51984 10 5.0799 10 6.2V12.8C10 13.9201 10 14.4802 10.218 14.908C10.4097 15.2843 10.7157 15.5903 11.092 15.782C11.5198 16 12.0799 16 13.2 16H16.8C17.9201 16 18.4802 16 18.908 15.782C19.2843 15.5903 19.5903 15.2843 19.782 14.908C20 14.4802 20 13.9201 20 12.8V7L16 3Z"></path>
                            </svg>
                        </button>
                        ` : ''}
                    ` : ''}
                    <button class="library-action-btn" data-action="reveal" title="Show in folder">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9 13H15M15 13L13 11M15 13L13 15M12.0627 6.06274L11.9373 5.93726C11.5914 5.59135 11.4184 5.4184 11.2166 5.29472C11.0376 5.18506 10.8425 5.10425 10.6385 5.05526C10.4083 5 10.1637 5 9.67452 5H6.2C5.0799 5 4.51984 5 4.09202 5.21799C3.71569 5.40973 3.40973 5.71569 3.21799 6.09202C3 6.51984 3 7.07989 3 8.2V15.8C3 16.9201 3 17.4802 3.21799 17.908C3.40973 18.2843 3.71569 18.5903 4.09202 18.782C4.51984 19 5.07989 19 6.2 19H17.8C18.9201 19 19.4802 19 19.908 18.782C20.2843 18.5903 20.5903 18.2843 20.782 17.908C21 17.4802 21 16.9201 21 15.8V10.2C21 9.0799 21 8.51984 20.782 8.09202C20.5903 7.71569 20.2843 7.40973 19.908 7.21799C19.4802 7 18.9201 7 17.8 7H14.3255C13.8363 7 13.5917 7 13.3615 6.94474C13.1575 6.89575 12.9624 6.81494 12.7834 6.70528C12.5816 6.5816 12.4086 6.40865 12.0627 6.06274Z"></path>
                        </svg>
                    </button>
                    <button class="library-action-btn" data-action="rename" title="Rename">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 16V8M8 8H16M7.2 4H16.8C17.9201 4 18.4802 4 18.908 4.21799C19.2843 4.40973 19.5903 4.71569 19.782 5.09202C20 5.51984 20 6.0799 20 7.2V16.8C20 17.9201 20 18.4802 19.782 18.908C19.5903 19.2843 19.2843 19.5903 18.908 19.782C18.4802 20 17.9201 20 16.8 20H7.2C6.0799 20 5.51984 20 5.09202 19.782C4.71569 19.5903 4.40973 19.2843 4.21799 18.908C4 18.4802 4 17.9201 4 16.8V7.2C4 6.0799 4 5.51984 4.21799 5.09202C4.40973 4.71569 4.71569 4.40973 5.09202 4.21799C5.51984 4 6.0799 4 7.2 4Z"/>
                        </svg>
                    </button>
                    <button class="library-action-btn danger" data-action="delete" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 6L17.1991 18.0129C17.129 19.065 17.0939 19.5911 16.8667 19.99C16.6666 20.3412 16.3648 20.6235 16.0011 20.7998C15.588 21 15.0607 21 14.0062 21H9.99377C8.93927 21 8.41202 21 7.99889 20.7998C7.63517 20.6235 7.33339 20.3412 7.13332 19.99C6.90607 19.5911 6.871 19.065 6.80086 18.0129L6 6M4 6H20M16 6L15.7294 5.18807C15.4671 4.40125 15.3359 4.00784 15.0927 3.71698C14.8779 3.46013 14.6021 3.26132 14.2905 3.13878C13.9376 3 13.523 3 12.6936 3H11.3064C10.477 3 10.0624 3 9.70951 3.13878C9.39792 3.26132 9.12208 3.46013 8.90729 3.71698C8.66405 4.00784 8.53292 4.40125 8.27064 5.18807L8 6M14 10V17M10 10V17"></path>
                        </svg>
                    </button>
                </div>
            `;

            // Click on folder to expand/collapse
            const mainRow = el.querySelector('.library-item-main');
            mainRow?.addEventListener('click', async (e) => {
                if (e.target && e.target.closest && e.target.closest('.library-actions')) return;
                if (item.is_folder) {
                    this._selectedLibraryPath = item.path;
                    this._activeLibraryFolderPath = item.path;
                    const contentEl = document.getElementById('libraryContent');
                    const cachedItems = this._libraryData?.items;
                    const prevScrollTop = contentEl ? contentEl.scrollTop : 0;
                    if (contentEl && cachedItems) {
                        this._renderLibraryTree(cachedItems, contentEl, 0);
                        try { contentEl.scrollTop = prevScrollTop; } catch {}
                    }
                } else {
                    this._selectedLibraryPath = item.path;
                    const parentPath = this._dirnameFromPath(item.path);
                    this._activeLibraryFolderPath = parentPath;
                    this._openViewerWindow(item.full_path);
                }
            });

            const chevron = el.querySelector('.library-chevron');
            chevron?.addEventListener('click', (e) => {
                e.stopPropagation();
                this._libraryExpanded[item.path] = !this._libraryExpanded[item.path];
                const contentEl = document.getElementById('libraryContent');
                const cachedItems = this._libraryData?.items;
                const prevScrollTop = contentEl ? contentEl.scrollTop : 0;
                if (contentEl && cachedItems) {
                    this._renderLibraryTree(cachedItems, contentEl, 0);
                    try { contentEl.scrollTop = prevScrollTop; } catch {}
                } else {
                    this._loadLibraryTree();
                }
            });

            // Double-click file to open
            el.addEventListener('dblclick', async () => {
                if (item.is_folder) {
                    this._libraryExpanded[item.path] = !this._libraryExpanded[item.path];
                    const contentEl = document.getElementById('libraryContent');
                    const cachedItems = this._libraryData?.items;
                    const prevScrollTop = contentEl ? contentEl.scrollTop : 0;
                    if (contentEl && cachedItems) {
                        this._renderLibraryTree(cachedItems, contentEl, 0);
                        try { contentEl.scrollTop = prevScrollTop; } catch {}
                    } else {
                        this._loadLibraryTree();
                    }
                    return;
                }

                if (isEditable) {
                    if (!(await this.checkUnsavedChanges())) return;
                    await this._openLibraryFile(item.path);
                } else {
                    this._openViewerWindow(item.full_path);
                }
            });

            el.querySelector('[data-action="view"]')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this._openViewerWindow(item.full_path);
            });

            el.querySelector('[data-action="edit"]')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!(await this.checkUnsavedChanges())) return;
                await this._openLibraryFile(item.path);
            });

            el.querySelector('[data-action="clone"]')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (item.is_folder) return;
                if (!(await this.checkUnsavedChanges())) return;
                await this._cloneLibraryFile(item.path);
            });

            el.querySelector('[data-action="reveal"]')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                const target = item.full_path || item.path;
                await this._shareFile(target);
            });

            el.querySelector('[data-action="rename"]')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this._renameLibraryItem(item);
            });

            el.querySelector('[data-action="delete"]')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                const type = item.is_folder ? 'folder' : 'file';
                const ok = await ModalDialogs.confirm(`Delete this ${type}?\n\n${item.name}`, 'Delete');
                if (!ok) return;
                await this._deleteLibraryItem(item.path);
            });

            // Setup drag and drop
            this._setupDraggable(el, item);
            if (item.is_folder) {
                this._setupDropTarget(el, item.path);
            }

            container.appendChild(el);

            // Render children if folder is expanded
            if (item.is_folder && isExpanded && item.children && item.children.length > 0) {
                const childContainer = document.createElement('div');
                childContainer.className = 'library-children';
                container.appendChild(childContainer);
                this._renderLibraryTree(item.children, childContainer, depth + 1, { clear: true });
            }
        });
    },

    _setupDraggable(el, item) {
        el.draggable = true;
        el.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', item.path);
            el.classList.add('dragging');
            this._draggingItem = item;
        });
        el.addEventListener('dragend', () => {
            el.classList.remove('dragging');
            this._draggingItem = null;
            document.querySelectorAll('.library-item.drag-over').forEach(x => x.classList.remove('drag-over'));
        });
    },

    _setupDropTarget(el, targetPath) {
        el.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!this._draggingItem) return;
            // Can't drop onto itself or its own children
            if (this._draggingItem.path === targetPath) return;
            if (targetPath.startsWith(this._draggingItem.path + '/')) return;
            e.dataTransfer.dropEffect = 'move';
            el.classList.add('drag-over');
        });
        el.addEventListener('dragleave', (e) => {
            e.stopPropagation();
            el.classList.remove('drag-over');
        });
        el.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            el.classList.remove('drag-over');
            const sourcePath = e.dataTransfer.getData('text/plain');
            if (!sourcePath) return;
            if (sourcePath === targetPath) return;
            if (targetPath.startsWith(sourcePath + '/')) return;
            await this._moveLibraryItem(sourcePath, targetPath);
        });
    },

    async _moveLibraryItem(sourcePath, targetFolderPath) {
        try {
            const resp = await fetch('/api/library/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: sourcePath, target: targetFolderPath })
            });
            const data = await resp.json();
            if (!resp.ok || data.error) throw new Error(data.error || 'Failed to move');
            // Update selection to new path
            const name = this._basenameFromPath(sourcePath);
            const newPath = targetFolderPath ? `${targetFolderPath}/${name}` : name;
            this._selectedLibraryPath = newPath;
            await this._loadLibraryTree();
        } catch (err) {
            await ModalDialogs.alert(`Failed to move: ${err.message}`, 'Error', ModalDialogs.icons.error);
        }
    },

    _formatFileSize(bytes) {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1048576).toFixed(1)} MB`;
    },

    async _openLibraryFile(relPath) {
        this.showBlockingLoader?.({ title: 'Opening', message: 'Loading document...' });
        try {
            const resp = await fetch('/api/library/read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: relPath })
            });
            if (!resp.ok) throw new Error('Failed to read file');
            const data = await resp.json();
            if (data.error) throw new Error(data.error);

            // Handle .smdoc format
            const isSmdoc = SMDocFormat.isSMDoc(relPath);
            if (isSmdoc) {
                const smdoc = SMDocFormat.parse(data.content);
                this.setHTML(smdoc.content);
                
                // Load audio attachments if present
                if (smdoc.audio && smdoc.audio.attachments && typeof this.loadAudioAttachments === 'function') {
                    this.loadAudioAttachments(smdoc.audio.attachments);
                }
            } else {
                this._setEditorFromHtml(data.content);
            }
            
            this.currentFilePath = data.full_path;
            this.currentFileName = this._basenameFromPath(data.full_path);
            this.isDirty = false;
            this.updateTitle();
            await this.loadAutoSavePreference();
            await this.saveSessionState();

            const editTab = document.querySelector('[data-tab="edit"]');
            if (editTab) editTab.click();
            await this._nextFrame?.();
            await this._postContentLoadRefresh();
        } catch (err) {
            console.error('Failed to open library file:', err);
            await ModalDialogs.alert(`Failed to open file: ${err.message}`, 'Error', '❌');
        } finally {
            this.hideBlockingLoader?.();
        }
    },

    async _cloneLibraryFile(relPath) {
        this.showBlockingLoader?.({ title: 'Cloning', message: 'Creating copy...' });
        try {
            const resp = await fetch('/api/library/read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: relPath })
            });
            if (!resp.ok) throw new Error('Failed to read file');
            const data = await resp.json();
            if (data.error) throw new Error(data.error);

            // Handle .smdoc format
            const isSmdoc = SMDocFormat.isSMDoc(relPath);
            if (isSmdoc) {
                const smdoc = SMDocFormat.parse(data.content);
                this.setHTML(smdoc.content);
                
                if (smdoc.audio && smdoc.audio.attachments && typeof this.loadAudioAttachments === 'function') {
                    this.loadAudioAttachments(smdoc.audio.attachments);
                }
            } else {
                this._setEditorFromHtml(data.content);
            }
            this.currentFilePath = null;

            const base = this._basenameFromPath(data.full_path || relPath) || 'Untitled.smdoc';
            const baseNoExt = base.replace(/\.(smdoc|html?)$/i, '');
            // Use same format for the copy
            const ext = isSmdoc ? '.smdoc' : '.html';
            this.currentFileName = `${baseNoExt} copy${ext}`;
            this.isDirty = true;
            this.updateTitle();
            await this.loadAutoSavePreference();
            await this.saveSessionState();

            const editTab = document.querySelector('[data-tab="edit"]');
            if (editTab) editTab.click();
            await this._nextFrame?.();
            await this._postContentLoadRefresh();
        } catch (err) {
            console.error('Failed to clone library file:', err);
            await ModalDialogs.alert(`Failed to clone file: ${err.message}`, 'Error', '❌');
        } finally {
            this.hideBlockingLoader?.();
        }
    },

    async _createLibraryFolder() {
        const name = await ModalDialogs.prompt('Enter folder name:', {
            title: 'New Folder',
            icon: ModalDialogs.icons.folder,
            defaultValue: 'New Folder'
        });
        if (!name) return;

        const targetPath = this._activeLibraryFolderPath || '';

        try {
            const resp = await fetch('/api/library/folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: targetPath, name })
            });
            const data = await resp.json();
            if (!resp.ok || data.error) throw new Error(data.error || 'Failed to create folder');
            await this._loadLibraryTree();
        } catch (err) {
            await ModalDialogs.alert(`Failed to create folder: ${err.message}`, 'Error', '❌');
        }
    },

    async _renameLibraryItem(item) {
        const currentName = item.name;
        const type = item.is_folder ? 'folder' : 'file';
        const extMatch = currentName.match(/(\.[^.]+)$/);
        const baseName = extMatch ? currentName.slice(0, -extMatch[1].length) : currentName;
        const newName = await ModalDialogs.prompt(`Rename ${type}:`, {
            title: 'Rename',
            icon: ModalDialogs.icons.rename,
            defaultValue: currentName,
            selectRange: [0, baseName.length]
        });
        if (!newName || newName === currentName) return;

        try {
            const resp = await fetch('/api/library/rename', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: item.path, name: newName })
            });
            const data = await resp.json();
            if (!resp.ok || data.error) throw new Error(data.error || 'Failed to rename');
            const parentPath = this._dirnameFromPath(item.path);
            const newPath = parentPath ? `${parentPath}/${newName}` : newName;
            this._selectedLibraryPath = newPath;
            if (item.is_folder) {
                this._activeLibraryFolderPath = newPath;
                if (this._libraryExpanded?.[item.path]) {
                    this._libraryExpanded[newPath] = true;
                    delete this._libraryExpanded[item.path];
                }
            }
            await this._loadLibraryTree();
        } catch (err) {
            await ModalDialogs.alert(`Failed to rename: ${err.message}`, 'Error', ModalDialogs.icons.error);
        }
    },

    async _deleteLibraryItem(relPath) {
        try {
            const resp = await fetch('/api/library/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: relPath })
            });
            const data = await resp.json();
            if (!resp.ok || data.error) throw new Error(data.error || 'Failed to delete');
            await this._loadLibraryTree();
        } catch (err) {
            await ModalDialogs.alert(`Failed to delete: ${err.message}`, 'Error', '❌');
        }
    },

    async _shareLibraryFile(relPath) {
        try {
            const resp = await fetch('/api/library/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: relPath })
            });
            const data = await resp.json();
            if (data.message) {
                await ModalDialogs.alert(data.message, 'Share', '📤');
            }
        } catch (err) {
            console.error('Share failed:', err);
        }
    },

    async _shareFile(fullPath) {
        try {
            // Open file location on Windows
            if (window.pywebview && window.pywebview.api && window.pywebview.api.open_in_explorer) {
                await window.pywebview.api.open_in_explorer(fullPath);
            } else {
                // Fallback for browser
                await ModalDialogs.alert(`File location:\n\n${fullPath}`, 'File Path');
            }
        } catch (err) {
            console.error('Share failed:', err);
            await ModalDialogs.alert(`Failed to open location: ${err.message}`, 'Error');
        }
    },

    async _saveToLibraryDialog() {
        const currentName = this.currentFileName || 'Untitled.smdoc';
        const name = await ModalDialogs.prompt('Save to Library as:', {
            title: 'Save to Library',
            icon: ModalDialogs.icons.library,
            defaultValue: currentName
        });
        if (!name) return;

        try {
            // Determine format based on extension
            const isSmdoc = SMDocFormat.isSMDoc(name);
            let content;
            
            if (isSmdoc) {
                const editorContent = this.quill.root.innerHTML;
                const currentTheme = document.body.getAttribute('data-theme') || 'light';
                const title = name.replace(/\.(smdoc|html?)$/i, '');
                
                const smdoc = SMDocFormat.create({
                    content: editorContent,
                    title: title,
                    theme: currentTheme
                });
                content = JSON.stringify(smdoc, null, 2);
            } else {
                content = this.getHTML();
            }
            
            const resp = await fetch('/api/library/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: '', filename: name, content })
            });
            const data = await resp.json();
            if (!resp.ok || data.error) throw new Error(data.error || 'Failed to save');

            this.currentFilePath = data.full_path;
            this.currentFileName = this._basenameFromPath(data.full_path);
            this.isDirty = false;
            this.updateTitle();
            await this._loadLibraryTree();
            await ModalDialogs.alert(`Saved to Library: ${this.currentFileName}`, 'Saved', '✅');
        } catch (err) {
            await ModalDialogs.alert(`Failed to save: ${err.message}`, 'Error', '❌');
        }
    },

    /**
     * Open document in a custom viewer window (pywebview)
     */
    _openViewerWindow(filePath) {
        if (window.pywebview && window.pywebview.api && window.pywebview.api.open_viewer_from_file) {
            window.pywebview.api.open_viewer_from_file(filePath).then(result => {
                if (result && result.error) {
                    console.error('Viewer window error:', result.error);
                    // Fallback to browser
                    this._openViewWindowForPath(filePath);
                }
            }).catch(err => {
                console.error('Failed to open viewer:', err);
                this._openViewWindowForPath(filePath);
            });
        } else {
            // Fallback: open in new browser tab with loading screen
            this._openViewWindowForPath(filePath);
        }
    },

    /**
     * Hide editor area (when File tab is active)
     */
    hideEditorArea() {
        const workspace = document.getElementById('documentWorkspace');
        const fileBrowser = document.getElementById('fileBrowserContainer');
        const statusbar = document.querySelector('.statusbar');
        if (workspace) workspace.style.display = 'none';
        if (fileBrowser) fileBrowser.style.display = 'flex';
        if (statusbar) statusbar.style.display = 'none';
    },

    /**
     * Show editor area
     */
    showEditorArea() {
        const workspace = document.getElementById('documentWorkspace');
        const fileBrowser = document.getElementById('fileBrowserContainer');
        const statusbar = document.querySelector('.statusbar');
        if (workspace) workspace.style.display = 'flex';
        if (fileBrowser) fileBrowser.style.display = 'none';
        if (statusbar) statusbar.style.display = '';
    },

    /**
     * Setup auto-save
     */
    setupAutoSave() {
        // Load autosave preference
        this.loadAutoSavePreference();
        
        // Listen for pywebview ready to load from backend
        window.addEventListener('pywebviewready', () => {
            this.loadAutoSavePreference();
            this.updateTitle();
        });
        
        // Setup autosave toggle button (ribbon button - may be hidden, still used for keyboard/bridge)
        const autoSaveToggle = document.getElementById('autoSaveToggle');
        if (autoSaveToggle) {
            autoSaveToggle.addEventListener('click', async () => {
                await this.toggleAutoSaveForCurrentDoc();
            });
        }
        
        // Auto-save (path-backed only) and session metadata every 30 seconds
        this.autoSaveInterval = setInterval(async () => {
            // Always persist scratch content to cache (no UI toggle).
            if (this.isDirty && !this.currentFilePath) {
                await this.saveUntitled();
            }

            // Per-document autosave for path-backed docs.
            if (this.autoSaveEnabled && this.isDirty && this.currentFilePath) {
                await this.saveDocument({ source: 'autosave' });
            }
            await this.saveSessionState();
        }, 30000);

        this.updateAutoSaveVisibility();
    },

    async toggleAutoSaveForCurrentDoc() {
        // Only meaningful for path-backed docs
        if (!this.currentFilePath) return;

        this.autoSaveEnabled = !this.autoSaveEnabled;
        localStorage.setItem(this._autoSaveKeyForPath(this.currentFilePath), String(this.autoSaveEnabled));

        if (window.pywebview && window.pywebview.api) {
            try {
                const key = this._autoSaveKeyForPath(this.currentFilePath);
                await window.pywebview.api.set_preference(key, this.autoSaveEnabled);
            } catch (e) {
                console.warn('Failed to save autosave preference:', e);
            }
        }

        this.updateAutoSaveButtonState();
        this.updateAutoSaveVisibility();
        this.updateTitle();

        // If turning on autosave with existing unsaved changes, schedule a save soon.
        if (this.autoSaveEnabled && this.isDirty) {
            this.scheduleAutoSave();
        }
    },

    scheduleAutoSave() {
        if (!this.currentFilePath || !this.autoSaveEnabled) return;
        if (!this.isDirty) return;

        // Show saving state in title immediately.
        this._autoSavePending = true;
        this.updateTitle();

        if (this._autoSaveDebounceTimer) {
            clearTimeout(this._autoSaveDebounceTimer);
        }

        this._autoSaveDebounceTimer = setTimeout(async () => {
            if (!this.currentFilePath || !this.autoSaveEnabled) {
                this._autoSavePending = false;
                this.updateTitle();
                return;
            }
            if (!this.isDirty) {
                this._autoSavePending = false;
                this.updateTitle();
                return;
            }
            if (this._saving) {
                // Try again shortly.
                this.scheduleAutoSave();
                return;
            }

            const ok = await this.saveDocument({ source: 'autosave' });
            this._autoSavePending = false;
            // If save failed, keep dirty marker via normal logic.
            if (ok) this.isDirty = false;
            this.updateTitle();
        }, 1200);
    },

    async loadAutoSavePreference() {
        let enabled = null;

        // Per-document: only when a real path exists
        if (!this.currentFilePath) {
            this.autoSaveEnabled = false;
            this.updateAutoSaveButtonState();
            this.updateAutoSaveVisibility();
            return;
        }

        const key = this._autoSaveKeyForPath(this.currentFilePath);

        if (window.pywebview && window.pywebview.api) {
            try {
                const v = await window.pywebview.api.get_preference(key);
                if (typeof v === 'boolean') enabled = v;
            } catch {
                // ignore
            }
        }

        if (enabled === null) {
            const local = localStorage.getItem(key);
            if (local !== null) {
                enabled = local === 'true';
            } else {
                enabled = false;
            }
        }

        this.autoSaveEnabled = enabled;
        localStorage.setItem(key, String(enabled));
        this.updateAutoSaveButtonState();
        this.updateAutoSaveVisibility();
    },

    updateAutoSaveVisibility() {
        const autoSaveToggle = document.getElementById('autoSaveToggle');
        if (autoSaveToggle) {
            autoSaveToggle.style.display = this.currentFilePath ? '' : 'none';
        }

        const homeToggle = document.getElementById('fileHomeAutoSaveToggle');
        if (homeToggle) {
            const enabled = !!this.currentFilePath;
            homeToggle.disabled = !enabled;
            homeToggle.classList.toggle('disabled', !enabled);
            homeToggle.title = enabled
                ? 'Toggle auto-save for this document'
                : 'Save the document first to enable auto-save';
        }
    },

    _autoSaveKeyForPath(path) {
        return `autoSaveEnabled:${this._normalizeForCompare(path)}`;
    },

    _normalizeForCompare(path) {
        if (!path) return '';
        return String(path).replace(/\\/g, '/').toLowerCase();
    },

    updateAutoSaveButtonState() {
        const toggles = [
            document.getElementById('autoSaveToggle'),
            document.getElementById('fileHomeAutoSaveToggle'),
        ].filter(Boolean);

        toggles.forEach((toggle) => {
            if (this.autoSaveEnabled) {
                toggle.classList.add('active');
            } else {
                toggle.classList.remove('active');
            }
        });
    },

    async saveUntitled() {
        try {
            const content = await this.getDocumentHTML();
            await fetch('/api/cache/untitled', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });
        } catch (error) {
            console.warn('Failed to autosave untitled:', error);
        }
    },

    async loadUntitled() {
        // Spec: do not auto-load scratch on startup.
        // Still ensure we have a consistent initial doc identity for title/status.
        if (!this.currentFilePath && !this.currentFileName) {
            this.currentFileName = 'Untitled.smdoc';
            this.isDirty = false;
            this.updateTitle();
        }
    },

    async clearUntitled() {
        try {
            await fetch('/api/cache/untitled', { method: 'DELETE' });
        } catch {
            // ignore
        }
    },

    async saveSessionState() {
        // Debounce rapid calls
        if (this._savingSession) return;
        this._savingSession = true;
        try {
            const state = {
                lastFilePath: this.currentFilePath || null,
                lastFileName: this.currentFileName || null,
                savedAt: Math.floor(Date.now() / 1000)
            };
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            await fetch('/api/cache/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
        } catch (error) {
            // Silently ignore network/abort errors during shutdown
            if (error.name !== 'AbortError') {
                console.warn('Failed to save session state:', error);
            }
        } finally {
            this._savingSession = false;
        }
    },

    async _continueScratch() {
        try {
            const resp = await fetch('/api/cache/untitled');
            if (!resp.ok) return;
            const data = await resp.json();
            if (!data?.content) return;

            this._setEditorFromHtml(data.content);
            this.currentFilePath = null;
            this.currentFileName = 'Untitled.smdoc';
            this._scratchOpenedFromCache = true;
            this.isDirty = true;
            this.updateTitle();
            await this.saveSessionState();

            const editTab = document.querySelector('[data-tab="edit"]');
            if (editTab) editTab.click();
            await this._nextFrame?.();
            await this._nextFrame?.();
            await this._postContentLoadRefresh();
        } catch (e) {
            console.warn('Failed to continue scratch:', e);
        }
    },

    /**
     * Open document (generic)
     */
    async openDocument() {
        console.log('openDocument called. pywebview available:', !!(window.pywebview && window.pywebview.api));
        // Check if running in pywebview with native API
        if (window.pywebview && window.pywebview.api) {
            try {
                if (await this.checkUnsavedChanges()) {
                    const filepath = await window.pywebview.api.open_file_dialog();
                    if (filepath) {
                        // Check extension
                        const lowerPath = filepath.toLowerCase();
                        const isSmdoc = SMDocFormat.isSMDoc(filepath);
                        const isHtml = lowerPath.endsWith('.html') || lowerPath.endsWith('.htm');
                        const isDocx = lowerPath.endsWith('.docx');

                        if (!isSmdoc && !isHtml && !isDocx) {
                            // Open in viewer instead
                            this._openViewerWindow(filepath);
                            return;
                        }

                        this.showBlockingLoader?.({
                            title: isDocx ? 'Importing Word Document' : 'Opening File',
                            message: isDocx
                                ? 'Converting Word document to editor format…'
                                : 'Please wait while the file is being loaded…'
                        });
                        await this._nextFrame?.();

                        try {
                            // Handle .docx import via server-side conversion
                            if (isDocx) {
                                const resp = await fetch('/api/file/import-docx', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ path: filepath })
                                });
                                const result = await resp.json();
                                if (result.error) throw new Error(result.error);

                                this.setHTML(result.content);
                                this.currentFilePath = null; // Imported — not a native file yet
                                this.currentFileName = (result.title || 'Imported') + '.smdoc';
                                this._scratchOpenedFromCache = false;
                                this.isDirty = true; // Mark dirty so user is prompted to save
                                if (typeof this.updateTitle === 'function') this.updateTitle();

                                // Switch to Edit tab
                                const editTab = document.querySelector('[data-tab="edit"]');
                                if (editTab) editTab.click();
                                await this._nextFrame?.();
                                await this._postContentLoadRefresh?.();

                                setTimeout(() => this.hideBlockingLoader?.(), 150);
                                console.log(`Imported .docx: ${filepath}`);
                                return;
                            }

                            const content = await window.pywebview.api.read_file(filepath);
                            if (content.startsWith('Error:')) {
                                throw new Error(content);
                            }
                            
                            // Handle .smdoc format
                            if (isSmdoc) {
                                const smdoc = SMDocFormat.parse(content);
                                this.setHTML(smdoc.content);
                                
                                // Apply theme if different from current
                                if (smdoc.styles && smdoc.styles.theme) {
                                    const currentTheme = document.body.getAttribute('data-theme') || 'light';
                                    if (smdoc.styles.theme !== currentTheme) {
                                        // Optionally apply the document's theme
                                        // For now we just load content without changing app theme
                                    }
                                }
                                
                                // Load audio attachments if present
                                if (smdoc.audio && smdoc.audio.attachments && typeof this.loadAudioAttachments === 'function') {
                                    this.loadAudioAttachments(smdoc.audio.attachments);
                                }
                            } else {
                                // Handle HTML format
                                const parser = new DOMParser();
                                const doc = parser.parseFromString(content, 'text/html');
                                const editorDiv = doc.querySelector('.ql-editor');
                                if (editorDiv) {
                                    let innerHTML = editorDiv.innerHTML.trim();
                                    innerHTML = innerHTML.replace(/^(<p><br><\/p>\s*)+/, '');
                                    this.setHTML(innerHTML);
                                } else {
                                    const bodyContent = doc.querySelector('body');
                                    if (bodyContent) {
                                        this.setHTML(bodyContent.innerHTML.trim());
                                    }
                                }
                            }

                            this.updateButtonStates(this.quill.getSelection(true));
                            
                            // Set filename from path
                            const filename = filepath.split(/[\\\\/]/).pop();
                            this.currentFileName = filename;
                            this.currentFilePath = filepath;
                            this._scratchOpenedFromCache = false;
                            this.isDirty = false;
                            this.updateTitle();
                            await this.loadAutoSavePreference();
                            await this.saveSessionState();
                            
                            // Switch to Edit tab
                            const editTab = document.querySelector('[data-tab="edit"]');
                            if (editTab) editTab.click();
                            await this._nextFrame?.();
                            await this._nextFrame?.();
                            await this._postContentLoadRefresh();
                        } finally {
                            // Hide loading popup
                            setTimeout(() => this.hideBlockingLoader?.(), 150);
                        }
                    }
                }
            } catch (error) {
                console.error('Error opening document:', error);
                // Hide loading popup on error
                this.hideBlockingLoader?.();
                await ModalDialogs.alert(`Error opening document: ${error.message}`, 'Error', '❌');
            }
        } else {
            // Fallback to internal file browser
            this.showFileBrowser();
        }
    },

    /**
     * New document: scratch/untitled, no naming prompt. Switch to Edit tab.
     */
    async createNewDocument() {
        if (!(await this.checkUnsavedChanges())) return;

        this.quill.setText('');
        this.currentFilePath = null;
        this.currentFileName = 'Untitled.smdoc';
        this._scratchOpenedFromCache = false;
        this.isDirty = false;
        this.updateTitle();
        await this.loadAutoSavePreference();
        await this.saveSessionState();

        const editTab = document.querySelector('[data-tab="edit"]');
        if (editTab) editTab.click();
    },

    /**
     * Save document
     */
    async saveDocument(options = {}) {
        // Check if running in pywebview with native API
        if (window.pywebview && window.pywebview.api) {
            try {
                if (options?.source === 'autosave' && !this.currentFilePath) return;
                let filepath = this.currentFilePath;
                
                if (!filepath) {
                    // Prompt for save location - default to .smdoc for new files
                    const defaultName = this.currentFileName || 'Untitled.smdoc';
                    filepath = await window.pywebview.api.save_file_dialog(defaultName);
                    if (!filepath) return false;
                }
                
                // Determine format based on file extension
                const isSmdoc = SMDocFormat.isSMDoc(filepath);
                let content;
                
                if (isSmdoc) {
                    // Save as lightweight .smdoc format
                    // Audio data is already embedded in the innerHTML as data URIs,
                    // so we don't need to store it separately in audio.attachments
                    const editorContent = this.quill.root.innerHTML;
                    const currentTheme = document.body.getAttribute('data-theme') || 'light';
                    const title = this.currentFileName ? 
                        this.currentFileName.replace(/\.(smdoc|html?)$/i, '') : 
                        'Untitled';
                    
                    const smdoc = SMDocFormat.create({
                        content: editorContent,
                        title: title,
                        theme: currentTheme
                        // Note: audioAttachments NOT included - already in content
                    });
                    content = JSON.stringify(smdoc, null, 2);
                } else {
                    // Save as full HTML
                    content = await this.getDocumentHTML();
                }

                this._saving = true;
                this._autoSavePending = false;
                this.updateTitle();
                const result = await window.pywebview.api.write_file(filepath, content);
                this._saving = false;
                
                if (result !== 'Success') {
                    throw new Error(result);
                }
                
                const filename = filepath.split(/[\\/]/).pop();
                this.currentFileName = filename;
                this.currentFilePath = filepath;
                this.isDirty = false;
                this._autoSavePending = false;
                this.updateTitle();

                await this.loadAutoSavePreference();
                
                await this.clearUntitled();
                await this.saveSessionState();
                await this.loadFileBrowser();
                return true;
            } catch (error) {
                this._saving = false;
                this._autoSavePending = false;
                console.error('Error saving document:', error);
                await ModalDialogs.alert(`Error saving document: ${error.message}`, 'Error', ModalDialogs.icons.error);
                this.updateTitle();
                return false;
            }
        } else {
            // Original implementation (browser-based, defaults to .smdoc)
            try {
                let filename = this.currentFileName;
                
                if (!filename) {
                    // Prompt for filename
                    filename = await ModalDialogs.prompt('Enter document name:', {
                        title: 'Save Document',
                        icon: ModalDialogs.icons.save,
                        defaultValue: 'Untitled'
                    });
                    if (!filename) return false;
                }
                
                // Default to .smdoc if no extension
                const lowerName = filename.toLowerCase();
                if (!lowerName.endsWith('.html') && !lowerName.endsWith('.htm')
                    && !lowerName.endsWith('.smdoc') && !lowerName.endsWith('.docx')) {
                    filename += '.smdoc';
                }

                // Handle .docx export via dedicated endpoint
                if (lowerName.endsWith('.docx')) {
                    const editorContent = this.quill.root.innerHTML;
                    const response = await fetch('/api/file/export-docx', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: filename, content: editorContent })
                    });
                    const result = await response.json();
                    if (result.error) throw new Error(result.error);
                } else {
                    // Determine format based on extension
                    const isSmdoc = SMDocFormat.isSMDoc(filename);
                    let content;

                    if (isSmdoc) {
                        const editorContent = this.quill.root.innerHTML;
                        const currentTheme = document.body.getAttribute('data-theme') || 'light';
                        const title = filename.replace(/\.(smdoc|html?)$/i, '');

                        const smdoc = SMDocFormat.create({
                            content: editorContent,
                            title: title,
                            theme: currentTheme
                        });
                        content = JSON.stringify(smdoc, null, 2);
                    } else {
                        content = await this.getDocumentHTML();
                    }

                    const response = await fetch('/api/file/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: filename, content })
                    });

                    if (!response.ok) throw new Error('Failed to save document');
                }
                
                this.currentFileName = filename;
                this.currentFilePath = filename;
                this.isDirty = false;
                this._autoSavePending = false;
                this.updateTitle();
                
                await this.clearUntitled();
                await this.saveSessionState();
                await this.loadFileBrowser(); // Refresh file browser
                return true;
            } catch (error) {
                console.error('Error saving document:', error);
                await ModalDialogs.alert(`Error saving document: ${error.message}`, 'Error', ModalDialogs.icons.error);
                return false;
            }
        }
    },

    /**
     * Save as document
     */
    async saveAsDocument() {
        if (window.pywebview && window.pywebview.api) {
            const currentName = this.currentFileName || 'Untitled.smdoc';
            const filepath = await window.pywebview.api.save_file_dialog(currentName);
            
            if (!filepath) return;
            
            this.currentFilePath = filepath;
            // Update filename from path
            this.currentFileName = filepath.split(/[\\/]/).pop();
            
            await this.saveDocument();
        } else {
            const currentName = this.currentFileName ? this.currentFileName.replace(/\.(smdoc|html?)$/i, '') : 'Untitled';
            const filename = await ModalDialogs.prompt('Save as:', {
                title: 'Save As',
                icon: ModalDialogs.icons.save,
                defaultValue: currentName
            });
            
            if (!filename) return;
            
            this.currentFileName = null; // Force save as new file
            this.currentFilePath = null;
            
            // Temporarily set name and save
            this.currentFileName = filename;
            await this.saveDocument();
        }
    },

    /**
     * Delete document
     */
    async deleteDocument(filename) {
        try {
            const response = await fetch(`/api/documents/${encodeURIComponent(filename)}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) throw new Error('Failed to delete document');
            
            if (this.currentFileName === filename) {
                await this.createNewDocument();
            }
        } catch (error) {
            console.error('Error deleting document:', error);
            await ModalDialogs.alert(`Error deleting document: ${error.message}`, 'Error', '❌');
        }
    },

    /**
     * Check for unsaved changes
     */
    async checkUnsavedChanges() {
        if (!this.isDirty) return true;
        
        const docName = this.currentFileName ? this.currentFileName.replace(/\.(smdoc|html?)$/i, '') : 'Untitled';
        const result = await ModalDialogs.saveChanges(docName);
        
        if (result === 'save') {
            const ok = await this.saveDocument();
            return !!ok;
        } else if (result === 'dont-save') {
            // For scratch docs, keep content in cache so it can be continued later.
            if (!this.currentFilePath) {
                try {
                    await this.saveUntitled();
                } catch {
                    // ignore
                }
            }
            return true;
        } else {
            return false;
        }
    },

    /**
     * Update window title
     */
    updateTitle() {
        let name = this.currentFilePath
            ? (this._basenameFromPath(this.currentFilePath) || this.currentFileName || 'Untitled.smdoc')
            : (this.currentFileName || 'Untitled.smdoc');

        // Ensure a consistent filename appearance in the title bar.
        // Accept both .smdoc and .html/.htm extensions
        const lower = String(name).toLowerCase();
        if (!lower.endsWith('.html') && !lower.endsWith('.htm') && !lower.endsWith('.smdoc')) {
            name = `${name}.smdoc`;
        }

        const auto = !!this.currentFilePath && !!this.autoSaveEnabled;

        const dirtyMark = this.isDirty ? '*' : '';
        const savingSuffix = (this._saving || (auto && this.isDirty)) ? ' (saving...)' : '';

        const title = `śikṣāmitra - ${name}${dirtyMark}${savingSuffix}`;
        document.title = title;
        // In pywebview, the native window title is NOT automatically synced with document.title.
        try {
            if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.set_window_title === 'function') {
                window.pywebview.api.set_window_title(title);
            }
        } catch {
            // ignore
        }
        this.updateAutoSaveVisibility();
    },

    /**
     * Show file browser (alias for tab switch)
     */
    showFileBrowser() {
        const fileTab = document.querySelector('[data-tab="file"]');
        if (fileTab) fileTab.click();
    }
});

// Called from pywebview's Python close handler. Must return a boolean (or Promise<boolean>).
window.__sikshamitra_canClose = async () => {
    try {
        const editor = window.siksamitraEditor;
        if (!editor || typeof editor.checkUnsavedChanges !== 'function') return true;

        const ok = await editor.checkUnsavedChanges();
        if (!ok) return false;

        // Best-effort flush of scratch + session metadata before exit.
        try {
            // Only persist scratch when it is actually unsaved/dirty.
            if (!editor.currentFilePath && editor.isDirty && typeof editor.saveUntitled === 'function') {
                await editor.saveUntitled();
            }
        } catch {
            // ignore
        }
        try {
            if (typeof editor.saveSessionState === 'function') {
                await editor.saveSessionState();
            }
        } catch {
            // ignore
        }

        return true;
    } catch (e) {
        console.warn('Close check failed; allowing close:', e);
        return true;
    }
};
