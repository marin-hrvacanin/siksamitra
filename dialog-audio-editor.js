/**
 * dialog-audio-editor.js — Advanced waveform editor for the Audio Editor dialog.
 *
 *  Capabilities:
 *   - Canvas waveform rendered from WebAudio-decoded PCM (peak per pixel)
 *   - Horizontal zoom (Ctrl/Cmd+wheel keeps cursor anchor, toolbar +/−, Fit)
 *   - Click on waveform to move the playhead (also draggable)
 *   - Drag-to-select a time range; toolbar exposes selection actions
 *   - Multiple regions with draggable handles + draggable body
 *   - Single + multi region selection (shift/ctrl-click in regions list or on bodies)
 *   - Per-region label + per-region target-section assignment (multi-hierarchy)
 *   - Cursor jump-to-start, jump-to-end, jump-to-region-start/end
 *   - Auto-Align: text-aware alignment using IAST syllable counts + energy VAD
 *   - Auto-Split: pure energy-based segmentation (no text input)
 *   - Apply: POSTs resulting regions back to the main editor
 *   - All popup close/apply/cancel paths go through pywebview.api.close_dialog
 */

(() => {
    'use strict';

    // ═════════════════════════════════════════════════════════════════════════
    //  State
    // ═════════════════════════════════════════════════════════════════════════
    const state = {
        audio: null,                  // { id, label, src, duration, size }
        audioBuffer: null,            // Decoded AudioBuffer for waveform
        peaks: null,                  // Float32Array of peaks (downsampled)
        channelData: null,            // Mono PCM for analysis
        sampleRate: 44100,
        targets: [],                  // [{ lineIndex, text, level, syllables }]
        regions: [],                  // [{ id, start, end, label, targetIndex }]
        activeRegionIds: new Set(),   // multi-selected region IDs
        primaryRegionId: null,        // most-recently focused region (for details panel)
        timeSelection: null,          // { start, end } when user has dragged a range
        zoom: 1.0,                    // 1.0 = fit-to-window; up to 50×
        duration: 0,                  // seconds
        playhead: 0,                  // seconds
        audioEl: null,                // hidden HTMLAudioElement
        playing: false,
        regionPlayEnd: null,          // when playing a single region
        mode: 'single',               // 'single' or 'multi'
    };

    // ═════════════════════════════════════════════════════════════════════════
    //  DOM refs
    // ═════════════════════════════════════════════════════════════════════════
    const dom = {};
    function cacheDom() {
        [
            'audioTitle','audioMeta','multiNote',
            'btnPlay','btnPause','btnStop','btnPlayRegion','btnPlaySelection',
            'btnJumpStart','btnJumpEnd','btnJumpRegionStart','btnJumpRegionEnd',
            'btnZoomOut','btnZoomIn','btnZoomFit','zoomLevel',
            'btnAddRegion','btnSetStart','btnSetEnd',
            'btnRegionFromSelection','btnInvertSelection','btnCutSelection','btnClearSelection',
            'btnAutoAlign','btnAutoSplit','btnAddSection',
            'waveScroller','waveInner','waveCanvas','timeline','selectionLayer',
            'regionsList','targetsList','regionDetails','detailBody',
            'statusMsg','deleteAllBtn','cancelBtn','applyBtn',
            'sectionPickerOverlay','sectionPickerList','sectionPickerCancel','sectionPickerAdd',
        ].forEach(id => dom[id] = document.getElementById(id));
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Utility
    // ═════════════════════════════════════════════════════════════════════════
    const fmtTime = (s) => {
        if (!isFinite(s) || isNaN(s)) return '0:00.000';
        const sign = s < 0 ? '-' : '';
        s = Math.abs(s);
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        const ms = Math.floor((s % 1) * 1000);
        return `${sign}${m}:${String(sec).padStart(2,'0')}.${String(ms).padStart(3,'0')}`;
    };
    const parseTime = (str) => {
        try {
            const parts = (str || '').split(':');
            if (parts.length !== 2) return NaN;
            const m = parseFloat(parts[0]);
            const rest = parts[1].split('.');
            const s = parseFloat(rest[0]) || 0;
            const ms = rest.length > 1 ? parseFloat('0.' + rest[1]) : 0;
            return m * 60 + s + ms;
        } catch(e) { return NaN; }
    };
    const fmtSize = (bytes) => {
        if (!bytes) return '';
        const mb = bytes / (1024*1024);
        return mb < 1 ? `${(bytes/1024).toFixed(1)} KB` : `${mb.toFixed(2)} MB`;
    };
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const genId = () => `reg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

    function setStatus(msg, kind) {
        if (!dom.statusMsg) return;
        dom.statusMsg.textContent = msg || '';
        dom.statusMsg.className = 'popup-footer-status' + (kind ? ' ' + kind : '');
        if (msg) setTimeout(() => {
            if (dom.statusMsg.textContent === msg) {
                dom.statusMsg.textContent = '';
                dom.statusMsg.className = 'popup-footer-status';
            }
        }, 3500);
    }

    async function postAction(type, data) {
        try {
            await fetch('/api/dialog/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, ...data }),
            });
        } catch(e) { console.error('postAction', e); }
    }

    async function closeDialog() {
        try {
            if (window.pywebview?.api?.close_dialog) {
                await window.pywebview.api.close_dialog('audio-editor');
            } else {
                window.close();
            }
        } catch(e) { console.error('closeDialog', e); }
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Load state
    // ═════════════════════════════════════════════════════════════════════════
    async function loadState() {
        try {
            const resp = await fetch('/api/audio/editor/state');
            const data = await resp.json();
            state.audio = data.audio || null;
            state.targets = (data.targets || []).map(t => ({
                lineIndex: t.lineIndex,
                text: t.text || '',
                level: t.level || 'line',
                syllables: typeof t.syllables === 'number' ? t.syllables : null,
            }));
            state.regions = (data.regions || []).map(r => ({
                id: r.id || genId(),
                start: Number(r.start) || 0,
                end: Number(r.end) || 0,
                label: r.label || '',
                targetIndex: typeof r.targetIndex === 'number' ? r.targetIndex : null,
            }));
            state.mode = state.targets.length > 1 ? 'multi' : 'single';

            if (!state.audio || !state.audio.src) {
                setStatus('No audio loaded.', 'error');
                return;
            }

            dom.audioTitle.textContent = state.audio.label || 'Audio';
            state.duration = state.audio.duration || 0;

            if (state.mode === 'multi') {
                dom.multiNote.hidden = false;
                dom.multiNote.innerHTML =
                    `<strong>Multi-section mode.</strong> ${state.targets.length} sections targeted. ` +
                    `Use <em>＋ Region</em>, <em>Region from selection</em>, or <em>Auto-Align</em> ` +
                    `to mark one audio region per section, then assign each region.`;
            }

            // Audio element
            state.audioEl = new Audio();
            state.audioEl.src = state.audio.src;
            state.audioEl.preload = 'auto';
            state.audioEl.addEventListener('loadedmetadata', () => {
                if (!state.duration || !isFinite(state.duration)) {
                    state.duration = state.audioEl.duration || 0;
                }
                dom.audioMeta.textContent =
                    `Duration: ${fmtTime(state.duration)}` +
                    (state.audio.size ? ` • Size: ${fmtSize(state.audio.size)}` : '');
                if (!state.regions.length && state.mode === 'single' && state.targets.length === 1) {
                    state.regions.push({
                        id: genId(),
                        start: 0,
                        end: state.duration,
                        label: state.targets[0].text || 'Region 1',
                        targetIndex: 0,
                    });
                    state.primaryRegionId = state.regions[0].id;
                    state.activeRegionIds = new Set([state.primaryRegionId]);
                } else if (state.regions.length) {
                    state.primaryRegionId = state.regions[0].id;
                    state.activeRegionIds = new Set([state.primaryRegionId]);
                }
                decodeAudioForWaveform();
                layout();
                renderTargetsList();
                renderRegionsList();
                renderRegionDetails();
                updateToolbarState();
            });
            state.audioEl.addEventListener('timeupdate', onTimeUpdate);
            state.audioEl.addEventListener('ended', () => {
                state.playing = false;
                dom.btnPlay.disabled = false;
                dom.btnPause.disabled = true;
                dom.btnStop.disabled = true;
                state.regionPlayEnd = null;
            });
        } catch(e) {
            console.error('loadState failed', e);
            setStatus('Failed to load audio state.', 'error');
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Waveform decoding
    // ═════════════════════════════════════════════════════════════════════════
    async function decodeAudioForWaveform() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const resp = await fetch(state.audio.src);
            const arrBuf = await resp.arrayBuffer();
            const decoded = await ctx.decodeAudioData(arrBuf);
            state.audioBuffer = decoded;
            state.sampleRate = decoded.sampleRate;
            // Sum to mono for analysis
            const numCh = decoded.numberOfChannels;
            const len = decoded.length;
            const mono = new Float32Array(len);
            for (let c = 0; c < numCh; c++) {
                const ch = decoded.getChannelData(c);
                for (let i = 0; i < len; i++) mono[i] += ch[i];
            }
            for (let i = 0; i < len; i++) mono[i] /= numCh;
            state.channelData = mono;

            // Peaks: ~6000 points (enough for high zoom)
            const targetPoints = 6000;
            const samplesPerPeak = Math.max(1, Math.floor(len / targetPoints));
            const peakCount = Math.ceil(len / samplesPerPeak);
            const peaks = new Float32Array(peakCount);
            for (let i = 0; i < peakCount; i++) {
                let max = 0;
                const s = i * samplesPerPeak;
                const e = Math.min(len, s + samplesPerPeak);
                for (let j = s; j < e; j++) {
                    const v = Math.abs(mono[j]);
                    if (v > max) max = v;
                }
                peaks[i] = max;
            }
            state.peaks = peaks;
            drawWaveform();
        } catch(e) {
            console.warn('Could not decode audio', e);
            state.peaks = null;
            drawWaveform();
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Layout / draw
    // ═════════════════════════════════════════════════════════════════════════
    function layout() {
        if (!state.duration) return;
        const wrapW = dom.waveScroller.clientWidth;
        const innerW = Math.max(wrapW, Math.round(wrapW * state.zoom));
        dom.waveInner.style.width = innerW + 'px';

        const dpr = window.devicePixelRatio || 1;
        const waveHeight = dom.waveInner.clientHeight - 18;
        dom.waveCanvas.style.position = 'absolute';
        dom.waveCanvas.style.top = '18px';
        dom.waveCanvas.style.left = '0';
        dom.waveCanvas.style.width = innerW + 'px';
        dom.waveCanvas.style.height = waveHeight + 'px';
        dom.waveCanvas.width = Math.max(1, innerW * dpr);
        dom.waveCanvas.height = Math.max(1, waveHeight * dpr);

        drawWaveform();
        drawTimeline();
        renderRegionsOnWaveform();
        renderSelection();
        renderPlayhead();
    }

    function drawWaveform() {
        if (!dom.waveCanvas) return;
        const ctx = dom.waveCanvas.getContext('2d');
        const w = dom.waveCanvas.width;
        const h = dom.waveCanvas.height;
        ctx.clearRect(0, 0, w, h);

        const cs = getComputedStyle(document.body);
        const primary = cs.getPropertyValue('--primary').trim() || '#b8813d';
        const bg = cs.getPropertyValue('--bg-surface').trim() || '#fff';
        const muted = cs.getPropertyValue('--text-tertiary').trim() || '#999';

        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        if (!state.peaks) {
            ctx.fillStyle = muted;
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Decoding audio…', w/2, h/2);
            return;
        }

        const mid = h / 2;
        ctx.fillStyle = primary;
        const peaks = state.peaks;
        for (let x = 0; x < w; x++) {
            const p0 = Math.floor((x / w) * peaks.length);
            const p1 = Math.floor(((x + 1) / w) * peaks.length);
            let max = 0;
            for (let i = p0; i < p1; i++) if (peaks[i] > max) max = peaks[i];
            const barH = Math.max(1, Math.round(max * (h * 0.9)));
            ctx.fillRect(x, mid - barH/2, 1, barH);
        }
        // Center axis
        ctx.fillStyle = 'rgba(128,128,128,0.25)';
        ctx.fillRect(0, mid, w, 1);
    }

    function drawTimeline() {
        dom.timeline.innerHTML = '';
        if (!state.duration) return;
        const innerW = dom.waveInner.clientWidth;
        const targetTicks = Math.min(20, Math.max(8, Math.round(innerW / 80)));
        const rawInterval = state.duration / targetTicks;
        const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
        let interval = steps[steps.length - 1];
        for (const s of steps) { if (s >= rawInterval) { interval = s; break; } }

        for (let t = 0; t <= state.duration + 0.001; t += interval) {
            const x = (t / state.duration) * innerW;
            const tick = document.createElement('div');
            tick.className = 'ae-timeline-tick';
            tick.style.left = x + 'px';
            dom.timeline.appendChild(tick);

            const label = document.createElement('div');
            label.className = 'ae-timeline-label';
            label.style.left = x + 'px';
            label.textContent = fmtTime(t).replace(/\.\d+$/, '');
            dom.timeline.appendChild(label);
        }
    }

    function xToTime(x) {
        const innerW = dom.waveInner.clientWidth;
        if (!innerW || !state.duration) return 0;
        return clamp((x / innerW) * state.duration, 0, state.duration);
    }
    function timeToX(t) {
        const innerW = dom.waveInner.clientWidth;
        if (!state.duration) return 0;
        return (t / state.duration) * innerW;
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Regions on waveform
    // ═════════════════════════════════════════════════════════════════════════
    function renderRegionsOnWaveform() {
        dom.waveInner.querySelectorAll('.ae-region').forEach(r => r.remove());
        state.regions.forEach((reg) => {
            const div = document.createElement('div');
            const isActive = state.activeRegionIds.has(reg.id);
            const isPrimary = state.primaryRegionId === reg.id;
            div.className = 'ae-region' + (isActive ? ' active' : '') + (isPrimary ? ' primary' : '');
            div.dataset.regionId = reg.id;
            const x1 = timeToX(reg.start);
            const x2 = timeToX(reg.end);
            div.style.left = x1 + 'px';
            div.style.width = Math.max(4, x2 - x1) + 'px';

            const body = document.createElement('div');
            body.className = 'ae-region-body';
            div.appendChild(body);

            const label = document.createElement('div');
            label.className = 'ae-region-label';
            label.textContent = reg.label || 'Region';
            label.title = (reg.label || 'Region') + ` — click to select, Shift/Ctrl-click to multi-select`;
            div.appendChild(label);

            ['start','end'].forEach(which => {
                const h = document.createElement('div');
                h.className = 'ae-region-handle ' + which;
                h.dataset.role = which;
                div.appendChild(h);
            });

            attachRegionDragHandlers(div, reg);
            dom.waveInner.appendChild(div);
        });
    }

    function attachRegionDragHandlers(div, reg) {
        const onBodyMouseDown = (e) => {
            if (e.target.classList.contains('ae-region-handle')) return;

            // Selection logic
            const additive = e.shiftKey || e.ctrlKey || e.metaKey;
            if (additive) {
                if (state.activeRegionIds.has(reg.id)) state.activeRegionIds.delete(reg.id);
                else state.activeRegionIds.add(reg.id);
            } else {
                state.activeRegionIds = new Set([reg.id]);
            }
            state.primaryRegionId = reg.id;
            state.timeSelection = null;
            renderRegionsOnWaveform();
            renderRegionsList();
            renderRegionDetails();
            renderSelection();
            updateToolbarState();

            // Drag-to-move (only for primary; multi-move not implemented)
            if (additive) { e.preventDefault(); return; }
            e.preventDefault();
            const startTime = reg.start;
            const endTime = reg.end;
            const mdX = e.clientX;
            let moved = false;

            const onMove = (mv) => {
                const dx = mv.clientX - mdX;
                if (Math.abs(dx) > 2) moved = true;
                const innerW = dom.waveInner.clientWidth;
                const dt = (dx / innerW) * state.duration;
                const dur = endTime - startTime;
                const newStart = clamp(startTime + dt, 0, state.duration - dur);
                reg.start = newStart;
                reg.end = newStart + dur;
                renderRegionsOnWaveform();
                renderRegionsList();
                renderRegionDetails();
            };
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        };

        const onHandleMouseDown = (e) => {
            const role = e.target.dataset.role;
            if (!role) return;
            e.preventDefault();
            e.stopPropagation();
            state.activeRegionIds = new Set([reg.id]);
            state.primaryRegionId = reg.id;

            const onMove = (mv) => {
                const rect = dom.waveInner.getBoundingClientRect();
                const innerW = dom.waveInner.clientWidth;
                const x = mv.clientX - rect.left;
                const t = clamp((x / innerW) * state.duration, 0, state.duration);
                if (role === 'start') {
                    reg.start = Math.min(t, reg.end - 0.05);
                } else {
                    reg.end = Math.max(t, reg.start + 0.05);
                }
                renderRegionsOnWaveform();
                renderRegionsList();
                renderRegionDetails();
            };
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        };

        div.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('ae-region-handle')) {
                onHandleMouseDown(e);
            } else {
                onBodyMouseDown(e);
            }
        });
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Time selection (drag on empty waveform area)
    // ═════════════════════════════════════════════════════════════════════════
    function renderSelection() {
        // Clear existing
        const existing = dom.waveInner.querySelector('.ae-time-selection');
        if (existing) existing.remove();
        if (!state.timeSelection) return;
        const sel = document.createElement('div');
        sel.className = 'ae-time-selection';
        const x1 = timeToX(state.timeSelection.start);
        const x2 = timeToX(state.timeSelection.end);
        sel.style.left = Math.min(x1, x2) + 'px';
        sel.style.width = Math.abs(x2 - x1) + 'px';
        dom.waveInner.appendChild(sel);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Playhead
    // ═════════════════════════════════════════════════════════════════════════
    function renderPlayhead() {
        let ph = dom.waveInner.querySelector('.ae-playhead');
        if (!ph) {
            ph = document.createElement('div');
            ph.className = 'ae-playhead';
            dom.waveInner.appendChild(ph);
        }
        ph.style.left = timeToX(state.playhead) + 'px';
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Waveform interactions: click=seek, drag=select-time, wheel=zoom
    // ═════════════════════════════════════════════════════════════════════════
    function attachWaveInteractions() {
        let dragMode = null;            // 'playhead' | 'select'
        let dragStartX = null;
        let dragStartTime = null;

        dom.waveInner.addEventListener('mousedown', (e) => {
            if (e.target.closest('.ae-region')) return;          // region handles itself
            const rect = dom.waveInner.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const t = xToTime(x);
            dragStartX = x;
            dragStartTime = t;

            // Default: single click moves playhead. Drag (>2px) = selection.
            dragMode = 'click';
            // If shift/alt we always start a selection
            if (e.shiftKey || e.altKey) dragMode = 'select';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (dragMode == null) return;
            const rect = dom.waveInner.getBoundingClientRect();
            const x = clamp(e.clientX - rect.left, 0, dom.waveInner.clientWidth);
            if (dragMode === 'click' && Math.abs(x - dragStartX) > 3) {
                dragMode = 'select';
            }
            if (dragMode === 'select') {
                const t = xToTime(x);
                state.timeSelection = {
                    start: Math.min(dragStartTime, t),
                    end: Math.max(dragStartTime, t),
                };
                renderSelection();
                updateToolbarState();
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (dragMode === 'click') {
                // Pure click → move playhead, clear selection
                state.playhead = dragStartTime;
                state.timeSelection = null;
                if (state.audioEl) state.audioEl.currentTime = state.playhead;
                // Also deselect any region selection (treat as canvas click)
                state.activeRegionIds = new Set();
                state.primaryRegionId = null;
                renderRegionsOnWaveform();
                renderRegionsList();
                renderRegionDetails();
                renderSelection();
                renderPlayhead();
                updateToolbarState();
            } else if (dragMode === 'select') {
                // Selection complete; toolbar already updated
                renderSelection();
                updateToolbarState();
            }
            dragMode = null;
            dragStartX = null;
            dragStartTime = null;
        });

        // Drag the playhead head ("triangle"): allow grabbing the existing playhead
        dom.waveInner.addEventListener('mousedown', (e) => {
            const ph = dom.waveInner.querySelector('.ae-playhead');
            if (!ph) return;
            const phRect = ph.getBoundingClientRect();
            // 12px wide grab zone around playhead position
            if (e.clientX >= phRect.left - 6 && e.clientX <= phRect.left + 6) {
                e.stopImmediatePropagation();
                e.preventDefault();
                dragMode = null; // override
                const onMove = (mv) => {
                    const rect = dom.waveInner.getBoundingClientRect();
                    const x = clamp(mv.clientX - rect.left, 0, dom.waveInner.clientWidth);
                    state.playhead = xToTime(x);
                    if (state.audioEl) state.audioEl.currentTime = state.playhead;
                    renderPlayhead();
                };
                const onUp = () => {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            }
        }, true);

        // Ctrl+wheel zoom (cursor-anchored)
        dom.waveScroller.addEventListener('wheel', (e) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            e.preventDefault();
            const delta = e.deltaY < 0 ? 1.2 : 1 / 1.2;
            const prevZoom = state.zoom;
            const newZoom = clamp(state.zoom * delta, 1, 50);
            if (newZoom === prevZoom) return;
            const rect = dom.waveInner.getBoundingClientRect();
            const relX = e.clientX - rect.left;
            const t = xToTime(relX);
            state.zoom = newZoom;
            layout();
            const newX = timeToX(t);
            const scrollRect = dom.waveScroller.getBoundingClientRect();
            dom.waveScroller.scrollLeft = newX - (e.clientX - scrollRect.left);
            dom.zoomLevel.textContent = state.zoom.toFixed(1) + '×';
        }, { passive: false });
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Playback
    // ═════════════════════════════════════════════════════════════════════════
    function onTimeUpdate() {
        if (!state.audioEl) return;
        state.playhead = state.audioEl.currentTime;
        renderPlayhead();
        if (state.regionPlayEnd != null && state.playhead >= state.regionPlayEnd) {
            state.audioEl.pause();
            state.playing = false;
            state.regionPlayEnd = null;
            dom.btnPlay.disabled = false;
            dom.btnPause.disabled = true;
            dom.btnStop.disabled = true;
        }
    }
    function play() {
        if (!state.audioEl) return;
        state.regionPlayEnd = null;
        state.audioEl.play();
        state.playing = true;
        dom.btnPlay.disabled = true;
        dom.btnPause.disabled = false;
        dom.btnStop.disabled = false;
    }
    function playRegion() {
        const reg = getPrimaryRegion();
        if (!reg || !state.audioEl) return;
        state.audioEl.currentTime = reg.start;
        state.regionPlayEnd = reg.end;
        state.audioEl.play();
        state.playing = true;
        dom.btnPlay.disabled = true;
        dom.btnPause.disabled = false;
        dom.btnStop.disabled = false;
    }
    function playSelection() {
        if (!state.timeSelection || !state.audioEl) return;
        state.audioEl.currentTime = state.timeSelection.start;
        state.regionPlayEnd = state.timeSelection.end;
        state.audioEl.play();
        state.playing = true;
        dom.btnPlay.disabled = true;
        dom.btnPause.disabled = false;
        dom.btnStop.disabled = false;
    }
    function pause() {
        if (!state.audioEl) return;
        state.audioEl.pause();
        state.playing = false;
        dom.btnPlay.disabled = false;
        dom.btnPause.disabled = true;
    }
    function stop() {
        if (!state.audioEl) return;
        state.audioEl.pause();
        state.audioEl.currentTime = 0;
        state.playhead = 0;
        state.playing = false;
        state.regionPlayEnd = null;
        renderPlayhead();
        dom.btnPlay.disabled = false;
        dom.btnPause.disabled = true;
        dom.btnStop.disabled = true;
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Cursor jumps
    // ═════════════════════════════════════════════════════════════════════════
    function jumpToStart() { setPlayhead(0); }
    function jumpToEnd()   { setPlayhead(state.duration); }
    function jumpToRegionStart() {
        const reg = getPrimaryRegion();
        if (reg) setPlayhead(reg.start);
    }
    function jumpToRegionEnd() {
        const reg = getPrimaryRegion();
        if (reg) setPlayhead(reg.end);
    }
    function setPlayhead(t) {
        state.playhead = clamp(t, 0, state.duration);
        if (state.audioEl) state.audioEl.currentTime = state.playhead;
        renderPlayhead();
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Sidebar: targets list + regions list + details
    // ═════════════════════════════════════════════════════════════════════════
    function getPrimaryRegion() {
        return state.regions.find(r => r.id === state.primaryRegionId) || null;
    }

    function renderTargetsList() {
        if (!dom.targetsList) return;
        dom.targetsList.innerHTML = '';
        if (!state.targets.length) {
            const em = document.createElement('div');
            em.className = 'ae-list-empty';
            em.textContent = 'No target sections.';
            dom.targetsList.appendChild(em);
            return;
        }
        state.targets.forEach((t, idx) => {
            const card = document.createElement('div');
            card.className = 'ae-target-card ae-target-level-' + (t.level || 'line');
            const assignedRegion = state.regions.find(r => r.targetIndex === idx);

            const lvl = document.createElement('span');
            lvl.className = 'ae-target-level-pill';
            lvl.textContent = labelForLevel(t.level);
            card.appendChild(lvl);

            const txt = document.createElement('div');
            txt.className = 'ae-target-text';
            txt.textContent = t.text || `Line ${t.lineIndex}`;
            card.appendChild(txt);

            const meta = document.createElement('div');
            meta.className = 'ae-target-meta';
            if (assignedRegion) {
                meta.innerHTML = `<span class="ae-status-ok">●</span> ` +
                    `${fmtTime(assignedRegion.start)} → ${fmtTime(assignedRegion.end)} ` +
                    `(${fmtTime(assignedRegion.end - assignedRegion.start)})`;
                if (typeof t.syllables === 'number')
                    meta.innerHTML += ` <span class="ae-syl">${t.syllables} syl</span>`;
            } else {
                meta.innerHTML = `<span class="ae-status-warn">○</span> Unassigned` +
                    (typeof t.syllables === 'number' ? ` <span class="ae-syl">${t.syllables} syl</span>` : '');
            }
            card.appendChild(meta);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'ae-target-remove';
            removeBtn.textContent = '×';
            removeBtn.title = 'Remove this section';
            removeBtn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                removeTarget(idx);
            });
            card.appendChild(removeBtn);

            // Click → focus the assigned region (if any)
            card.addEventListener('click', () => {
                if (assignedRegion) {
                    state.primaryRegionId = assignedRegion.id;
                    state.activeRegionIds = new Set([assignedRegion.id]);
                    renderRegionsOnWaveform();
                    renderRegionsList();
                    renderRegionDetails();
                    updateToolbarState();
                }
            });

            dom.targetsList.appendChild(card);
        });
    }

    function labelForLevel(level) {
        switch ((level || 'line').toLowerCase()) {
            case 'title': return 'TITLE';
            case 'subtitle': return 'SUBTITLE';
            case 'section': return 'SECTION';
            case 'subsection': return 'SUBSECTION';
            case 'translation': return 'TRANSLATION';
            case 'comment': return 'COMMENT';
            default: return 'LINE';
        }
    }

    function renderRegionsList() {
        dom.regionsList.innerHTML = '';
        if (!state.regions.length) {
            const em = document.createElement('div');
            em.className = 'ae-list-empty';
            em.textContent = state.mode === 'multi'
                ? 'No regions yet. Use ＋ Region or Auto-Align.'
                : 'No regions.';
            dom.regionsList.appendChild(em);
            return;
        }
        state.regions.forEach((r, idx) => {
            const isActive = state.activeRegionIds.has(r.id);
            const isPrimary = state.primaryRegionId === r.id;
            const card = document.createElement('div');
            card.className = 'ae-region-card' + (isActive ? ' active' : '') + (isPrimary ? ' primary' : '');
            card.dataset.regionId = r.id;
            card.tabIndex = 0;
            card.addEventListener('click', (e) => {
                const additive = e.shiftKey || e.ctrlKey || e.metaKey;
                if (additive) {
                    if (state.activeRegionIds.has(r.id)) state.activeRegionIds.delete(r.id);
                    else state.activeRegionIds.add(r.id);
                } else {
                    state.activeRegionIds = new Set([r.id]);
                }
                state.primaryRegionId = r.id;
                renderRegionsOnWaveform();
                renderRegionsList();
                renderRegionDetails();
                updateToolbarState();
            });

            const info = document.createElement('div');
            info.className = 'ae-region-card-info';

            const lbl = document.createElement('div');
            lbl.className = 'ae-region-card-label';
            lbl.textContent = r.label || `Region ${idx + 1}`;
            info.appendChild(lbl);

            const tm = document.createElement('div');
            tm.className = 'ae-region-card-times';
            tm.textContent = `${fmtTime(r.start)} → ${fmtTime(r.end)}  (${fmtTime(r.end - r.start)})`;
            info.appendChild(tm);

            if (state.targets.length) {
                const tgt = document.createElement('div');
                tgt.className = 'ae-region-card-target' + (r.targetIndex == null ? ' ae-region-card-unassigned' : '');
                tgt.textContent = r.targetIndex != null && state.targets[r.targetIndex]
                    ? `↦ ${state.targets[r.targetIndex].text || ('Line ' + state.targets[r.targetIndex].lineIndex)}`
                    : '↦ Unassigned';
                info.appendChild(tgt);
            }

            card.appendChild(info);
            dom.regionsList.appendChild(card);
        });
    }

    function renderRegionDetails() {
        const reg = getPrimaryRegion();
        if (!reg) {
            dom.detailBody.innerHTML =
                '<div class="ae-detail-empty">Click a region to edit its properties.</div>';
            return;
        }
        dom.detailBody.innerHTML = '';

        dom.detailBody.appendChild(mkDetailRow('Start', 'text', fmtTime(reg.start), (v) => {
            const t = parseTime(v);
            if (!isNaN(t) && t >= 0 && t < reg.end) {
                reg.start = t;
                renderRegionsOnWaveform();
                renderRegionsList();
                renderTargetsList();
            }
        }));
        dom.detailBody.appendChild(mkDetailRow('End', 'text', fmtTime(reg.end), (v) => {
            const t = parseTime(v);
            if (!isNaN(t) && t > reg.start && t <= state.duration) {
                reg.end = t;
                renderRegionsOnWaveform();
                renderRegionsList();
                renderTargetsList();
            }
        }));
        dom.detailBody.appendChild(mkDetailRow('Label', 'text', reg.label, (v) => {
            reg.label = v;
            renderRegionsOnWaveform();
            renderRegionsList();
        }));

        if (state.targets.length) {
            const row = document.createElement('div');
            row.className = 'ae-detail-row';
            const lbl = document.createElement('div');
            lbl.className = 'ae-detail-label';
            lbl.textContent = 'Assign to';
            row.appendChild(lbl);
            const sel = document.createElement('select');
            sel.className = 'ae-detail-select';
            sel.innerHTML = '<option value="">— Unassigned —</option>';
            state.targets.forEach((t, i) => {
                const opt = document.createElement('option');
                opt.value = String(i);
                opt.textContent = `[${labelForLevel(t.level)}] ${t.text || ('Line ' + t.lineIndex)}`;
                if (reg.targetIndex === i) opt.selected = true;
                sel.appendChild(opt);
            });
            sel.addEventListener('change', () => {
                reg.targetIndex = sel.value === '' ? null : parseInt(sel.value, 10);
                renderRegionsList();
                renderTargetsList();
            });
            row.appendChild(sel);
            dom.detailBody.appendChild(row);
        }

        const actions = document.createElement('div');
        actions.style.marginTop = '10px';
        actions.style.display = 'flex';
        actions.style.gap = '6px';
        actions.style.flexWrap = 'wrap';

        const rmBtn = document.createElement('button');
        rmBtn.type = 'button';
        rmBtn.className = 'ae-tool-btn danger';
        rmBtn.textContent = 'Delete Region';
        rmBtn.addEventListener('click', () => removeRegion(reg.id));
        actions.appendChild(rmBtn);

        const playBtn = document.createElement('button');
        playBtn.type = 'button';
        playBtn.className = 'ae-tool-btn';
        playBtn.textContent = '▸ Play';
        playBtn.addEventListener('click', playRegion);
        actions.appendChild(playBtn);

        dom.detailBody.appendChild(actions);
    }

    function mkDetailRow(label, type, value, onChange) {
        const row = document.createElement('div');
        row.className = 'ae-detail-row';
        const lbl = document.createElement('div');
        lbl.className = 'ae-detail-label';
        lbl.textContent = label;
        row.appendChild(lbl);
        const inp = document.createElement('input');
        inp.type = type;
        inp.className = 'ae-detail-input';
        inp.value = value;
        const fire = () => onChange(inp.value);
        inp.addEventListener('change', fire);
        inp.addEventListener('blur', fire);
        row.appendChild(inp);
        return row;
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Region operations
    // ═════════════════════════════════════════════════════════════════════════
    function addRegion() {
        let start, end;
        if (state.timeSelection) {
            start = state.timeSelection.start;
            end = state.timeSelection.end;
        } else {
            const center = state.playhead;
            const defaultLen = Math.min(5, state.duration / 10);
            start = clamp(center - defaultLen / 2, 0, state.duration - defaultLen);
            end = start + defaultLen;
        }
        let tgtIdx = nextUnassignedTargetIndex();
        const label = tgtIdx != null
            ? (state.targets[tgtIdx].text || `Region ${state.regions.length + 1}`)
            : `Region ${state.regions.length + 1}`;
        const reg = { id: genId(), start, end, label, targetIndex: tgtIdx };
        state.regions.push(reg);
        // Sort regions by start so list order matches time order
        state.regions.sort((a, b) => a.start - b.start);
        state.primaryRegionId = reg.id;
        state.activeRegionIds = new Set([reg.id]);
        state.timeSelection = null;
        renderRegionsOnWaveform();
        renderRegionsList();
        renderRegionDetails();
        renderTargetsList();
        renderSelection();
        updateToolbarState();
    }

    function nextUnassignedTargetIndex() {
        if (!state.targets.length) return null;
        const assigned = new Set(state.regions.map(r => r.targetIndex).filter(x => x != null));
        for (let i = 0; i < state.targets.length; i++) {
            if (!assigned.has(i)) return i;
        }
        return null;
    }

    function removeRegion(id) {
        state.regions = state.regions.filter(r => r.id !== id);
        state.activeRegionIds.delete(id);
        if (state.primaryRegionId === id) {
            state.primaryRegionId = state.regions.length ? state.regions[0].id : null;
            if (state.primaryRegionId) state.activeRegionIds.add(state.primaryRegionId);
        }
        renderRegionsOnWaveform();
        renderRegionsList();
        renderRegionDetails();
        renderTargetsList();
        updateToolbarState();
    }

    function removeSelectedRegions() {
        if (!state.activeRegionIds.size) return;
        state.regions = state.regions.filter(r => !state.activeRegionIds.has(r.id));
        state.activeRegionIds.clear();
        state.primaryRegionId = state.regions.length ? state.regions[0].id : null;
        if (state.primaryRegionId) state.activeRegionIds.add(state.primaryRegionId);
        renderRegionsOnWaveform();
        renderRegionsList();
        renderRegionDetails();
        renderTargetsList();
        updateToolbarState();
    }

    function setActiveRegionStart() {
        const reg = getPrimaryRegion();
        if (!reg) return;
        if (state.playhead < reg.end) { reg.start = state.playhead; renderRegionsOnWaveform(); renderRegionsList(); renderRegionDetails(); renderTargetsList(); }
    }
    function setActiveRegionEnd() {
        const reg = getPrimaryRegion();
        if (!reg) return;
        if (state.playhead > reg.start) { reg.end = state.playhead; renderRegionsOnWaveform(); renderRegionsList(); renderRegionDetails(); renderTargetsList(); }
    }

    // Selection-based operations
    function regionFromSelection() {
        if (!state.timeSelection) return;
        addRegion();           // uses the selection
    }
    function invertSelectionToRegions() {
        // Take the current selection as a "negative" — convert non-selected portions to a region each
        // Useful: select silence between shlokas, invert to get the shloka regions.
        if (!state.timeSelection) return;
        const sel = state.timeSelection;
        const pieces = [];
        if (sel.start > 0.05) pieces.push([0, sel.start]);
        if (sel.end < state.duration - 0.05) pieces.push([sel.end, state.duration]);
        pieces.forEach(([s, e]) => {
            const tgt = nextUnassignedTargetIndex();
            const label = tgt != null
                ? (state.targets[tgt].text || `Region ${state.regions.length + 1}`)
                : `Region ${state.regions.length + 1}`;
            state.regions.push({ id: genId(), start: s, end: e, label, targetIndex: tgt });
        });
        state.regions.sort((a, b) => a.start - b.start);
        state.timeSelection = null;
        renderRegionsOnWaveform();
        renderRegionsList();
        renderRegionDetails();
        renderTargetsList();
        renderSelection();
        updateToolbarState();
    }
    function cutSelectionFromRegions() {
        // Trim/split any region overlapping the selection
        if (!state.timeSelection) return;
        const sel = state.timeSelection;
        const next = [];
        state.regions.forEach(r => {
            if (r.end <= sel.start || r.start >= sel.end) {
                // No overlap
                next.push(r);
                return;
            }
            // Overlap — split into 0–2 pieces
            if (r.start < sel.start) {
                next.push({ ...r, id: genId(), end: sel.start });
            }
            if (r.end > sel.end) {
                next.push({ ...r, id: genId(), start: sel.end });
            }
            // pieces inside selection are dropped
        });
        state.regions = next.sort((a, b) => a.start - b.start);
        state.timeSelection = null;
        state.primaryRegionId = state.regions[0]?.id || null;
        state.activeRegionIds = state.primaryRegionId ? new Set([state.primaryRegionId]) : new Set();
        renderRegionsOnWaveform();
        renderRegionsList();
        renderRegionDetails();
        renderTargetsList();
        renderSelection();
        updateToolbarState();
    }
    function clearSelection() {
        state.timeSelection = null;
        renderSelection();
        updateToolbarState();
    }

    // Target removal
    function removeTarget(idx) {
        if (idx < 0 || idx >= state.targets.length) return;
        // Find regions that point to this target → unassign or remove?
        state.regions.forEach(r => {
            if (r.targetIndex === idx) r.targetIndex = null;
            else if (r.targetIndex != null && r.targetIndex > idx) r.targetIndex--;
        });
        state.targets.splice(idx, 1);
        if (state.targets.length === 0) state.mode = 'single';
        renderTargetsList();
        renderRegionsList();
        renderRegionDetails();
        updateToolbarState();
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Auto-Split (energy-based, no text)
    // ═════════════════════════════════════════════════════════════════════════
    function autoSplitRegions() {
        if (!state.channelData || !state.targets.length) {
            setStatus('Cannot auto-split: audio not ready or no sections.', 'error');
            return;
        }
        const intervals = detectSpeechIntervals();
        if (!intervals.length) {
            setStatus('Auto-split failed: no speech segments detected.', 'error');
            return;
        }
        const targetCount = state.targets.length;
        const merged = mergeIntervalsToCount(intervals, targetCount);
        installRegionsFromIntervals(merged);
        setStatus(`Split into ${merged.length} region${merged.length === 1 ? '' : 's'}.`, 'success');
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Auto-Align (energy + IAST syllable counts)
    //
    //  Strategy:
    //   1. VAD detects all speech intervals.
    //   2. We assume the audio plays the targets in order (good default for
    //      shloka recitation; can be unchecked if needed via UI in future).
    //   3. Each target has an estimated syllable count (from IAST / Devanagari
    //      vowel-cluster count). Ratios of syllable counts give us the *expected*
    //      duration ratios.
    //   4. We collapse / expand the detected intervals so we end up with N
    //      contiguous regions whose duration ratios best match the syllable ratios.
    //   5. Falls back to uniform split if syllable counts are missing.
    // ═════════════════════════════════════════════════════════════════════════
    function autoAlignRegions() {
        if (!state.channelData || !state.targets.length) {
            setStatus('Cannot auto-align: audio not ready or no sections.', 'error');
            return;
        }
        const intervals = detectSpeechIntervals();
        if (!intervals.length) {
            setStatus('Auto-align failed: no speech detected.', 'error');
            return;
        }
        const N = state.targets.length;

        // Total speech time spanned by detected intervals (clip to first..last)
        const speechStart = intervals[0][0];
        const speechEnd = intervals[intervals.length - 1][1];
        const totalSpan = speechEnd - speechStart;

        // Expected syllable counts; fall back to equal weights if missing
        const sylCounts = state.targets.map(t =>
            (typeof t.syllables === 'number' && t.syllables > 0) ? t.syllables : 1
        );
        const totalSyl = sylCounts.reduce((a, b) => a + b, 0);

        // Cumulative expected boundaries (in seconds, within speechStart..speechEnd)
        const cumSyl = [0];
        for (let i = 0; i < N; i++) cumSyl.push(cumSyl[i] + sylCounts[i]);
        const expectedBoundaries = cumSyl.map(c => speechStart + (c / totalSyl) * totalSpan);
        // expectedBoundaries.length = N+1 (start + N internal + end)

        // Collect candidate boundary times: midpoints of every silence gap
        // between adjacent intervals. These are natural pause locations.
        const candidates = [];
        for (let i = 0; i < intervals.length - 1; i++) {
            const gapMid = (intervals[i][1] + intervals[i + 1][0]) / 2;
            candidates.push({ time: gapMid, gap: intervals[i + 1][0] - intervals[i][1] });
        }

        // We need N-1 internal boundaries. If we have fewer candidates than
        // needed, fall back to expected boundaries directly.
        const internalCount = N - 1;
        let chosen;
        if (candidates.length >= internalCount && internalCount > 0) {
            chosen = pickBoundariesByDP(candidates, expectedBoundaries.slice(1, -1));
        } else {
            chosen = expectedBoundaries.slice(1, -1);
        }

        // Build the final intervals: from speechStart, through chosen boundaries, to speechEnd
        const bounds = [speechStart, ...chosen, speechEnd];
        const result = [];
        for (let i = 0; i < N; i++) {
            result.push([bounds[i], bounds[i + 1]]);
        }
        installRegionsFromIntervals(result);
        setStatus(`Aligned ${N} sections using syllable-count weighting.`, 'success');
    }

    /**
     *  Pick K boundaries from the candidate list whose times best match the
     *  desired times, preserving order. Score = sum of squared time deltas
     *  (boundaries close to the silence-mid times preferred). Solved via DP.
     */
    function pickBoundariesByDP(candidates, desired) {
        const C = candidates.length, K = desired.length;
        if (K === 0) return [];
        // dp[i][j] = best (score, prev) for choosing j-th desired using candidate i
        const INF = 1e18;
        const dp = Array.from({ length: K }, () => new Float64Array(C).fill(INF));
        const back = Array.from({ length: K }, () => new Int32Array(C).fill(-1));

        for (let i = 0; i < C; i++) {
            const dt = candidates[i].time - desired[0];
            dp[0][i] = dt * dt;
        }
        for (let j = 1; j < K; j++) {
            for (let i = j; i < C; i++) {
                let best = INF, bestPrev = -1;
                for (let p = j - 1; p < i; p++) {
                    const v = dp[j - 1][p];
                    if (v < best) { best = v; bestPrev = p; }
                }
                const dt = candidates[i].time - desired[j];
                dp[j][i] = best + dt * dt;
                back[j][i] = bestPrev;
            }
        }
        // Find best end
        let bestI = -1, bestScore = INF;
        for (let i = K - 1; i < C; i++) {
            if (dp[K - 1][i] < bestScore) { bestScore = dp[K - 1][i]; bestI = i; }
        }
        if (bestI < 0) return desired.slice();
        const out = new Array(K);
        let i = bestI;
        for (let j = K - 1; j >= 0; j--) {
            out[j] = candidates[i].time;
            i = back[j][i];
            if (i < 0 && j > 0) {
                // Should not happen, but degrade gracefully
                for (let k = j - 1; k >= 0; k--) out[k] = desired[k];
                break;
            }
        }
        return out;
    }

    function installRegionsFromIntervals(intervals) {
        state.regions = intervals.map((iv, i) => ({
            id: genId(),
            start: Math.max(0, iv[0]),
            end: Math.min(state.duration, iv[1]),
            label: state.targets[i]?.text || `Region ${i + 1}`,
            targetIndex: i < state.targets.length ? i : null,
        }));
        state.regions = state.regions.filter(r => r.end > r.start + 0.01);
        state.regions.sort((a, b) => a.start - b.start);
        state.primaryRegionId = state.regions[0]?.id || null;
        state.activeRegionIds = state.primaryRegionId ? new Set([state.primaryRegionId]) : new Set();
        renderRegionsOnWaveform();
        renderRegionsList();
        renderRegionDetails();
        renderTargetsList();
        updateToolbarState();
    }

    // VAD
    function detectSpeechIntervals(opts = {}) {
        const data = state.channelData;
        const sr = state.sampleRate;
        if (!data) return [];
        const win = Math.max(1, Math.round(sr * 0.030));    // 30ms
        const hop = Math.max(1, Math.round(sr * 0.010));    // 10ms hop
        const energies = [];
        for (let i = 0; i + win <= data.length; i += hop) {
            let sum = 0;
            for (let j = 0; j < win; j++) sum += data[i + j] * data[i + j];
            energies.push(Math.sqrt(sum / win));
        }
        if (!energies.length) return [];
        // Adaptive threshold = max(noiseFloor*3, percentile15 * 1.5)
        const sorted = Array.from(energies).sort((a, b) => a - b);
        const p15 = sorted[Math.floor(sorted.length * 0.15)];
        const p50 = sorted[Math.floor(sorted.length * 0.5)];
        const noise = sorted[Math.floor(sorted.length * 0.05)];
        const threshold = Math.max(noise * 3.5, p15 * 1.5, p50 * 0.20, 0.005);

        const minSpeechMs = opts.minSpeechMs || 200;
        const minGapMs    = opts.minGapMs    || 250;
        const minSpeechHops = Math.round(minSpeechMs / 10);
        const minGapHops    = Math.round(minGapMs / 10);

        const intervals = [];
        let inSpeech = false, segStart = 0, gap = 0;
        for (let i = 0; i < energies.length; i++) {
            if (energies[i] > threshold) {
                if (!inSpeech) { inSpeech = true; segStart = i; }
                gap = 0;
            } else {
                if (inSpeech) {
                    gap++;
                    if (gap >= minGapHops) {
                        const segEnd = i - gap;
                        if (segEnd - segStart >= minSpeechHops) {
                            intervals.push([segStart * 0.010, segEnd * 0.010]);
                        }
                        inSpeech = false;
                    }
                }
            }
        }
        if (inSpeech) {
            const segEnd = energies.length;
            if (segEnd - segStart >= minSpeechHops)
                intervals.push([segStart * 0.010, segEnd * 0.010]);
        }
        return intervals;
    }

    function mergeIntervalsToCount(intervals, target) {
        if (intervals.length <= target) return intervals;
        const list = intervals.slice();
        while (list.length > target) {
            let minGap = Infinity, idx = 0;
            for (let i = 0; i < list.length - 1; i++) {
                const g = list[i+1][0] - list[i][1];
                if (g < minGap) { minGap = g; idx = i; }
            }
            list[idx] = [list[idx][0], list[idx + 1][1]];
            list.splice(idx + 1, 1);
        }
        return list;
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Toolbar enabled/disabled state
    // ═════════════════════════════════════════════════════════════════════════
    function updateToolbarState() {
        const hasSelection = !!state.timeSelection;
        const hasPrimary = !!getPrimaryRegion();
        dom.btnPlayRegion.disabled = !hasPrimary;
        dom.btnPlaySelection.disabled = !hasSelection;
        dom.btnRegionFromSelection.disabled = !hasSelection;
        dom.btnInvertSelection.disabled = !hasSelection;
        dom.btnCutSelection.disabled = !hasSelection;
        dom.btnClearSelection.disabled = !hasSelection;
        dom.btnSetStart.disabled = !hasPrimary;
        dom.btnSetEnd.disabled = !hasPrimary;
        dom.btnJumpRegionStart.disabled = !hasPrimary;
        dom.btnJumpRegionEnd.disabled = !hasPrimary;
        dom.btnAutoAlign.disabled = state.targets.length < 1;
        dom.btnAutoSplit.disabled = state.targets.length < 1;
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Section picker (Add Section…)
    // ═════════════════════════════════════════════════════════════════════════
    function openSectionPicker() {
        // Ask the editor for the list of sections
        postAction('audio_editor_request_sections', {});
        // Editor will POST back via /api/audio/editor/state with `availableSections`
        // We poll a few times for the data to land.
        let tries = 0;
        const tick = async () => {
            tries++;
            try {
                const r = await fetch('/api/audio/editor/sections');
                const data = await r.json();
                if (Array.isArray(data?.sections)) {
                    showSectionPicker(data.sections);
                    return;
                }
            } catch(_) {}
            if (tries < 15) setTimeout(tick, 200);
            else setStatus('Could not load sections list.', 'error');
        };
        setTimeout(tick, 150);
    }
    function showSectionPicker(sections) {
        dom.sectionPickerOverlay.hidden = false;
        dom.sectionPickerList.innerHTML = '';
        const existingLines = new Set(state.targets.map(t => t.lineIndex));
        sections.forEach((s, i) => {
            if (existingLines.has(s.lineIndex)) return;
            const item = document.createElement('label');
            item.className = 'ae-sec-item';
            item.innerHTML = `
                <input type="checkbox" data-line="${s.lineIndex}" data-text="" data-level="${s.level || 'line'}" data-syl="${s.syllables || ''}">
                <span class="ae-sec-pill ae-sec-pill-${s.level || 'line'}">${labelForLevel(s.level)}</span>
                <span class="ae-sec-text"></span>`;
            item.querySelector('.ae-sec-text').textContent = s.text || `Line ${s.lineIndex}`;
            item.querySelector('input').dataset.text = s.text || '';
            dom.sectionPickerList.appendChild(item);
        });
    }
    function applySectionPicker() {
        const checks = dom.sectionPickerList.querySelectorAll('input[type="checkbox"]:checked');
        checks.forEach(cb => {
            const sylText = cb.dataset.syl;
            const t = {
                lineIndex: parseInt(cb.dataset.line, 10),
                text: cb.dataset.text,
                level: cb.dataset.level,
                syllables: sylText ? parseInt(sylText, 10) : null,
            };
            state.targets.push(t);
        });
        state.mode = state.targets.length > 1 ? 'multi' : 'single';
        if (state.mode === 'multi') {
            dom.multiNote.hidden = false;
            dom.multiNote.innerHTML = `<strong>Multi-section mode.</strong> ${state.targets.length} sections targeted.`;
        }
        dom.sectionPickerOverlay.hidden = true;
        renderTargetsList();
        renderRegionsList();
        renderRegionDetails();
        updateToolbarState();
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Zoom
    // ═════════════════════════════════════════════════════════════════════════
    function zoomIn()  { state.zoom = clamp(state.zoom * 1.5, 1, 50); layout(); dom.zoomLevel.textContent = state.zoom.toFixed(1) + '×'; }
    function zoomOut() { state.zoom = clamp(state.zoom / 1.5, 1, 50); layout(); dom.zoomLevel.textContent = state.zoom.toFixed(1) + '×'; }
    function zoomFit() { state.zoom = 1.0; layout(); dom.zoomLevel.textContent = '1.0×'; }

    // ═════════════════════════════════════════════════════════════════════════
    //  Apply / Cancel / Delete All
    // ═════════════════════════════════════════════════════════════════════════
    async function applyChanges() {
        for (const r of state.regions) {
            if (r.start >= r.end) {
                setStatus(`Region "${r.label}" has invalid time range.`, 'error');
                return;
            }
            if (r.end > state.duration + 0.05) {
                setStatus(`Region "${r.label}" extends past audio length.`, 'error');
                return;
            }
        }
        const payload = {
            audioId: state.audio.id,
            // include the audio metadata so the editor can register it in its library
            audio: state.audio,
            // include all targets so editor knows which lines to clean up
            targets: state.targets.map(t => ({
                lineIndex: t.lineIndex,
                text: t.text,
                level: t.level,
            })),
            regions: state.regions.map(r => ({
                start: r.start,
                end: r.end,
                label: r.label,
                targetIndex: r.targetIndex,
                targetLineIndex: r.targetIndex != null && state.targets[r.targetIndex]
                    ? state.targets[r.targetIndex].lineIndex : null,
            })),
        };
        await postAction('audio_editor_apply', payload);
        setStatus('Saved.', 'success');
        await closeDialog();
    }

    async function deleteAll() {
        await postAction('audio_editor_delete', {
            audioId: state.audio?.id,
            targets: state.targets.map(t => ({ lineIndex: t.lineIndex })),
        });
        setStatus('Deleted.', 'success');
        await closeDialog();
    }

    async function cancelChanges() {
        await closeDialog();
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  Init
    // ═════════════════════════════════════════════════════════════════════════
    document.addEventListener('DOMContentLoaded', () => {
        cacheDom();
        loadState();
        attachWaveInteractions();

        // Transport
        dom.btnPlay.addEventListener('click', play);
        dom.btnPause.addEventListener('click', pause);
        dom.btnStop.addEventListener('click', stop);
        dom.btnPlayRegion.addEventListener('click', playRegion);
        dom.btnPlaySelection.addEventListener('click', playSelection);

        // Cursor jumps
        dom.btnJumpStart.addEventListener('click', jumpToStart);
        dom.btnJumpEnd.addEventListener('click', jumpToEnd);
        dom.btnJumpRegionStart.addEventListener('click', jumpToRegionStart);
        dom.btnJumpRegionEnd.addEventListener('click', jumpToRegionEnd);

        // Zoom
        dom.btnZoomIn.addEventListener('click', zoomIn);
        dom.btnZoomOut.addEventListener('click', zoomOut);
        dom.btnZoomFit.addEventListener('click', zoomFit);

        // Region
        dom.btnAddRegion.addEventListener('click', addRegion);
        dom.btnSetStart.addEventListener('click', setActiveRegionStart);
        dom.btnSetEnd.addEventListener('click', setActiveRegionEnd);

        // Selection
        dom.btnRegionFromSelection.addEventListener('click', regionFromSelection);
        dom.btnInvertSelection.addEventListener('click', invertSelectionToRegions);
        dom.btnCutSelection.addEventListener('click', cutSelectionFromRegions);
        dom.btnClearSelection.addEventListener('click', clearSelection);

        // Auto
        dom.btnAutoAlign.addEventListener('click', autoAlignRegions);
        dom.btnAutoSplit.addEventListener('click', autoSplitRegions);
        dom.btnAddSection.addEventListener('click', openSectionPicker);

        // Footer
        dom.applyBtn.addEventListener('click', applyChanges);
        dom.cancelBtn.addEventListener('click', cancelChanges);
        dom.deleteAllBtn.addEventListener('click', deleteAll);

        // Section picker
        dom.sectionPickerCancel.addEventListener('click', () => {
            dom.sectionPickerOverlay.hidden = true;
        });
        dom.sectionPickerAdd.addEventListener('click', applySectionPicker);

        // Keyboard
        document.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
            if (e.key === ' ') { e.preventDefault(); state.playing ? pause() : play(); }
            else if (e.key === '+' || e.key === '=') zoomIn();
            else if (e.key === '-') zoomOut();
            else if (e.key === '0') zoomFit();
            else if (e.key === 'Home') jumpToStart();
            else if (e.key === 'End') jumpToEnd();
            else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (state.activeRegionIds.size) { e.preventDefault(); removeSelectedRegions(); }
            }
            else if (e.key === 'Escape') {
                clearSelection();
                state.activeRegionIds.clear();
                state.primaryRegionId = null;
                renderRegionsOnWaveform();
                renderRegionsList();
                renderRegionDetails();
                updateToolbarState();
            }
        });

        window.addEventListener('resize', layout);
    });
})();
