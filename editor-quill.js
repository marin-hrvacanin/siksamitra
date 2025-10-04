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

        // Register custom blots for pause marks
        class ShortPause extends Inline {
            static blotName = 'short-pause';
            static tagName = 'span';

            static create(value) {
                let node = super.create(value);
                node.classList.add('ql-short-pause');
                return node;
            }

            static formats(node) {
                return node.classList.contains('ql-short-pause');
            }
        }

        class LongPause extends Inline {
            static blotName = 'long-pause';
            static tagName = 'span';

            static create(value) {
                let node = super.create(value);
                node.classList.add('ql-long-pause');
                return node;
            }

            static formats(node) {
                return node.classList.contains('ql-long-pause');
            }
        }

        Quill.register(ShortPause);
        Quill.register(LongPause);

        // Register font and size formats using Style attributors
        const FontStyle = Quill.import('attributors/style/font');
        const SizeStyle = Quill.import('attributors/style/size');
        
        FontStyle.whitelist = ['Gentium Plus', 'Arial', 'Times New Roman', 'Calibri', 'Georgia', 'Verdana', 'Courier New', 'Noto Sans Devanagari'];
        SizeStyle.whitelist = ['8px', '9px', '10px', '11px', '12px', '14px', '16px', '18px', '20px', '22px', '24px', '28px', '32px', '36px', '48px', '72px'];
        
        Quill.register(FontStyle, true);
        Quill.register(SizeStyle, true);

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
            // Don't update if title is being edited
            if (document.activeElement.id !== 'titleEdit' && 
                document.activeElement.id !== 'titleEditHeader') {
                this.updateButtonStates();
            }
        });

        // Also update on text changes
        this.quill.on('text-change', () => {
            this.updateButtonStates();
        });
        
        // Initialize console
        this.initConsole();
    }
    
    /**
     * Initialize console functionality
     */
    initConsole() {
        this.consoleContainer = document.getElementById('consoleContainer');
        this.consoleContent = document.getElementById('consoleContent');
        this.consoleToggle = document.getElementById('consoleToggle');
        this.consoleClear = document.getElementById('consoleClear');
        
        // Toggle minimize/maximize
        if (this.consoleToggle) {
            this.consoleToggle.addEventListener('click', () => {
                this.consoleContainer.classList.toggle('minimized');
                this.consoleToggle.textContent = this.consoleContainer.classList.contains('minimized') ? '+' : '−';
                
                // Auto-scroll to bottom when opened
                if (!this.consoleContainer.classList.contains('minimized')) {
                    setTimeout(() => {
                        this.consoleContent.scrollTop = this.consoleContent.scrollHeight;
                    }, 50);
                }
            });
        }
        
        // Clear console
        if (this.consoleClear) {
            this.consoleClear.addEventListener('click', () => {
                this.consoleContent.innerHTML = '';
            });
        }
    }
    
    /**
     * Log message to console
     * @param {string} message - Message to log
     * @param {string} type - Type: 'info', 'success', 'warning', 'error'
     */
    log(message, type = 'info') {
        if (!this.consoleContent) return;
        
        // Show console if hidden
        if (!this.consoleContainer.classList.contains('visible')) {
            this.consoleContainer.classList.add('visible');
        }
        
        // Create message element
        const msgDiv = document.createElement('div');
        msgDiv.className = `console-message ${type}`;
        
        const timestamp = new Date().toLocaleTimeString();
        msgDiv.innerHTML = `<span class="timestamp">[${timestamp}]</span>${message}`;
        
        // Add to console
        this.consoleContent.appendChild(msgDiv);
        
        // Auto-scroll to bottom
        this.consoleContent.scrollTop = this.consoleContent.scrollHeight;
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
        const strikeBtn = document.getElementById('strikeButton');
        
        if (boldBtn) boldBtn.classList.toggle('active', !!format.bold);
        if (italicBtn) italicBtn.classList.toggle('active', !!format.italic);
        if (underlineBtn) underlineBtn.classList.toggle('active', !!format.underline);
        if (strikeBtn) strikeBtn.classList.toggle('active', !!format.strike);
        
        // Update holding buttons (using single 'holding' attribute)
        const shortBtn = document.getElementById('shortHoldingButton');
        const longBtn = document.getElementById('longHoldingButton');
        
        if (shortBtn) shortBtn.classList.toggle('active', format.holding === 'short');
        if (longBtn) longBtn.classList.toggle('active', format.holding === 'long');
        
        // Update font dropdown
        const fontCombo = document.getElementById('fontCombo');
        if (fontCombo) {
            if (format.font) {
                fontCombo.value = format.font;
            } else {
                fontCombo.value = ''; // Empty shows "Font (default)"
            }
        }
        
        // Update size dropdown
        const sizeCombo = document.getElementById('sizeCombo');
        if (sizeCombo) {
            if (format.size) {
                // Remove 'px' from the size value to match dropdown options
                const sizeValue = format.size.replace('px', '');
                sizeCombo.value = sizeValue;
            } else {
                sizeCombo.value = ''; // Empty shows "Size (default)"
            }
        }
        
        // Update style dropdown
        const styleCombo = document.getElementById('styleCombo');
        if (styleCombo) {
            const isChange = !!format['change-style'];
            const isSvara = !!format['svara-char'];
            const isShortPause = !!format['short-pause'];
            const isLongPause = !!format['long-pause'];
            
            if (isShortPause) {
                styleCombo.value = 'short-pause';
            } else if (isLongPause) {
                styleCombo.value = 'long-pause';
            } else if (isSvara) {
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
        this.setupFontControls();
        this.setupColorControls();
        this.setupAlignmentButtons();
        this.setupHoldingButtons();
        this.setupPauseButtons();
        this.setupViramaButton();
        this.setupStyleControls();
        this.setupSvaraButtons();
        this.setupIASTButtons();
        this.setupConvertButtons();
        this.setupAutomaticButtons();
        this.setupTitleInput();
    }

    /**
     * Setup text formatting buttons (bold, italic, underline, strikethrough)
     */
    setupTextFormattingButtons() {
        const boldBtn = document.getElementById('boldButton');
        const italicBtn = document.getElementById('italicButton');
        const underlineBtn = document.getElementById('underlineButton');
        const strikeBtn = document.getElementById('strikeButton');

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

        if (strikeBtn) {
            strikeBtn.addEventListener('click', () => {
                const format = this.quill.getFormat();
                this.quill.format('strike', !format.strike);
                this.updateButtonStates();
            });
        }
    }

    /**
     * Setup font and size controls
     */
    setupFontControls() {
        const fontCombo = document.getElementById('fontCombo');
        const sizeCombo = document.getElementById('sizeCombo');

        if (fontCombo) {
            fontCombo.addEventListener('change', () => {
                const font = fontCombo.value;
                if (font) {
                    this.quill.format('font', font);
                } else {
                    this.quill.format('font', false); // Remove font formatting
                }
            });
        }

        if (sizeCombo) {
            sizeCombo.addEventListener('change', () => {
                const size = sizeCombo.value;
                if (size) {
                    this.quill.format('size', size + 'px');
                } else {
                    this.quill.format('size', false); // Remove size formatting
                }
            });
        }
    }

    /**
     * Setup color controls (text color and highlight)
     */
    setupColorControls() {
        const textColorPicker = document.getElementById('textColorPicker');
        const highlightColorPicker = document.getElementById('highlightColorPicker');
        const clearFormatBtn = document.getElementById('clearFormatButton');

        // Text color - clicking the label applies current color, clicking picker changes color
        if (textColorPicker) {
            const textColorLabel = document.querySelector('label[for="textColorPicker"]');
            
            // Picker change event - updates the current color and applies it
            textColorPicker.addEventListener('change', () => {
                const color = textColorPicker.value;
                this.quill.format('color', color);
            });
            
            // Label click event - applies current color without opening picker
            if (textColorLabel) {
                textColorLabel.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const color = textColorPicker.value;
                    this.quill.format('color', color);
                });
            }
        }

        // Highlight color - clicking the label applies current color, clicking picker changes color
        if (highlightColorPicker) {
            const highlightColorLabel = document.querySelector('label[for="highlightColorPicker"]');
            
            // Picker change event - updates the current color and applies it
            highlightColorPicker.addEventListener('change', () => {
                const color = highlightColorPicker.value;
                this.quill.format('background', color);
            });
            
            // Label click event - applies current color without opening picker
            if (highlightColorLabel) {
                highlightColorLabel.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const color = highlightColorPicker.value;
                    this.quill.format('background', color);
                });
            }
        }

        if (clearFormatBtn) {
            clearFormatBtn.addEventListener('click', () => {
                const selection = this.quill.getSelection();
                if (selection && selection.length > 0) {
                    // Remove all formatting except holdings and custom styles
                    this.quill.removeFormat(selection.index, selection.length);
                }
            });
        }
    }

    /**
     * Setup alignment buttons
     */
    setupAlignmentButtons() {
        const alignLeftBtn = document.getElementById('alignLeftButton');
        const alignCenterBtn = document.getElementById('alignCenterButton');
        const alignRightBtn = document.getElementById('alignRightButton');

        if (alignLeftBtn) {
            alignLeftBtn.addEventListener('click', () => {
                this.quill.format('align', false); // false = left (default)
            });
        }

        if (alignCenterBtn) {
            alignCenterBtn.addEventListener('click', () => {
                this.quill.format('align', 'center');
            });
        }

        if (alignRightBtn) {
            alignRightBtn.addEventListener('click', () => {
                this.quill.format('align', 'right');
            });
        }
    }

    /**
     * Setup file operation buttons
     */
    setupFileButtons() {
        const openBtn = document.getElementById('openBtn');
        const saveBtn = document.getElementById('saveBtn');
        const saveAsBtn = document.getElementById('saveAsBtn');
        const exportBtn = document.getElementById('exportBtn');
        
        if (openBtn) {
            openBtn.addEventListener('click', () => this.openDocument());
        }
        
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
     * Setup pause buttons (short and long pause)
     */
    setupPauseButtons() {
        const shortPauseBtn = document.getElementById('shortPauseButton');
        const longPauseBtn = document.getElementById('longPauseButton');

        if (shortPauseBtn) {
            shortPauseBtn.addEventListener('click', () => {
                this.insertPause('short');
            });
        }

        if (longPauseBtn) {
            longPauseBtn.addEventListener('click', () => {
                this.insertPause('long');
            });
        }
    }

    /**
     * Setup virama button (avagraha - apostrophe for missing letters)
     */
    setupViramaButton() {
        const viramaBtn = document.getElementById('viramaButton');
        if (viramaBtn) {
            viramaBtn.addEventListener('click', () => {
                const selection = this.quill.getSelection(true);
                if (selection) {
                    // Insert avagraha (apostrophe for missing vowel)
                    this.quill.insertText(selection.index, "'", 'user');
                    this.quill.setSelection(selection.index + 1);
                }
            });
        }
    }

    /**
     * Insert a pause mark (blue for short, red for long)
     * @param {string} type - 'short' or 'long'
     */
    insertPause(type) {
        const selection = this.quill.getSelection(true);
        if (!selection) return;

        // Get current format to restore after pause
        const currentFormat = this.quill.getFormat(selection.index, 0);
        
        // Remove pause-related formats from current format
        const restoreFormat = { ...currentFormat };
        delete restoreFormat['short-pause'];
        delete restoreFormat['long-pause'];

        // Insert " | " with pause styling
        const pauseFormat = type === 'short' ? 'short-pause' : 'long-pause';
        
        // Insert space before pause with current format (no pause)
        this.quill.insertText(selection.index, ' ', restoreFormat, Quill.sources.USER);
        
        // Insert the pause mark "|" with ONLY pause format (no other formats)
        this.quill.insertText(selection.index + 1, '|', { [pauseFormat]: true }, Quill.sources.USER);
        
        // Insert space after pause with restored format (no pause styling)
        this.quill.insertText(selection.index + 2, ' ', restoreFormat, Quill.sources.USER);
        
        // Move cursor to after the second space and explicitly clear pause format
        this.quill.setSelection(selection.index + 3, 0);
        this.quill.format('short-pause', false);
        this.quill.format('long-pause', false);
        
        // Restore all the original formatting at cursor position
        Object.keys(restoreFormat).forEach(key => {
            this.quill.format(key, restoreFormat[key]);
        });
        
        // Focus editor if not editing title
        if (document.activeElement.id !== 'titleEdit' && 
            document.activeElement.id !== 'titleEditHeader') {
            this.quill.focus();
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
                    this.quill.format('short-pause', false);
                    this.quill.format('long-pause', false);
                } else if (selectedStyle === 'change') {
                    this.quill.format('change-style', true);
                    this.quill.format('svara-char', false);
                    this.quill.format('short-pause', false);
                    this.quill.format('long-pause', false);
                } else if (selectedStyle === 'svara') {
                    this.quill.format('change-style', false);
                    this.quill.format('svara-char', true);
                    this.quill.format('short-pause', false);
                    this.quill.format('long-pause', false);
                } else if (selectedStyle === 'short-pause') {
                    this.quill.format('change-style', false);
                    this.quill.format('svara-char', false);
                    this.quill.format('short-pause', true);
                    this.quill.format('long-pause', false);
                } else if (selectedStyle === 'long-pause') {
                    this.quill.format('change-style', false);
                    this.quill.format('svara-char', false);
                    this.quill.format('short-pause', false);
                    this.quill.format('long-pause', true);
                }
                
                this.updateButtonStates();
                // Don't refocus if user is editing title inputs
                if (document.activeElement.id !== 'titleEdit' && 
                    document.activeElement.id !== 'titleEditHeader') {
                    this.quill.focus();
                }
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
        
        // Focus the editor only if not editing title
        if (document.activeElement.id !== 'titleEdit' && 
            document.activeElement.id !== 'titleEditHeader') {
            this.quill.focus();
        }
    }
    
    /**
     * Setup title input
     */
    setupTitleInput() {
        // Setup title input in File tab
        const titleEdit = document.getElementById('titleEdit');
        if (titleEdit) {
            titleEdit.value = this.currentFileName;
            
            // Prevent focus from returning to editor when clicking/typing in input
            titleEdit.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
            });
            
            titleEdit.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                titleEdit.focus();
            });
            
            titleEdit.addEventListener('focus', (e) => {
                e.stopPropagation();
            });
            
            titleEdit.addEventListener('keydown', (e) => {
                e.stopPropagation();
            });
            
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
            
            // Prevent focus from returning to editor when clicking/typing in input
            titleEditHeader.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
            });
            
            titleEditHeader.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                titleEditHeader.focus();
            });
            
            titleEditHeader.addEventListener('focus', (e) => {
                e.stopPropagation();
            });
            
            titleEditHeader.addEventListener('keydown', (e) => {
                e.stopPropagation();
            });
            
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
     * Setup convert/transliteration buttons
     */
    setupConvertButtons() {
        const devanagariToIastBtn = document.getElementById('devanagariToIastBtn');
        const iastToDevanagariBtn = document.getElementById('iastToDevanagariBtn');
        
        if (devanagariToIastBtn) {
            devanagariToIastBtn.addEventListener('click', () => {
                this.transliterateDevanagariToIAST();
            });
        }
        
        if (iastToDevanagariBtn) {
            iastToDevanagariBtn.addEventListener('click', () => {
                this.transliterateIASTToDevanagari();
            });
        }
    }

    /**
     * Transliterate selected Devanagari text to IAST (preserving formatting)
     */
    transliterateDevanagariToIAST() {
        const selection = this.quill.getSelection();
        
        if (!selection || selection.length === 0) {
            alert('Please select text to transliterate.');
            return;
        }
        
        // Get selected content with formatting (Delta format)
        const delta = this.quill.getContents(selection.index, selection.length);
        
        // Build new delta with transliterated text but same formatting
        const newDelta = { ops: [] };
        
        delta.ops.forEach(op => {
            if (typeof op.insert === 'string') {
                // Transliterate the text
                const transliteratedText = this.devanagariToIAST(op.insert);
                // Keep the same attributes (formatting)
                newDelta.ops.push({
                    insert: transliteratedText,
                    attributes: op.attributes
                });
            } else {
                // Keep embeds as-is
                newDelta.ops.push(op);
            }
        });
        
        // Replace selection with new content
        this.quill.updateContents({
            ops: [
                { retain: selection.index },
                { delete: selection.length },
                ...newDelta.ops
            ]
        });
        
        // Calculate new length and set selection
        const newLength = newDelta.ops.reduce((len, op) => {
            return len + (typeof op.insert === 'string' ? op.insert.length : 1);
        }, 0);
        this.quill.setSelection(selection.index, newLength);
    }

    /**
     * Convert Devanagari text to IAST transliteration
     */
    devanagariToIAST(text) {
        // Mapping of Devanagari characters to IAST
        const vowels = {
            'अ': 'a', 'आ': 'ā', 'इ': 'i', 'ई': 'ī', 'उ': 'u', 'ऊ': 'ū',
            'ऋ': 'ṛ', 'ॠ': 'ṝ', 'ऌ': 'ḷ', 'ॡ': 'ḹ',
            'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
            'ॐ': 'oṁ'  // Om symbol
        };
        
        const vowelSigns = {
            'ा': 'ā', 'ि': 'i', 'ी': 'ī', 'ु': 'u', 'ू': 'ū',
            'ृ': 'ṛ', 'ॄ': 'ṝ', 'ॢ': 'ḷ', 'ॣ': 'ḹ',
            'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au'
        };
        
        const consonants = {
            'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ṅ',
            'च': 'c', 'छ': 'ch', 'ज': 'j', 'झ': 'jh', 'ञ': 'ñ',
            'ट': 'ṭ', 'ठ': 'ṭh', 'ड': 'ḍ', 'ढ': 'ḍh', 'ण': 'ṇ',
            'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
            'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
            'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
            'श': 'ś', 'ष': 'ṣ', 'स': 's', 'ह': 'h',
            'ळ': 'ḷ', 'क्ष': 'kṣ', 'ज्ञ': 'jñ'
        };
        
        const special = {
            'ं': 'ṁ',     // Anusvara
            'ः': 'ḥ',     // Visarga
            'ँ': 'm̐',    // Candrabindu
            'ऽ': '\'',    // Avagraha
            '।': '|',     // Danda
            '॥': '||'     // Double danda
        };
        
        let result = '';
        let i = 0;
        
        while (i < text.length) {
            let char = text[i];
            let matched = false;
            
            // Check for Om symbol first
            if (char === 'ॐ') {
                result += 'oṁ';
                matched = true;
                i++;
                continue;
            }
            
            // Check for two-character combinations (like क्ष, ज्ञ)
            if (i < text.length - 1) {
                let twoChar = char + text[i + 1];
                if (consonants[twoChar]) {
                    result += consonants[twoChar];
                    i += 2;
                    // Check what follows
                    if (i < text.length) {
                        let nextChar = text[i];
                        if (vowelSigns[nextChar]) {
                            result += vowelSigns[nextChar];
                            i++;
                        } else if (nextChar !== '्') {
                            result += 'a';
                        }
                    } else {
                        result += 'a';
                    }
                    matched = true;
                    continue;
                }
            }
            
            // Check vowels
            if (vowels[char]) {
                result += vowels[char];
                matched = true;
            }
            // Check consonants
            else if (consonants[char]) {
                result += consonants[char];
                // Check if followed by vowel sign or virama
                if (i + 1 < text.length) {
                    let nextChar = text[i + 1];
                    if (vowelSigns[nextChar]) {
                        result += vowelSigns[nextChar];
                        i++;
                    } else if (nextChar === '्') {
                        // Virama - check if it's followed by another consonant (conjunct)
                        if (i + 2 < text.length && consonants[text[i + 2]]) {
                            // It's a conjunct, skip the virama (don't add 'a' or apostrophe)
                            i++; // Skip virama
                        } else {
                            // Standalone virama at end or before non-consonant
                            // Skip the virama but don't add 'a'
                            i++; // Skip virama
                        }
                    } else {
                        // Add inherent 'a' if no vowel sign or virama follows
                        result += 'a';
                    }
                } else {
                    // Consonant at end of text - no inherent 'a'
                    // (It should have a virama in proper Devanagari, but we don't add 'a')
                }
                matched = true;
            }
            // Check vowel signs (standalone, shouldn't happen but handle it)
            else if (vowelSigns[char]) {
                result += vowelSigns[char];
                matched = true;
            }
            // Check special characters (but skip virama as it's handled with consonants)
            else if (char !== '्' && special[char]) {
                result += special[char];
                matched = true;
            }
            // Skip virama completely - it should never appear in IAST output
            else if (char === '्') {
                matched = true;
            }
            
            // If no match, keep original character
            if (!matched) {
                result += char;
            }
            
            i++;
        }
        
        return result;
    }

    /**
     * Transliterate selected IAST text to Devanagari (preserving formatting)
     */
    transliterateIASTToDevanagari() {
        const selection = this.quill.getSelection();
        
        if (!selection || selection.length === 0) {
            alert('Please select text to transliterate.');
            return;
        }
        
        // Get selected content with formatting (Delta format)
        const delta = this.quill.getContents(selection.index, selection.length);
        
        // Build new delta with transliterated text but same formatting
        const newDelta = { ops: [] };
        
        delta.ops.forEach(op => {
            if (typeof op.insert === 'string') {
                // Transliterate the text
                const transliteratedText = this.iastToDevanagari(op.insert);
                // Keep the same attributes (formatting)
                newDelta.ops.push({
                    insert: transliteratedText,
                    attributes: op.attributes
                });
            } else {
                // Keep embeds as-is
                newDelta.ops.push(op);
            }
        });
        
        // Replace selection with new content
        this.quill.updateContents({
            ops: [
                { retain: selection.index },
                { delete: selection.length },
                ...newDelta.ops
            ]
        });
        
        // Calculate new length and set selection
        const newLength = newDelta.ops.reduce((len, op) => {
            return len + (typeof op.insert === 'string' ? op.insert.length : 1);
        }, 0);
        this.quill.setSelection(selection.index, newLength);
    }

    /**
     * Convert IAST text to Devanagari
     * @param {string} text - IAST text to convert
     * @returns {string} - Devanagari text
     */
    iastToDevanagari(text) {
        // Reverse mappings for IAST → Devanagari
        const vowels = {
            'a': 'अ',
            'ā': 'आ',
            'i': 'इ',
            'ī': 'ई',
            'u': 'उ',
            'ū': 'ऊ',
            'ṛ': 'ऋ',
            'ṝ': 'ॠ',
            'ḷ': 'ऌ',
            'ḹ': 'ॡ',
            'e': 'ए',
            'ai': 'ऐ',
            'o': 'ओ',
            'au': 'औ',
            'oṁ': 'ॐ',
            'ṁ': 'ं'
        };
        
        const vowelSigns = {
            'ā': 'ा',
            'i': 'ि',
            'ī': 'ी',
            'u': 'ु',
            'ū': 'ू',
            'ṛ': 'ृ',
            'ṝ': 'ॄ',
            'ḷ': 'ॢ',
            'ḹ': 'ॣ',
            'e': 'े',
            'ai': 'ै',
            'o': 'ो',
            'au': 'ौ'
        };
        
        const consonants = {
            'k': 'क',
            'kh': 'ख',
            'g': 'ग',
            'gh': 'घ',
            'ṅ': 'ङ',
            'c': 'च',
            'ch': 'छ',
            'j': 'ज',
            'jh': 'झ',
            'ñ': 'ञ',
            'ṭ': 'ट',
            'ṭh': 'ठ',
            'ḍ': 'ड',
            'ḍh': 'ढ',
            'ṇ': 'ण',
            't': 'त',
            'th': 'थ',
            'd': 'द',
            'dh': 'ध',
            'n': 'न',
            'p': 'प',
            'ph': 'फ',
            'b': 'ब',
            'bh': 'भ',
            'm': 'म',
            'y': 'य',
            'r': 'र',
            'l': 'ल',
            'v': 'व',
            'ś': 'श',
            'ṣ': 'ष',
            's': 'स',
            'h': 'ह'
        };
        
        const special = {
            'ṁ': 'ं',
            'ṃ': 'ं',
            'ḥ': 'ः',
            '\'': 'ऽ',
            '0': '०',
            '1': '१',
            '2': '२',
            '3': '३',
            '4': '४',
            '5': '५',
            '6': '६',
            '7': '७',
            '8': '८',
            '9': '९'
        };
        
        // Helper function to check if next chars form a consonant
        const isConsonantAhead = (pos) => {
            if (pos >= text.length) return false;
            // Check 2-char consonants first
            const twoChar = text.substring(pos, pos + 2);
            if (consonants[twoChar]) return true;
            // Check 1-char consonants
            if (consonants[text[pos]]) return true;
            return false;
        };
        
        // Helper function to check if char is word boundary  
        const isWordBoundary = (char) => {
            if (!char) return true; // undefined/null/empty
            // Check for all types of whitespace (including non-breaking space \u00A0)
            if (/\s/.test(char) || char === '\u00A0' || char === '\u202F' || char === '\u2009') return true;
            // Check for punctuation
            if (/[.,;:!?\-—()|।॥]/.test(char)) return true;
            return false;
        };
        
        let result = '';
        let i = 0;
        
        while (i < text.length) {
            let matched = false;
            
            // Check for 'oṁ' (special case for Om)
            if (i <= text.length - 2 && text.substring(i, i + 2) === 'oṁ') {
                result += 'ॐ';
                i += 2;
                matched = true;
            }
            // Check for 3-char sequences (aspirated consonant + 'a')
            else if (i < text.length - 2) {
                const threeChar = text.substring(i, i + 3);
                if (threeChar === 'kha' || threeChar === 'gha' || threeChar === 'cha' ||
                    threeChar === 'jha' || threeChar === 'ṭha' || threeChar === 'ḍha' ||
                    threeChar === 'tha' || threeChar === 'dha' || threeChar === 'pha' || threeChar === 'bha') {
                    // Aspirated consonant followed by 'a' (inherent vowel)
                    const cons = threeChar.substring(0, 2);
                    result += consonants[cons];
                    i += 3;
                    matched = true;
                }
            }
            
            if (!matched && i < text.length - 1) {
                const twoChar = text.substring(i, i + 2);
                
                // Check for aspirated consonants
                if (consonants[twoChar]) {
                    result += consonants[twoChar];
                    i += 2;
                    
                    // Check what comes after the consonant
                    if (i < text.length) {
                        let vowelMatched = false;
                        
                        // Try 2-char vowel signs first (ai, au)
                        if (i < text.length - 1) {
                            const nextTwo = text.substring(i, i + 2);
                            if (vowelSigns[nextTwo]) {
                                result += vowelSigns[nextTwo];
                                i += 2;
                                vowelMatched = true;
                            }
                        }
                        
                        // Try 1-char vowel signs
                        if (!vowelMatched && vowelSigns[text[i]]) {
                            result += vowelSigns[text[i]];
                            i++;
                            vowelMatched = true;
                        }
                        
                        // If next char is 'a', it's the inherent vowel - skip it
                        if (!vowelMatched && text[i] === 'a') {
                            i++;
                            vowelMatched = true;
                        }
                        
                        // If no vowel, check if we need virama
                        if (!vowelMatched) {
                            const nextChar = text[i];
                            const needsVirama = isConsonantAhead(i) || isWordBoundary(nextChar);
                            // Add virama if followed by consonant (conjunct) or at word boundary
                            if (needsVirama) {
                                result += '्';
                            }
                        }
                    } else {
                        // Consonant at end of string - add virama
                        result += '्';
                    }
                    matched = true;
                }
                // Check for vowel diphthongs (ai, au)
                else if (vowels[twoChar]) {
                    result += vowels[twoChar];
                    i += 2;
                    matched = true;
                }
            }
            
            if (!matched) {
                const char = text[i];
                
                // Check for single-char consonants
                if (consonants[char]) {
                    result += consonants[char];
                    i++;
                    
                    // Check what comes after the consonant
                    if (i < text.length) {
                        let vowelMatched = false;
                        
                        // Try 2-char vowel signs first (ai, au)
                        if (i < text.length - 1) {
                            const nextTwo = text.substring(i, i + 2);
                            if (vowelSigns[nextTwo]) {
                                result += vowelSigns[nextTwo];
                                i += 2;
                                vowelMatched = true;
                            }
                        }
                        
                        // Try 1-char vowel signs
                        if (!vowelMatched && vowelSigns[text[i]]) {
                            result += vowelSigns[text[i]];
                            i++;
                            vowelMatched = true;
                        }
                        
                        // If next char is 'a', it's the inherent vowel - skip it
                        if (!vowelMatched && text[i] === 'a') {
                            i++;
                            vowelMatched = true;
                        }
                        
                        // If no vowel, check if we need virama
                        if (!vowelMatched) {
                            const nextChar = text[i];
                            const needsVirama = isConsonantAhead(i) || isWordBoundary(nextChar);
                            // Add virama if followed by consonant (conjunct) or at word boundary
                            if (needsVirama) {
                                result += '्';
                            }
                        }
                    } else {
                        // Consonant at end of string - add virama
                        result += '्';
                    }
                    matched = true;
                }
                // Check standalone vowels
                else if (vowels[char]) {
                    result += vowels[char];
                    i++;
                    matched = true;
                }
                // Check special characters
                else if (special[char]) {
                    result += special[char];
                    i++;
                    matched = true;
                }
                // Keep original character (spaces, punctuation, etc.)
                else {
                    result += char;
                    i++;
                }
            }
        }
        
        return result;
    }

    /**
     * Apply svara accent with special styling (DOM manipulation for isolation)
     */
    applySvara(type) {
        const accents = {
            'svarita': '\u030d',      // ̍ combining vertical line above
            'anudatta': '\u0331',     // ̱ combining macron below
            'udatta': '\u030e',       // ̎ combining double vertical line above
            'tick': '\u02ce'          // ˎ modifier letter low grave accent
        };

        const accent = accents[type];
        if (!accent) return;

        // Get current selection
        const selection = this.quill.getSelection(true);
        if (!selection) return;

        // We need to check if there's a character before the cursor
        if (selection.index === 0) {
            console.warn('Cannot insert combining mark at the beginning of text');
            return;
        }

        // Get current format to restore after svara
        const currentFormat = this.quill.getFormat(selection.index, 0);
        
        // Remove svara-related format from current format
        const restoreFormat = { ...currentFormat };
        delete restoreFormat['svara-char'];

        // Insert ONLY the combining mark with svara-char format (red, bold)
        // The combining mark will visually attach to the previous character
        // but only the mark itself gets the svara styling
        this.quill.insertText(selection.index, accent, { 'svara-char': true }, Quill.sources.USER);

        // DEBUG: Log the actual HTML structure
        console.log('=== SVARA DEBUG ===');
        console.log('Inserted at index:', selection.index);
        console.log('Accent character:', accent, 'Unicode:', accent.charCodeAt(0).toString(16));
        console.log('HTML output:', this.quill.root.innerHTML.substring(Math.max(0, selection.index - 50), selection.index + 100));
        
        // Move cursor after the combining mark
        const newPos = selection.index + accent.length;
        this.quill.setSelection(newPos, 0, Quill.sources.SILENT);
        
        // Explicitly clear svara format from cursor
        this.quill.format('svara-char', false, Quill.sources.SILENT);
        
        // Restore the original formatting at cursor position
        Object.keys(restoreFormat).forEach(key => {
            this.quill.format(key, restoreFormat[key], Quill.sources.SILENT);
        });

        // Focus the editor only if not editing title
        if (document.activeElement.id !== 'titleEdit' && 
            document.activeElement.id !== 'titleEditHeader') {
            this.quill.focus();
        }
    }
    
    /**
     * Setup automatic processing buttons
     */
    setupAutomaticButtons() {
        const applyHoldingsBtn = document.getElementById('applyHoldingsButton');
        const applyPausesBtn = document.getElementById('applyPausesButton');
        
        if (applyHoldingsBtn) {
            applyHoldingsBtn.addEventListener('click', () => this.applyAutomaticHoldings());
        }
        
        if (applyPausesBtn) {
            applyPausesBtn.addEventListener('click', () => this.applyAutomaticPauses());
        }
    }
    
    /**
     * Apply holdings automatically according to Sanskrit grammatical rules
     */
    applyAutomaticHoldings() {
        try {
            // Get selection - REQUIRE selection
            const selection = this.quill.getSelection();
            
            if (!selection || selection.length === 0) {
                this.log('Please select some text to apply holdings.', 'warning');
                return;
            }
            
            // Initialize Sanskrit processor
            const processor = new SanskritProcessor();
            
            const startIndex = selection.index;
            const textLength = selection.length;
            
            // Get the plain text from the selection
            let text = this.quill.getText(startIndex, textLength);
            
            // Debug: log the text to see what we're getting
            console.log('Original text for holdings:', JSON.stringify(text));
            
            // Step 1: Pre-process the text to standardize characters
            this.log('Pre-processing text...', 'info');
            const processedText = processor.preProcessRawText(text);
            
            // If text was changed by preprocessing, update it in the editor
            if (text !== processedText) {
                this.quill.deleteText(startIndex, textLength, Quill.sources.SILENT);
                this.quill.insertText(startIndex, processedText, Quill.sources.SILENT);
                text = processedText;
                this.log('Text standardized.', 'info');
            }
            
            // Step 2: Find all holding positions
            this.log('Finding samyuktas...', 'info');
            const holdings = processor.findAllHoldings(text);
            
            if (holdings.length === 0) {
                this.log('No holdings found. Make sure your text contains Sanskrit consonant clusters (samyuktas).', 'warning');
                return;
            }
            
            // Step 3: Apply holdings in reverse order (to preserve positions)
            holdings.sort((a, b) => b.position - a.position);
            
            for (const holding of holdings) {
                const { position, length, type } = holding;
                
                // Apply the appropriate holding format
                // The holding attributor expects 'short' or 'long' as the value
                this.quill.formatText(startIndex + position, length, 'holding', type, Quill.sources.USER);
            }
            
            this.log(`Successfully applied ${holdings.length} holdings!`, 'success');
            
        } catch (error) {
            console.error('Error applying holdings:', error);
            this.log('Error applying holdings: ' + error.message, 'error');
        }
    }
    
    /**
     * Apply automatic pauses based on Sanskrit rules
     * Only works on selected text
     */
    applyAutomaticPauses() {
        try {
            // Check if there's a selection
            const range = this.quill.getSelection();
            if (!range || range.length === 0) {
                this.log('Please select text before applying pauses', 'warning');
                return;
            }
            
            // Initialize Sanskrit processor
            const processor = new SanskritProcessor();
            
            const startIndex = range.index;
            const textLength = range.length;
            
            // Get the plain text from the selection
            let text = this.quill.getText(startIndex, textLength);
            
            // Step 1: Pre-process the text to standardize characters
            this.log('Pre-processing text...', 'info');
            const processedText = processor.preProcessRawText(text);
            
            // If text was changed by preprocessing, update it in the editor
            if (text !== processedText) {
                this.quill.deleteText(startIndex, textLength, Quill.sources.SILENT);
                this.quill.insertText(startIndex, processedText, Quill.sources.SILENT);
                text = processedText;
                this.log('Text standardized.', 'info');
            }
            
            // Step 2: Find all pauses in the standardized text
            this.log('Finding pause positions...', 'info');
            const pauses = processor.findAllPauses(text);
            
            if (pauses.length === 0) {
                this.log('No pauses found in selected text', 'info');
                return;
            }
            
            // Step 3: Apply pauses in reverse order to maintain correct positions
            pauses.sort((a, b) => b.position - a.position);
            
            for (const pause of pauses) {
                const actualPosition = startIndex + pause.position;
                
                // Insert pause character with space after it
                const pauseFormat = pause.type === 'long' ? 'long-pause' : 'short-pause';
                this.quill.insertText(actualPosition, '| ', pauseFormat, Quill.sources.USER);
            }
            
            this.log(`Successfully applied ${pauses.length} pauses!`, 'success');
            
        } catch (error) {
            console.error('Error applying pauses:', error);
            this.log('Error applying pauses: ' + error.message, 'error');
        }
    }
    
    /**
     * Open document (loads HTML file)
     */
    openDocument() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.html,.htm';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const htmlContent = event.target.result;
                    
                    // Parse the HTML to extract content
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlContent, 'text/html');
                    
                    // Get the editor content
                    const editorDiv = doc.querySelector('.ql-editor');
                    if (editorDiv) {
                        this.quill.root.innerHTML = editorDiv.innerHTML;
                    }
                    
                    // Get the title
                    const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/);
                    if (titleMatch && titleMatch[1]) {
                        const title = titleMatch[1].replace('śikṣāmitra - ', '');
                        this.currentFileName = title;
                        document.title = `śikṣāmitra - ${title}`;
                        
                        // Update title inputs
                        const titleEdit = document.getElementById('titleEdit');
                        if (titleEdit) titleEdit.value = title;
                        
                        const titleEditHeader = document.getElementById('titleEditHeader');
                        if (titleEditHeader) titleEditHeader.value = title;
                    }
                    
                    console.log('Document opened successfully');
                } catch (error) {
                    console.error('Error opening document:', error);
                    alert('Error opening document: ' + error.message);
                }
            };
            
            reader.readAsText(file);
        };
        
        input.click();
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
    <link rel="icon" type="image/x-icon" href="data:image/x-icon;base64,AAABAAEAICAAAAEAIACoEAAAFgAAACgAAAAgAAAAQAAAAAEAIAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A">
    <style>
        /* Embedded Gentium Plus font */
        @font-face {
            font-family: 'Gentium Plus';
            font-style: normal;
            font-weight: 400;
            src: local('Gentium Plus'), local('GentiumPlus-Regular'),
                 url('https://fonts.gstatic.com/s/gentiumplus/v1/Iurd6Ytw-oSPaZ00r2bNe8VO7LxwLOmB.woff2') format('woff2');
        }
        @font-face {
            font-family: 'Gentium Plus';
            font-style: italic;
            font-weight: 400;
            src: local('Gentium Plus Italic'), local('GentiumPlus-Italic'),
                 url('https://fonts.gstatic.com/s/gentiumplus/v1/IurX6Ytw-oSPaZ00r2bNe8VOv5hp0zqRXkk.woff2') format('woff2');
        }
        @font-face {
            font-family: 'Gentium Plus';
            font-style: normal;
            font-weight: 700;
            src: local('Gentium Plus Bold'), local('GentiumPlus-Bold'),
                 url('https://fonts.gstatic.com/s/gentiumplus/v1/IurT6Ytw-oSPaZ00r2bNe8VOv7hJeq-bXVKC.woff2') format('woff2');
        }
        
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
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            margin: 0;
            padding: 40px 20px;
            background: var(--bg-color);
            color: var(--text-color);
            font-family: Arial, sans-serif;
            transition: background-color 0.3s, color 0.3s;
        }
        
        .paper {
            max-width: 1000px;
            min-height: 11in;
            margin: 0 auto;
            padding: 3rem;
            background: var(--paper-bg);
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border-radius: 12px;
        }
        
        .content {
            font-family: Arial, sans-serif;
            font-size: 32px;
            line-height: 1.5;
            color: var(--text-color);
        }
        
        /* Theme Toggle Button */
        .theme-toggle {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 40px;
            height: 40px;
            border: 1px solid rgba(0,0,0,0.15);
            border-radius: 50%;
            background: var(--paper-bg);
            color: var(--text-color);
            cursor: pointer;
            font-size: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            z-index: 1000;
        }
        
        .theme-toggle:hover {
            transform: scale(1.1);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        
        /* Quill format styles */
        strong, .ql-bold {
            font-weight: bold;
        }
        
        em, .ql-italic {
            font-style: italic;
        }
        
        u, .ql-underline {
            text-decoration: underline;
        }
        
        s, .ql-strike {
            text-decoration: line-through;
        }
        
        /* Font families - support both class and inline style */
        .ql-font-gentium,
        [style*="font-family: 'Gentium Plus'"],
        [style*="font-family: Gentium Plus"] {
            font-family: 'Gentium Plus', serif !important;
        }
        
        .ql-font-arial,
        [style*="font-family: Arial"] {
            font-family: Arial, sans-serif !important;
        }
        
        .ql-font-times,
        [style*="font-family: 'Times New Roman'"],
        [style*="font-family: Times New Roman"] {
            font-family: 'Times New Roman', serif !important;
        }
        
        .ql-font-calibri,
        [style*="font-family: Calibri"] {
            font-family: Calibri, sans-serif !important;
        }
        
        .ql-font-georgia,
        [style*="font-family: Georgia"] {
            font-family: Georgia, serif !important;
        }
        
        .ql-font-verdana,
        [style*="font-family: Verdana"] {
            font-family: Verdana, sans-serif !important;
        }
        
        .ql-font-courier,
        [style*="font-family: 'Courier New'"],
        [style*="font-family: Courier New"] {
            font-family: 'Courier New', monospace !important;
        }
        
        .ql-font-noto,
        [style*="font-family: 'Noto Sans Devanagari'"],
        [style*="font-family: Noto Sans Devanagari"] {
            font-family: 'Noto Sans Devanagari', sans-serif !important;
        }
        
        /* Font sizes */
        .ql-size-8px { font-size: 8px; }
        .ql-size-9px { font-size: 9px; }
        .ql-size-10px { font-size: 10px; }
        .ql-size-11px { font-size: 11px; }
        .ql-size-12px { font-size: 12px; }
        .ql-size-14px { font-size: 14px; }
        .ql-size-16px { font-size: 16px; }
        .ql-size-18px { font-size: 18px; }
        .ql-size-20px { font-size: 20px; }
        .ql-size-22px { font-size: 22px; }
        .ql-size-24px { font-size: 24px; }
        .ql-size-28px { font-size: 28px; }
        .ql-size-32px { font-size: 32px; }
        .ql-size-36px { font-size: 36px; }
        .ql-size-48px { font-size: 48px; }
        .ql-size-72px { font-size: 72px; }
        
        /* Text alignment */
        .ql-align-left {
            text-align: left;
        }
        
        .ql-align-center {
            text-align: center;
        }
        
        .ql-align-right {
            text-align: right;
        }
        
        .ql-align-justify {
            text-align: justify;
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
        }
        
        [data-theme='dark'] .ql-change-style {
            color: #60a5fa;
        }
        
        /* Svara marks */
        .ql-svara-char {
            font-family: 'Gentium Plus', serif;
            font-size: 1.3em;
            color: #943634;
            line-height: 1;
            vertical-align: baseline;
        }
        
        [data-theme='dark'] .ql-svara-char {
            color: #ef4444;
        }
        
        /* Pause marks */
        .ql-short-pause {
            color: #2563eb;
            font-weight: bold;
        }
        
        .ql-long-pause {
            color: #dc2626;
            font-weight: bold;
        }
        
        /* Paragraphs */
        p {
            margin: 0;
            padding: 0;
        }
        
        p + p {
            margin-top: 1em;
        }
        
        @media print {
            body {
                background: white !important;
                padding: 0;
            }
            .paper {
                box-shadow: none;
                border-radius: 0;
                margin: 0;
                max-width: 100%;
            }
            .theme-toggle {
                display: none;
            }
        }
    </style>
</head>
<body data-theme="${currentTheme}">
    <!-- Theme Toggle Button -->
    <button class="theme-toggle" id="themeToggle" onclick="toggleTheme()" title="Toggle theme">🌞</button>
    
    <div class="paper">
        <div class="content">
            ${content}
        </div>
    </div>
    
    <script>
        function toggleTheme() {
            const body = document.body;
            const currentTheme = body.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            body.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
        }
        
        function updateThemeIcon(theme) {
            const btn = document.getElementById('themeToggle');
            if (btn) {
                btn.textContent = theme === 'light' ? '🌞' : '🌙';
                btn.title = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
            }
        }
        
        // Load saved theme preference
        const savedTheme = localStorage.getItem('theme') || '${currentTheme}';
        document.body.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);
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
            lineCount.textContent = `Lines: ${Math.max(1, lines.length - 2)}`; // -2 for Quill's extra newlines
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