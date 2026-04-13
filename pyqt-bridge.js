/**
 * PyQt Bridge - Compatibility layer for PyQt6 QWebChannel
 * 
 * This script creates a compatibility layer that mimics the pywebview API
 * but uses PyQt6's QWebChannel underneath. This allows the existing code
 * to work with both pywebview and PyQt6.
 */

(function() {
    'use strict';

    // Only initialize if QWebChannel is available (PyQt6 environment)
    if (typeof QWebChannel === 'undefined') {
        console.log('PyQt Bridge: QWebChannel not available, skipping initialization');
        return;
    }

    let bridge = null;
    let ready = false;
    const pendingCalls = [];

    // Create the pywebview-compatible API object
    window.pywebview = {
        api: {
            // File dialogs
            open_file_dialog: function() {
                return new Promise((resolve) => {
                    const invoke = () => {
                        try {
                            // QWebChannel methods with return values are callback-based.
                            bridge.openFileDialog((result) => resolve(result || ''));
                        } catch (e) {
                            console.error('open_file_dialog error:', e);
                            resolve('');
                        }
                    };

                    if (bridge) invoke();
                    else pendingCalls.push(invoke);
                });
            },

            save_file_dialog: function(filename) {
                return new Promise((resolve) => {
                    const invoke = () => {
                        try {
                            bridge.saveFileDialog(filename || 'document.html', (result) => resolve(result || ''));
                        } catch (e) {
                            console.error('save_file_dialog error:', e);
                            resolve('');
                        }
                    };

                    if (bridge) invoke();
                    else pendingCalls.push(invoke);
                });
            },

            // Preferences (use HTTP API instead of direct bridge)
            get_preferences: async function() {
                try {
                    const resp = await fetch('/api/preferences');
                    return await resp.json();
                } catch (e) {
                    console.error('get_preferences error:', e);
                    return {};
                }
            },

            get_preference: async function(key) {
                try {
                    const resp = await fetch(`/api/preferences/${key}`);
                    const data = await resp.json();
                    return data.value;
                } catch (e) {
                    console.error('get_preference error:', e);
                    return null;
                }
            },

            set_preference: async function(key, value) {
                try {
                    await fetch(`/api/preferences/${key}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ value })
                    });
                    return true;
                } catch (e) {
                    console.error('set_preference error:', e);
                    return false;
                }
            },

            // File operations (use HTTP API)
            read_file: async function(filepath) {
                try {
                    const resp = await fetch('/api/file/read', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: filepath })
                    });
                    const data = await resp.json();
                    if (data.error) return `Error: ${data.error}`;
                    return data.content;
                } catch (e) {
                    return `Error: ${e.message}`;
                }
            },

            write_file: async function(filepath, content) {
                try {
                    const resp = await fetch('/api/file/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: filepath, content })
                    });
                    const data = await resp.json();
                    if (data.error) return `Error: ${data.error}`;
                    return 'Success';
                } catch (e) {
                    return `Error: ${e.message}`;
                }
            },

            // Window title
            set_window_title: function(title) {
                return new Promise((resolve) => {
                    if (bridge) {
                        bridge.setWindowTitle(title);
                        resolve(true);
                    } else {
                        pendingCalls.push(() => {
                            bridge.setWindowTitle(title);
                            resolve(true);
                        });
                    }
                });
            },

            // Viewer window
            open_viewer_from_file: function(filepath, title) {
                return new Promise((resolve) => {
                    if (bridge) {
                        bridge.openViewerWindow(filepath, title || '');
                        resolve({ status: 'opened' });
                    } else {
                        pendingCalls.push(() => {
                            bridge.openViewerWindow(filepath, title || '');
                            resolve({ status: 'opened' });
                        });
                    }
                });
            },

            // Import dialog
            import_file_dialog: function() {
                return new Promise((resolve) => {
                    const invoke = () => {
                        try {
                            bridge.importFileDialog((result) => resolve(result || ''));
                        } catch (e) {
                            console.error('import_file_dialog error:', e);
                            resolve('');
                        }
                    };

                    if (bridge) invoke();
                    else pendingCalls.push(invoke);
                });
            },

            // Open in explorer
            open_in_explorer: function(filepath) {
                return new Promise((resolve) => {
                    if (bridge) {
                        bridge.openInExplorer(filepath);
                        resolve(true);
                    } else {
                        pendingCalls.push(() => {
                            bridge.openInExplorer(filepath);
                            resolve(true);
                        });
                    }
                });
            },

            // Recent files
            remove_recent: async function(filepath) {
                // This is handled by the HTTP API now
                return true;
            },

            // Confirm close (called from JS to tell Python it's OK to close)
            _confirm_close: function(can_close) {
                if (bridge) {
                    bridge.confirmClose(!!can_close);
                }
            },

            // Toggle the floating on-screen Sanskrit keyboard window
            toggle_keyboard: function() {
                return new Promise(function(resolve) {
                    var call = function() { bridge.toggleKeyboard(); resolve(true); };
                    if (bridge) { call(); } else { pendingCalls.push(call); }
                });
            }
        }
    };

    // Initialize QWebChannel only if qt.webChannelTransport exists (PyQt6 environment)
    if (typeof qt !== 'undefined' && qt.webChannelTransport) {
        new QWebChannel(qt.webChannelTransport, function(channel) {
            bridge = channel.objects.pyqt;
            ready = true;

            console.log('PyQt Bridge: Connected to QWebChannel');

            // Execute pending calls
            while (pendingCalls.length > 0) {
                const call = pendingCalls.shift();
                try {
                    call();
                } catch (e) {
                    console.error('PyQt Bridge: Error executing pending call:', e);
                }
            }

            // Dispatch the pywebviewready event for compatibility
            window.dispatchEvent(new Event('pywebviewready'));
        });

        console.log('PyQt Bridge: Initializing...');
    } else {
        // Not running in PyQt6 - dispatch ready event anyway so app doesn't hang
        console.log('PyQt Bridge: Not in PyQt6 environment, using HTTP API only');
        ready = true;
        setTimeout(() => {
            window.dispatchEvent(new Event('pywebviewready'));
        }, 100);
    }
})();
