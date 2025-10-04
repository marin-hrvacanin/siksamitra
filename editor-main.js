/**
 * Main Editor Controller for śikṣāmitra
 * 
 * Orchestrates all editor functionality including Quill initialization,
 * toolbar management, and integration with all modules
 */

class SiksamitraEditor {
    constructor() {
        this.quill = null;
        this.fileOperations = null;
        this.currentStyle = 'normal';
        this.isInitialized = false;
        this.currentFileName = 'śikṣāmitra Document';
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    /**
     * Initialize the editor
     */
    async init() {
        try {
            this.setupRibbonTabs();
            this.setupEditor();
            this.setupButtons();
            this.setupKeyboardShortcuts();
            this.initializeModules();
            this.isInitialized = true;
            
            console.log('śikṣāmitra Editor initialized successfully');
        } catch (error) {
            console.error('Error initializing editor:', error);
        }
    }

    /**
     * Setup contenteditable editor (like main2.pyw)
     */
    setupEditor() {
        this.editor = document.getElementById('editor');
        if (!this.editor) {
            throw new Error('Editor container not found');
        }

        this.editor.setAttribute('contenteditable', 'true');
        this.editor.focus();
        
        // Set up editor event handlers
        this.setupEditorEvents();
    }

    /**
     * Setup ribbon tab switching
     */
    setupRibbonTabs() {
        const tabHeaders = document.querySelectorAll('.tab-header');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const tabName = header.getAttribute('data-tab');
                
                // Update active tab header
                tabHeaders.forEach(h => h.classList.remove('active'));
                header.classList.add('active');
                
                // Update active tab content
                tabContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.id === `${tabName}-tab`) {
                        content.classList.add('active');
                    }
                });
            });
        });
    }

    /**
     * Setup editor event handlers
     */
    setupEditorEvents() {
        // Track content changes
        this.editor.addEventListener('input', () => {
            this.updateWordCount();
        });

        // Track selection changes
        document.addEventListener('selectionchange', () => {
            this.updateToolbarState();
        });

        // Focus handling
        this.editor.addEventListener('focus', () => {
            this.updateToolbarState();
        });
    }

    /**
     * Setup all ribbon buttons
     */
    setupButtons() {
        // File operations
        this.setupFileButtons();
        
        // Holdings buttons
        this.setupHoldingButtons();
        
        // Style controls
        this.setupStyleControls();
        
        // Svara buttons
        this.setupSvaraButtons();
        
        // Title input
        this.setupTitleInput();
    }

    /**
     * Setup file operation buttons
     */
    setupFileButtons() {
        const saveBtn = document.getElementById('saveBtn');
        const saveAsBtn = document.getElementById('saveAsBtn');
        const exportBtn = document.getElementById('exportBtn');
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveDocument());
        }
        
        if (saveAsBtn) {
            saveAsBtn.addEventListener('click', () => this.saveAsDocument());
        }
        
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportDocument());
        }
    }

    /**
     * Setup style buttons (normal/change)
     */
    setupStyleButtons() {
        const normalBtn = document.getElementById('normal');
        const changeBtn = document.getElementById('change');

        if (normalBtn) {
            normalBtn.addEventListener('click', () => {
                window.EditorBlots.setNormalStyle(this.quill);
                this.currentStyle = 'normal';
                this.updateStyleButtons();
                this.updateCurrentStyleDisplay();
            });
        }

        if (changeBtn) {
            changeBtn.addEventListener('click', () => {
                window.EditorBlots.toggleChangeStyle(this.quill);
                this.updateStyleButtons();
                this.updateCurrentStyleDisplay();
            });
        }
    }

    /**
     * Setup holding buttons
     */
    setupHoldingButtons() {
        const shortBtn = document.getElementById('shortHoldingButton');
        const longBtn = document.getElementById('longHoldingButton');
        const cleanBtn = document.getElementById('cleanHoldingsButton');

        if (shortBtn) {
            shortBtn.addEventListener('click', () => {
                this.toggleHolding('short');
            });
        }

        if (longBtn) {
            longBtn.addEventListener('click', () => {
                this.toggleHolding('long');
            });
        }
        
        if (cleanBtn) {
            cleanBtn.addEventListener('click', () => {
                this.cleanHoldings();
            });
        }
    }

    /**
     * Setup style controls
     */
    setupStyleControls() {
        const styleCombo = document.getElementById('styleCombo');
        
        if (styleCombo) {
            styleCombo.addEventListener('change', (e) => {
                const style = e.target.value;
                if (style !== 'mixed') {
                    this.setStyle(style);
                }
            });
        }
    }
    
    /**
     * Setup svara accent buttons
     */
    setupSvaraButtons() {
        const svaritaBtn = document.getElementById('svaritaButton');
        const anudattaBtn = document.getElementById('anudattaButton');
        const udattaBtn = document.getElementById('udattaButton');
        const tickBtn = document.getElementById('tickButton');
        
        if (svaritaBtn) {
            svaritaBtn.addEventListener('click', () => this.applySvara('svarita'));
        }
        if (anudattaBtn) {
            anudattaBtn.addEventListener('click', () => this.applySvara('anudatta'));
        }
        if (udattaBtn) {
            udattaBtn.addEventListener('click', () => this.applySvara('udatta'));
        }
        if (tickBtn) {
            tickBtn.addEventListener('click', () => this.applySvara('tick'));
        }
    }
    
    /**
     * Setup title input
     */
    setupTitleInput() {
        const titleEdit = document.getElementById('titleEdit');
        
        if (titleEdit) {
            titleEdit.value = this.currentFileName;
            titleEdit.addEventListener('input', (e) => {
                this.currentFileName = e.target.value || 'Untitled document';
                document.title = `śikṣāmitra - ${this.currentFileName}`;
            });
        }
    }

    /**
     * Toggle holding format
     */
    toggleHolding(type) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        if (range.collapsed) return;
        
        const selectedText = range.toString();
        if (!selectedText) return;
        
        // Create holding span
        const span = document.createElement('span');
        span.className = type === 'short' ? 'short-holding' : 'long-holding';
        span.textContent = selectedText;
        
        // Replace selection with holding span
        range.deleteContents();
        range.insertNode(span);
        
        // Clear selection
        selection.removeAllRanges();
    }
    
    /**
     * Clean holdings from selection
     */
    cleanHoldings() {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        
        // Find and unwrap holding spans
        const holdingSpans = this.editor.querySelectorAll('.short-holding, .long-holding');
        holdingSpans.forEach(span => {
            if (range.intersectsNode(span)) {
                const parent = span.parentNode;
                while (span.firstChild) {
                    parent.insertBefore(span.firstChild, span);
                }
                parent.removeChild(span);
            }
        });
    }
    
    /**
     * Set text style
     */
    setStyle(style) {
        this.currentStyle = style;
        
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        if (range.collapsed) return;
        
        const selectedText = range.toString();
        if (!selectedText) return;
        
        if (style === 'change') {
            const changeElement = document.createElement('change');
            changeElement.textContent = selectedText;
            range.deleteContents();
            range.insertNode(changeElement);
        }
        
        selection.removeAllRanges();
    }
    
    /**
     * Apply svara accent
     */
    applySvara(type) {
        // For now, just insert the accent character
        const accents = {
            'svarita': '́',
            'anudatta': '̱',
            'udatta': '̎',
            'tick': 'ˎ'
        };
        
        const accent = accents[type];
        if (accent) {
            document.execCommand('insertText', false, accent);
        }
    }
    
    /**
     * Save document
     */
    saveDocument() {
        const content = this.getDocumentHTML();
        const blob = new Blob([content], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.currentFileName}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }
    
    /**
     * Save as document
     */
    saveAsDocument() {
        this.saveDocument(); // Same as save for now
    }
    
    /**
     * Export document
     */
    exportDocument() {
        this.saveDocument(); // Same as save for now
    }
    
    /**
     * Get document HTML
     */
    getDocumentHTML() {
        const content = this.editor.innerHTML;
        const currentTheme = document.body.getAttribute('data-theme') || 'light';
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.currentFileName}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            font-size: 32px;
            line-height: 1.5;
            max-width: 1000px;
            margin: 3rem auto;
            padding: 3rem;
            background: ${currentTheme === 'dark' ? '#2d2d2d' : '#ffffff'};
            color: ${currentTheme === 'dark' ? '#e0e0e0' : '#2c3e50'};
        }
        
        .short-holding {
            border: 1px solid #538135;
            border-radius: 3px;
            padding: 0;
            display: inline;
            box-decoration-break: clone;
            -webkit-box-decoration-break: clone;
        }
        
        .long-holding {
            border: 2px solid #538135;
            border-radius: 3px;
            padding: 0;
            display: inline;
            box-decoration-break: clone;
            -webkit-box-decoration-break: clone;
        }
        
        change, .style-change {
            font-style: italic;
            color: #1d4ed8;
            white-space: pre;
        }
        
        @media print {
            body {
                background: white !important;
                color: black !important;
            }
        }
    </style>
</head>
<body>
    ${content}
</body>
</html>`;
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 's':
                        e.preventDefault();
                        if (e.shiftKey) {
                            this.saveAsDocument();
                        } else {
                            this.saveDocument();
                        }
                        break;
                    case 'S':
                        if (e.shiftKey) {
                            e.preventDefault();
                            this.toggleHolding('short');
                        }
                        break;
                    case 'L':
                        if (e.shiftKey) {
                            e.preventDefault();
                            this.toggleHolding('long');
                        }
                        break;
                }
            }
        });
    }

    /**
     * Initialize additional modules
     */
    initializeModules() {
        // Initialize word count
        this.updateWordCount();
        
        // Set up periodic updates
        setInterval(() => {
            this.updateWordCount();
        }, 1000);
    }

    /**
     * Update toolbar button states (placeholder)
     */
    updateToolbarState() {
        // This would update button states based on current selection
        // For now, just a placeholder
    }

    /**
     * Update word count display
     */
    updateWordCount() {
        const text = this.editor.textContent || '';
        const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
        const chars = text.length;
        
        // Update status if elements exist (they don't in current ribbon design)
        const wordCountElement = document.getElementById('wordCount');
        const charCountElement = document.getElementById('charCount');
        
        if (wordCountElement) {
            wordCountElement.textContent = `Words: ${words}`;
        }
        if (charCountElement) {
            charCountElement.textContent = `Characters: ${chars}`;
        }
    }

    /**
     * Get editor content as HTML
     * @returns {string} HTML content
     */
    getHTML() {
        return this.editor.innerHTML;
    }

    /**
     * Set editor content
     * @param {string} html - HTML content to set
     */
    setHTML(html) {
        this.editor.innerHTML = html;
    }

    /**
     * Focus the editor
     */
    focus() {
        this.editor.focus();
    }

    /**
     * Get current editor statistics
     * @returns {Object} Editor statistics
     */
    getStats() {
        const text = this.editor.textContent || '';
        return {
            characters: text.length,
            words: text.trim().split(/\s+/).filter(word => word.length > 0).length,
            paragraphs: text.split('\n').filter(p => p.trim().length > 0).length,
            currentStyle: this.currentStyle,
            hasSelection: !!window.getSelection().toString()
        };
    }
}

// Initialize the editor
window.siksamitraEditor = new SiksamitraEditor();

// Export for external access
window.SiksamitraEditor = SiksamitraEditor;
