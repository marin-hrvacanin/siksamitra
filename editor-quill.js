/**
 * Main Editor Controller for śikṣāmitra (with Quill integration)
 * 
 * Orchestrates all editor functionality using Quill with custom blots
 */

class SiksamitraEditor {
    constructor() {
        this.quill = null;
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
            await this.initializeQuill();
            this.setupButtons();
            this.setupKeyboardShortcuts();
            this.setupStatusBar();
            this.isInitialized = true;
            
            console.log('śikṣāmitra Editor initialized successfully');
        } catch (error) {
            console.error('Error initializing editor:', error);
        }
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
     * Initialize Quill editor with custom blots (updated for Quill 2.0)
     */
    async initializeQuill() {
        // Register holding attributor (makes short/long mutually exclusive)
        const Parchment = Quill.import('parchment');
        
        // Quill 2.0 uses ClassAttributor constructor directly
        class HoldingAttributor extends Parchment.ClassAttributor {
            add(node, value) {
                // Only allow 'short' or 'long' values
                if (value === 'short' || value === 'long') {
                    return super.add(node, value);
                }
                return false;
            }
        }
        
        const HoldingClass = new HoldingAttributor('holding', 'ql-holding', {
            scope: Parchment.Scope.INLINE
        });
        Quill.register(HoldingClass, true);

        // Register custom blot for change style
        const Inline = Quill.import('blots/inline');

        class ChangeStyle extends Inline {
            static blotName = 'change-style';
            static tagName = 'span';

            static create(value) {
                let node = super.create(value);
                node.classList.add('ql-change-style');
                return node;
            }

            static formats(node) {
                return node.classList.contains('ql-change-style');
            }
        }

        Quill.register(ChangeStyle);

        // Register custom blot for svara characters
        class SvaraChar extends Inline {
            static blotName = 'svara-char';
            static tagName = 'span';

            static create(value) {
                let node = super.create(value);
                node.classList.add('ql-svara-char');
                return node;
            }

            static formats(node) {
                return node.classList.contains('ql-svara-char');
            }
        }

        Quill.register(SvaraChar);

        // Initialize Quill editor
        this.quill = new Quill('#editor', {
            theme: 'snow',
            modules: {
                toolbar: false // We use custom ribbon
            },
            placeholder: 'Start typing your Sanskrit text...'
        });

        // Update button states on selection change (exact logic from example.html)
        this.quill.on('selection-change', () => {
            this.updateButtonStates();
        });

        // Also update on text changes
        this.quill.on('text-change', () => {
            this.updateButtonStates();
        });
    }

    /**
     * Update button active states (exact logic from example.html)
     */
    updateButtonStates() {
        const range = this.quill.getSelection();
        let format = {};
        
        if (range) {
            // Get format for selected text
            format = this.quill.getFormat(range.index, range.length);
        } else {
            // Get format for cursor position (what would be applied to new text)
            format = this.quill.getFormat();
        }
            
        // Update text formatting buttons
        const boldBtn = document.getElementById('boldButton');
        const italicBtn = document.getElementById('italicButton');
        const underlineBtn = document.getElementById('underlineButton');
        
        if (boldBtn) boldBtn.classList.toggle('active', !!format.bold);
        if (italicBtn) italicBtn.classList.toggle('active', !!format.italic);
        if (underlineBtn) underlineBtn.classList.toggle('active', !!format.underline);
        
        // Update holding buttons (using single 'holding' attribute)
        const shortBtn = document.getElementById('shortHoldingButton');
        const longBtn = document.getElementById('longHoldingButton');
        
        if (shortBtn) shortBtn.classList.toggle('active', format.holding === 'short');
        if (longBtn) longBtn.classList.toggle('active', format.holding === 'long');
        
        // Update style dropdown
        const styleCombo = document.getElementById('styleCombo');
        if (styleCombo) {
            const isChange = !!format['change-style'];
            const isSvara = !!format['svara-char'];
            if (isSvara) {
                styleCombo.value = 'svara';
            } else if (isChange) {
                styleCombo.value = 'change';
            } else {
                styleCombo.value = 'normal';
            }
            this.updateDropdownAppearance(styleCombo);
        }
    }

    /**
     * Clear all active button states
     */
    clearActiveStates() {
        const buttons = ['shortHoldingButton', 'longHoldingButton'];
        buttons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.classList.remove('active');
            }
        });
        
        const styleCombo = document.getElementById('styleCombo');
        if (styleCombo) {
            styleCombo.value = 'normal';
            this.updateDropdownAppearance(styleCombo);
        }
    }

    /**
     * Update dropdown visual appearance based on current value
     */
    updateDropdownAppearance(dropdown) {
        // Remove all style classes
        dropdown.classList.remove('style-normal', 'style-change', 'style-mixed');
        
        // Add appropriate class based on current value
        const currentValue = dropdown.value;
        dropdown.classList.add(`style-${currentValue}`);
    }

    /**
     * Setup all ribbon buttons
     */
    setupButtons() {
        this.setupFileButtons();
        this.setupTextFormattingButtons();
        this.setupHoldingButtons();
        this.setupStyleControls();
        this.setupSvaraButtons();
        this.setupIASTButtons();
        this.setupTitleInput();
    }

    /**
     * Setup text formatting buttons (bold, italic, underline)
     */
    setupTextFormattingButtons() {
        const boldBtn = document.getElementById('boldButton');
        const italicBtn = document.getElementById('italicButton');
        const underlineBtn = document.getElementById('underlineButton');

        if (boldBtn) {
            boldBtn.addEventListener('click', () => {
                const format = this.quill.getFormat();
                this.quill.format('bold', !format.bold);
                this.updateButtonStates();
            });
        }

        if (italicBtn) {
            italicBtn.addEventListener('click', () => {
                const format = this.quill.getFormat();
                this.quill.format('italic', !format.italic);
                this.updateButtonStates();
            });
        }

        if (underlineBtn) {
            underlineBtn.addEventListener('click', () => {
                const format = this.quill.getFormat();
                this.quill.format('underline', !format.underline);
                this.updateButtonStates();
            });
        }
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
     * Setup holding buttons (exact logic from example.html - mutually exclusive)
     */
    setupHoldingButtons() {
        const shortBtn = document.getElementById('shortHoldingButton');
        const longBtn = document.getElementById('longHoldingButton');
        const cleanBtn = document.getElementById('cleanHoldingsButton');

        if (shortBtn) {
            shortBtn.addEventListener('click', () => {
                const format = this.quill.getFormat();
                const currentHolding = format.holding;
                if (currentHolding === 'short') {
                    this.quill.format('holding', false);
                } else {
                    this.quill.format('holding', 'short');
                }
                this.updateButtonStates();
            });
        }

        if (longBtn) {
            longBtn.addEventListener('click', () => {
                const format = this.quill.getFormat();
                const currentHolding = format.holding;
                if (currentHolding === 'long') {
                    this.quill.format('holding', false);
                } else {
                    this.quill.format('holding', 'long');
                }
                this.updateButtonStates();
            });
        }
        
        if (cleanBtn) {
            cleanBtn.addEventListener('click', () => {
                this.quill.format('holding', false);
                this.updateButtonStates();
            });
        }
    }

    /**
     * Setup style controls (exact logic from example.html)
     */
    setupStyleControls() {
        const styleCombo = document.getElementById('styleCombo');
        
        if (styleCombo) {
            styleCombo.addEventListener('change', (e) => {
                const selectedStyle = e.target.value;
                
                if (selectedStyle === 'normal') {
                    this.quill.format('change-style', false);
                    this.quill.format('svara-char', false);
                } else if (selectedStyle === 'change') {
                    this.quill.format('change-style', true);
                    this.quill.format('svara-char', false);
                } else if (selectedStyle === 'svara') {
                    // Just apply svara format to selection or cursor position
                    this.quill.format('change-style', false);
                    this.quill.format('svara-char', true);
                }
                
                this.updateButtonStates();
                this.quill.focus();
            });
            
            // Initialize the dropdown appearance
            this.updateDropdownAppearance(styleCombo);
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
     * Setup IAST character buttons and dropdown
     */
    setupIASTButtons() {
        // Setup dropdown toggle
        const iastMenuBtn = document.getElementById('iastMenuBtn');
        const iastMenu = document.getElementById('iastMenu');
        
        if (iastMenuBtn && iastMenu) {
            iastMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                iastMenu.classList.toggle('show');
            });
            
            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!iastMenu.contains(e.target) && e.target !== iastMenuBtn) {
                    iastMenu.classList.remove('show');
                }
            });
        }
        
        // Setup character buttons
        const iastButtons = document.querySelectorAll('.iast-char-btn');
        
        iastButtons.forEach(button => {
            button.addEventListener('click', () => {
                const char = button.getAttribute('data-char');
                if (char) {
                    this.insertIASTCharacter(char);
                    if (iastMenu) iastMenu.classList.remove('show');
                }
            });
        });
        
        // Setup F9 keyboard shortcuts
        this.setupIASTShortcuts();
    }
    
    /**
     * Setup F9 + key shortcuts for IAST characters
     */
    setupIASTShortcuts() {
        let f9Pressed = false;
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F9') {
                e.preventDefault();
                f9Pressed = true;
                return;
            }
            
            if (f9Pressed) {
                e.preventDefault();
                const key = e.key;
                let char = null;
                
                // Map F9 + key to IAST characters
                const shortcuts = {
                    'a': 'ā', 'i': 'ī', 'u': 'ū', 'r': 'ṛ', 'R': 'ṝ',
                    'l': 'ḷ', 'L': 'ḹ', 'm': 'ṁ', 'h': 'ḥ',
                    't': 'ṭ', 'T': 'ṭh', 'd': 'ḍ', 'D': 'ḍh', 'n': 'ṇ',
                    's': 'ś', 'S': 'ṣ', 'G': 'ñ', 'J': 'ñ', 'N' : 'ṅ'
                };
                
                char = shortcuts[key];
                
                if (char) {
                    this.insertIASTCharacter(char);
                }
                
                f9Pressed = false;
            }
        });
        
        document.addEventListener('keyup', (e) => {
            if (e.key === 'F9') {
                f9Pressed = false;
            }
        });
    }
    
    /**
     * Insert an IAST character at cursor position
     */
    insertIASTCharacter(char) {
        const range = this.quill.getSelection(true);
        if (!range) return;
        
        // Insert the character at cursor position
        this.quill.insertText(range.index, char);
        
        // Move cursor after the inserted character
        this.quill.setSelection(range.index + char.length);
        
        // Focus the editor
        this.quill.focus();
    }
    
    /**
     * Setup title input
     */
    setupTitleInput() {
        // Setup title input in File tab
        const titleEdit = document.getElementById('titleEdit');
        if (titleEdit) {
            titleEdit.value = this.currentFileName;
            titleEdit.addEventListener('input', (e) => {
                this.currentFileName = e.target.value || 'Untitled document';
                document.title = `śikṣāmitra - ${this.currentFileName}`;
                
                // Sync with header title input
                const titleEditHeader = document.getElementById('titleEditHeader');
                if (titleEditHeader) {
                    titleEditHeader.value = this.currentFileName;
                }
            });
        }
        
        // Setup title input in header (main MS Word-style input)
        const titleEditHeader = document.getElementById('titleEditHeader');
        if (titleEditHeader) {
            titleEditHeader.value = this.currentFileName;
            titleEditHeader.addEventListener('input', (e) => {
                this.currentFileName = e.target.value || 'Untitled document';
                document.title = `śikṣāmitra - ${this.currentFileName}`;
                
                // Sync with File tab title input
                if (titleEdit) {
                    titleEdit.value = this.currentFileName;
                }
            });
        }
    }

    /**
     * Apply svara accent with special styling (DOM manipulation for isolation)
     */
    applySvara(type) {
        const accents = {
            'svarita': '\u030d',
            'anudatta': '\u0331',
            'udatta': '\u030e',
            'tick': '\u02ce'
        };

        const accent = accents[type];
        if (!accent) return;

        // Get current selection
        const range = this.quill.getSelection(true);
        if (!range) return;

        // Insert the svara character as plain text (no special formatting)
        this.quill.insertText(range.index, accent);

        // Move cursor after the inserted character
        this.quill.setSelection(range.index + accent.length);

        // Focus the editor
        this.quill.focus();
    }
    
    /**
     * Save document (downloads with current title)
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
     * Save as document (prompts for new filename and updates title)
     */
    saveAsDocument() {
        // Prompt for new filename
        const newFileName = prompt('Save as:', this.currentFileName);
        
        // If user cancelled or entered empty name, abort
        if (!newFileName || newFileName.trim() === '') {
            return;
        }
        
        // Update current filename and document title
        this.currentFileName = newFileName.trim();
        document.title = `śikṣāmitra - ${this.currentFileName}`;
        
        // Update both title input fields
        const titleEdit = document.getElementById('titleEdit');
        if (titleEdit) {
            titleEdit.value = this.currentFileName;
        }
        
        const titleEditHeader = document.getElementById('titleEditHeader');
        if (titleEditHeader) {
            titleEditHeader.value = this.currentFileName;
        }
        
        // Save with new filename
        this.saveDocument();
    }
    
    /**
     * Export document
     */
    exportDocument() {
        this.saveDocument();
    }
    
    /**
     * Get document HTML (matching main2.pyw export format)
     */
    getDocumentHTML() {
        const content = this.quill.root.innerHTML;
        const currentTheme = document.body.getAttribute('data-theme') || 'light';
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.currentFileName}</title>
    <link rel="icon" type="image/png" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAA7AAAAOwBeShxvQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAANCSURBVFiFzZdNbBtFEMd/s2u7cdI0TuPEbuPYsZM2qZOmH4lUCamqKkQFqnJAQiAOXLhw4MaNA1IlLhw4cEQcuCAkDhQJqVIlJKRWgqpqVaVNmyZt0zRx7DhO7Njrj/Xu7nBwXDtxkjZpE/EnrXZ3Z+b/n5mdnV0BfwHbtm3TwsLC3snJySNFRUU7TCYTAIIg4Pf7OXfuXPfIyMiH6+vrL/0tgNbW1oP19fWvNjU17QcwGAwIgpA6L4oigiAwMTHR39fX9+Hk5GTHXwZobW3tqK+vf7mxsfGAlZWVeDye1LFUfJIkEQgE6O3t/aSnp+ejvwRQW1v7cn19/YGWlpZdFosFj8eDx+OhqqoKvV5PaWkpZrOZ0dFRurq6Tvf39595boCWlpam+vr6A+3t7buKiorw+XyMjo5SXl5OaWkpFRUVlJeXU1paiiiK+Hw+Ojs7T/f393/+3ABtbW0vNDQ0HNi9e/eu4uJivF4vo6OjVFRUUFZWhsPhIDc3F4fDQVlZGR6Ph5GREc6fP3+qv7//4nMDtLa27qyrq3ujra1tl8lkIhgM4na7qa6upqqqKgWRh8vlYnJykvPnz3/f19f3+zMDdHZ27qqurj7W3t6+y2Qy4ff7mZ6epr6+npKSElwuFzMzM/h8PjweD+Pj49y8efPSzZs3f3wmgIaGhv11dXUH29radhUWFjI3N8etW7doaGigpKSEubk5JiYmmJ+fZ2ZmhqGhIW7cuHFpaGjop+cCqKmpeaW+vv7dzZs375QkiYWFBYaGhjCbzWRnZ+N0OikpKWF6ehrXEzIdRuenQfQ6M4z5W3iMzNhU9j3OkHYKZuNrPk6fj7/a0G0vdZ57o0KkdFPWP4eoVxqgXOp2Mz37p5ic8ywcqhJZvtPMzt3FaQMAqxskXt5bwUhvP92XFxnvX3rQXlCkI2uDHmeZMQWQnq6r1HF7bJkr36+gaNqU9kxIcTxUK0AulVwSfPcT6YGOhxa5dNYBQJZeIi9fyZhzGXNuDOjZ+EzGp62s+hMEliJIkhZAhiFZGWfWrSCKWnJydKlANQBRVLh304sgasnK1pGdI6ct/+8Y">
    <link href="https://fonts.googleapis.com/css2?family=Gentium+Plus:wght@400;700&display=swap" rel="stylesheet">
    <style>
        /* CSS Variables for theming */
        :root {
            --bg-color: #f8f9fa;
            --paper-bg: #ffffff;
            --text-color: #2c3e50;
            --holding-border: #538135;
        }
        
        [data-theme='dark'] {
            --bg-color: #1a1a1a;
            --paper-bg: #2d2d2d;
            --text-color: #e0e0e0;
            --holding-border: #7cb342;
        }
        
        body {
            font-family: Arial, sans-serif;
            font-size: 32px;
            line-height: 1.5;
            max-width: 1000px;
            margin: 3rem auto;
            padding: 3rem;
            background: var(--bg-color);
            color: var(--text-color);
            transition: background 0.3s, color 0.3s;
        }
        
        /* Theme Toggle Button */
        .theme-toggle {
            position: fixed;
            top: 12px;
            right: 12px;
            border: 1px solid rgba(0,0,0,0.15);
            border-radius: 8px;
            padding: 6px 10px;
            background: var(--paper-bg);
            color: var(--text-color);
            cursor: pointer;
            font-size: 16px;
            transition: all 0.2s;
        }
        
        .theme-toggle:hover {
            background: var(--bg-color);
        }
        
        /* Document Title */
        h1 {
            text-align: center;
            margin-bottom: 2rem;
            font-size: 2rem;
        }
        
        /* Holdings Styles */
        .ql-holding-short {
            border: 1px solid var(--holding-border);
            border-radius: 3px;
            padding: 0;
            display: inline;
            box-decoration-break: clone;
            -webkit-box-decoration-break: clone;
        }
        
        .ql-holding-long {
            border: 2px solid var(--holding-border);
            border-radius: 3px;
            padding: 0;
            display: inline;
            box-decoration-break: clone;
            -webkit-box-decoration-break: clone;
        }
        
        /* Change Style */
        .ql-change-style {
            font-style: italic;
            color: #1d4ed8;
            white-space: pre;
        }
        
        /* Svara marks with special styling */
        .ql-svara-char {
            font-family: 'Gentium Plus', serif;
            font-size: 28px;
            color: #943634;
            display: inline;
            line-height: 1;
        }
        
        @media print {
            body {
                background: white !important;
                color: black !important;
            }
            .theme-toggle {
                display: none;
            }
        }
    </style>
</head>
<body data-theme="${currentTheme}">
    <!-- Theme Toggle Button -->
    <button class="theme-toggle" id="themeToggle" onclick="toggleTheme()" title="Toggle theme">🌞/🌙</button>
    
    <div class="content">
        ${content}
    </div>
    
    <script>
        function toggleTheme() {
            const body = document.body;
            const currentTheme = body.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            body.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        }
        
        // Load saved theme preference
        const savedTheme = localStorage.getItem('theme') || '${currentTheme}';
        document.body.setAttribute('data-theme', savedTheme);
    </script>
</body>
</html>`;
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 's':
                        e.preventDefault();
                        if (e.shiftKey) {
                            this.saveAsDocument();
                        } else {
                            this.saveDocument();
                        }
                        break;
                    case 'b':
                        e.preventDefault();
                        const boldBtn = document.getElementById('boldButton');
                        if (boldBtn) boldBtn.click();
                        break;
                    case 'i':
                        e.preventDefault();
                        const italicBtn = document.getElementById('italicButton');
                        if (italicBtn) italicBtn.click();
                        break;
                    case 'u':
                        e.preventDefault();
                        const underlineBtn = document.getElementById('underlineButton');
                        if (underlineBtn) underlineBtn.click();
                        break;
                }
            }
        });
    }

    /**
     * Get editor content as HTML
     */
    getHTML() {
        return this.quill.root.innerHTML;
    }

    /**
     * Set editor content
     */
    setHTML(html) {
        this.quill.root.innerHTML = html;
    }

    /**
     * Focus the editor
     */
    focus() {
        this.quill.focus();
    }

    /**
     * Get current editor statistics
     */
    getStats() {
        const text = this.quill.getText();
        return {
            characters: text.length,
            words: text.trim().split(/\s+/).filter(word => word.length > 0).length,
            paragraphs: text.split('\n').filter(p => p.trim().length > 0).length,
            currentStyle: this.currentStyle,
            hasSelection: !!this.quill.getSelection()
        };
    }

    /**
     * Setup status bar with word count and zoom
     */
    setupStatusBar() {
        const wordCount = document.getElementById('wordCount');
        const charCount = document.getElementById('charCount');
        const lineCount = document.getElementById('lineCount');
        const zoomSlider = document.getElementById('zoomSlider');
        const zoomLevel = document.getElementById('zoomLevel');
        const editor = document.getElementById('editor');
        
        // Update stats
        const updateStats = () => {
            const text = this.quill.getText();
            const lines = text.split('\n');
            const words = text.trim().split(/\s+/).filter(word => word.length > 0);
            
            wordCount.textContent = `Words: ${words.length}`;
            charCount.textContent = `Characters: ${text.length - 1}`; // -1 for trailing newline
            lineCount.textContent = `Lines: ${lines.length}`;
        };
        
        // Update on text change
        this.quill.on('text-change', () => {
            updateStats();
        });
        
        // Initial update
        updateStats();
        
        // Setup zoom
        zoomSlider.addEventListener('input', (e) => {
            const zoom = e.target.value;
            editor.style.transform = `scale(${zoom / 100})`;
            editor.style.transformOrigin = 'top left';
            zoomLevel.textContent = `${zoom}%`;
            
            // Adjust container to prevent overflow
            const container = editor.closest('.container');
            if (container) {
                container.style.height = `calc(100vh - 160px - ${100 - zoom}px)`;
            }
        });
    }
}

// Initialize the editor
window.siksamitraEditor = new SiksamitraEditor();

// Export for external access
window.SiksamitraEditor = SiksamitraEditor;