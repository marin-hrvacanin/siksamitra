/**
 * śikṣāmitra Document Format (.smdoc)
 * 
 * A lightweight document format that stores only essential content and style differences.
 * The full HTML is reconstructed by the editor/previewer by injecting default resources.
 * 
 * Format: JSON with the following structure:
 * {
 *   "version": 1,
 *   "content": "<editor HTML content>",
 *   "meta": {
 *     "title": "Document title",
 *     "created": timestamp,
 *     "modified": timestamp,
 *     "author": "optional author"
 *   },
 *   "styles": {
 *     "theme": "light|dark",
 *     "paragraphStyles": {...},  // Only if custom
 *     "customCSS": "..."         // Only if there are overrides
 *   },
 *   "audio": {
 *     "attachments": [...]       // Audio data if any
 *   }
 * }
 */

const SMDocFormat = {
    VERSION: 1,
    EXTENSION: '.smdoc',
    MIME_TYPE: 'application/x-sikshamitra-document',

    /**
     * Create a new .smdoc document from editor content
     * @param {Object} options - Document options
     * @param {string} options.content - The ql-editor innerHTML
     * @param {string} options.title - Document title
     * @param {string} options.theme - Current theme (light/dark)
     * @param {Object} options.paragraphStyles - Custom paragraph styles (if any)
     * @param {Array} options.audioAttachments - Audio attachment data (if any)
     * @returns {Object} The .smdoc document object (caller should JSON.stringify)
     */
    create(options) {
        const {
            content = '',
            title = 'Untitled',
            theme = 'light',
            paragraphStyles = null,
            audioAttachments = null,
            customCSS = null
        } = options;

        const doc = {
            version: this.VERSION,
            content: this._compressContent(content),
            meta: {
                title: title,
                created: Math.floor(Date.now() / 1000),
                modified: Math.floor(Date.now() / 1000)
            },
            styles: {}
        };

        // Only include theme if not default
        if (theme && theme !== 'light') {
            doc.styles.theme = theme;
        }

        // Only include paragraph styles if customized
        if (paragraphStyles && Object.keys(paragraphStyles).length > 0) {
            doc.styles.paragraphStyles = paragraphStyles;
        }

        // Only include custom CSS if present
        if (customCSS && customCSS.trim()) {
            doc.styles.customCSS = customCSS.trim();
        }

        // Only include audio if present
        if (audioAttachments && audioAttachments.length > 0) {
            doc.audio = { attachments: audioAttachments };
        }

        // Remove empty styles object
        if (Object.keys(doc.styles).length === 0) {
            delete doc.styles;
        }

        return doc; // Return object, caller should JSON.stringify
    },

    /**
     * Parse a .smdoc document
     * @param {string} jsonString - The .smdoc file content
     * @returns {Object} Parsed document with normalized fields
     */
    parse(jsonString) {
        try {
            let doc = JSON.parse(jsonString);
            
            // Handle double-encoded JSON (backward compatibility with buggy saves)
            if (typeof doc === 'string') {
                console.warn('SMDoc was double-encoded, parsing inner JSON');
                doc = JSON.parse(doc);
            }
            
            // Validate version
            if (!doc.version || doc.version > this.VERSION) {
                console.warn('SMDoc version mismatch, attempting to parse anyway');
            }

            return {
                version: doc.version || 1,
                content: this._decompressContent(doc.content || ''),
                meta: {
                    title: doc.meta?.title || 'Untitled',
                    created: doc.meta?.created || 0,
                    modified: doc.meta?.modified || 0,
                    author: doc.meta?.author || ''
                },
                styles: {
                    theme: doc.styles?.theme || 'light',
                    paragraphStyles: doc.styles?.paragraphStyles || null,
                    customCSS: doc.styles?.customCSS || ''
                },
                audio: {
                    attachments: doc.audio?.attachments || []
                }
            };
        } catch (e) {
            console.error('Failed to parse SMDoc:', e);
            throw new Error('Invalid .smdoc file format');
        }
    },

    /**
     * Compress content by removing unnecessary whitespace and normalizing
     * @param {string} content - HTML content
     * @returns {string} Compressed content
     */
    _compressContent(content) {
        if (!content) return '';
        
        // Remove excessive whitespace between tags (but preserve within text)
        let compressed = content
            .replace(/>\s{2,}</g, '> <')  // Multiple spaces between tags -> single
            .replace(/\n\s*\n/g, '\n')     // Multiple newlines -> single
            .trim();
        
        return compressed;
    },

    /**
     * Decompress content (currently just returns as-is, but allows for future expansion)
     * @param {string} content - Compressed content
     * @returns {string} Decompressed content
     */
    _decompressContent(content) {
        return content || '';
    },

    /**
     * Check if a filename/path is an .smdoc file
     * @param {string} path - File path or name
     * @returns {boolean}
     */
    isSMDoc(path) {
        if (!path) return false;
        return path.toLowerCase().endsWith(this.EXTENSION);
    },

    /**
     * Convert .smdoc parsed document to full HTML for preview/export
     * @param {Object} doc - Parsed .smdoc document
     * @param {Object} resources - Resources to inject (fontDataURI, faviconDataURI, defaultCSS)
     * @returns {string} Full HTML document
     */
    toHTML(doc, resources = {}) {
        const {
            fontDataURI = '',
            faviconDataURI = '',
            defaultCSS = ''
        } = resources;

        const theme = doc.styles?.theme || 'light';
        const title = doc.meta?.title || 'Untitled';
        const content = doc.content || '';
        const customCSS = doc.styles?.customCSS || '';
        const paragraphStylesCSS = this._generateParagraphStylesCSS(doc.styles?.paragraphStyles);

        // Build the full HTML
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="generator" content="śikṣāmitra">
    <title>${this._escapeHTML(title)}</title>
    ${faviconDataURI ? `<link rel="icon" type="image/x-icon" href="${faviconDataURI}">` : ''}
    <style>
${this._getDefaultStyles(fontDataURI)}
${paragraphStylesCSS}
${customCSS}
    </style>
</head>
<body data-theme="${theme}">
    <button class="theme-toggle" onclick="document.body.setAttribute('data-theme', document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark')" title="Toggle Theme">
        <span class="theme-icon">◐</span>
    </button>
    <div class="paper">
        <div class="content">
            <div class="ql-editor">${content}</div>
        </div>
    </div>
</body>
</html>`;

        return html;
    },

    /**
     * Generate paragraph styles CSS from settings object
     */
    _generateParagraphStylesCSS(paragraphStyles) {
        if (!paragraphStyles) return '';
        
        let css = '';
        const styleMap = {
            'doc-title': '.ql-doc-title',
            'doc-subtitle': '.ql-doc-subtitle', 
            'doc-section': '.ql-doc-section',
            'doc-subsection': '.ql-doc-subsection',
            'doc-translation': '.ql-doc-translation'
        };

        for (const [key, selector] of Object.entries(styleMap)) {
            const style = paragraphStyles[key];
            if (style) {
                let rules = [];
                if (style.color) rules.push(`color: ${style.color}`);
                if (style.fontSize) rules.push(`font-size: ${style.fontSize}`);
                if (style.fontWeight) rules.push(`font-weight: ${style.fontWeight}`);
                if (style.fontStyle) rules.push(`font-style: ${style.fontStyle}`);
                if (style.textAlign) rules.push(`text-align: ${style.textAlign}`);
                
                if (rules.length > 0) {
                    css += `${selector} { ${rules.join('; ')}; }\n`;
                }
            }
        }
        
        return css;
    },

    /**
     * Get default styles (the core CSS that's always needed)
     */
    _getDefaultStyles(fontDataURI = '') {
        return `
/* Embedded URW Palladio ITU font */
@font-face {
    font-family: 'URW Palladio ITU';
    font-style: normal;
    font-weight: 400;
    font-display: swap;
    ${fontDataURI ? `src: url('${fontDataURI}') format('truetype');` : ''}
}

/* ==================== CSS VARIABLES - Ochre & Saffron Design System ==================== */
:root {
    /* LIGHT MODE - "Paper & Ink" */
    --bg-body: #f5f3f0;
    --bg-surface: #ffffff;
    --bg-elevated: #fafaf9;
    --paper-bg: #ffffff;
    
    --border: #e0ddd8;
    --border-color: #e0ddd8;
    
    --primary: #b8813d;
    --primary-hover: #9a6b2f;
    --primary-subtle: rgba(184, 129, 61, 0.08);
    
    --accent: #d97706;
    --accent-subtle: rgba(217, 119, 6, 0.1);
    
    --text-primary: #1a1816;
    --text-secondary: #5c5855;
    --text-tertiary: #9b9792;
    --text-color: #1a1816;
    
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.06);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
    --shadow-lg: 0 12px 32px rgba(0,0,0,0.12);
    
    --holding-border: #10b981;
    --holding-long: #ef4444;
    --translation-text-color: #5c5855;
    
    --radius-md: 8px;
    --radius-lg: 12px;
}

[data-theme='dark'] {
    /* DARK MODE - "Midnight Manuscript" */
    --bg-body: #0d0d0d;
    --bg-surface: #1a1a1a;
    --bg-elevated: #242424;
    --paper-bg: #1a1a1a;
    
    --border: #333333;
    --border-color: #333333;
    
    --primary: #d4a574;
    --primary-hover: #e6b886;
    --primary-subtle: rgba(212, 165, 116, 0.1);
    
    --accent: #ff9933;
    --accent-subtle: rgba(255, 153, 51, 0.15);
    
    --text-primary: #e8e8e8;
    --text-secondary: #a0a0a0;
    --text-tertiary: #666666;
    --text-color: #e8e8e8;
    
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
    --shadow-lg: 0 12px 32px rgba(0,0,0,0.5);
    
    --holding-border: #34d399;
    --holding-long: #f87171;
    --translation-text-color: #a0a0a0;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    margin: 0;
    padding: 3rem 1.5rem;
    background: var(--bg-body);
    color: var(--text-color);
    font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', Arial, sans-serif;
    font-size: 18px;
    line-height: 1.6;
    min-height: 100vh;
    transition: background-color 0.3s ease, color 0.3s ease;
    -webkit-font-smoothing: antialiased;
}

.paper {
    max-width: 800px;
    margin: 0 auto;
    background: var(--paper-bg);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border);
    padding: 3rem;
    transition: all 0.3s ease;
}

.content { min-height: 60vh; }

.ql-editor {
    padding: 0;
    color: var(--text-color);
    background: transparent;
    line-height: 1.6;
    font-size: 18px;
    font-family: 'IBM Plex Sans', Arial, sans-serif;
    overflow-wrap: break-word;
    word-break: normal;
    white-space: pre-wrap;
}

.ql-editor p,
p {
    margin: 0;
    padding: 0;
    margin-bottom: 0.8em;
}

.ql-editor strong, strong, .ql-bold { font-weight: 700; }
.ql-editor em, em, .ql-italic { font-style: italic; }
.ql-editor u, u, .ql-underline { text-decoration: underline; }
.ql-editor s, s, .ql-strike { text-decoration: line-through; }

.ql-font-gentium,
[style*="font-family: 'Gentium Plus'"],
[style*="font-family: 'URW Palladio ITU'"] {
    font-family: 'URW Palladio ITU', 'Gentium Plus', serif !important;
}

.ql-font-arial { font-family: Arial, sans-serif !important; }
.ql-font-times { font-family: 'Times New Roman', serif !important; }
.ql-font-calibri { font-family: Calibri, sans-serif !important; }
.ql-font-georgia { font-family: Georgia, serif !important; }
.ql-font-verdana { font-family: Verdana, sans-serif !important; }
.ql-font-courier { font-family: 'Courier New', monospace !important; }

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

.ql-align-left { text-align: left; }
.ql-align-center { text-align: center; }
.ql-align-right { text-align: right; }
.ql-align-justify { text-align: justify; }

/* Document Heading Styles - Compact Ochre Design */
.ql-doc-title {
    font-size: 1.75em;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin: 0.5em 0 0.3em;
    text-align: left;
    color: #92400e;
    display: block;
    line-height: 1.25;
    border-bottom: 2px solid #d97706;
    padding-bottom: 0.2em;
}

[data-theme='dark'] .ql-doc-title {
    color: #fbbf24;
    border-bottom-color: #d97706;
}

.ql-doc-subtitle {
    font-size: 0.85em;
    font-weight: 500;
    margin: 0 0 0.8em;
    color: #78716c;
    text-align: left;
    display: block;
    line-height: 1.3;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

[data-theme='dark'] .ql-doc-subtitle {
    color: #a8a29e;
}

.ql-doc-section {
    font-size: 1.15em;
    font-weight: 600;
    margin: 1em 0 0.3em;
    color: #b45309;
    display: block;
    line-height: 1.3;
    border-left: 3px solid #d97706;
    padding-left: 0.5em;
    letter-spacing: 0;
}

[data-theme='dark'] .ql-doc-section {
    color: #fbbf24;
    border-left-color: #f59e0b;
}

.ql-doc-subsection {
    font-size: 0.9em;
    font-weight: 600;
    margin: 0.8em 0 0.2em;
    color: #78716c;
    display: block;
    line-height: 1.3;
    letter-spacing: 0.02em;
    border-left: 2px solid #d4a574;
    padding-left: 0.4em;
}

[data-theme='dark'] .ql-doc-subsection {
    color: #a8a29e;
    border-left-color: #d97706;
}

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

.ql-change-style {
    font-style: italic;
    color: #1d4ed8;
    white-space: pre;
}

[data-theme='dark'] .ql-change-style { color: #60a5fa; }

.ql-translation-style,
.ql-doc-translation {
    font-style: italic;
    color: var(--translation-text-color);
    white-space: pre-wrap;
    font-size: 0.85em;
    line-height: 1.4;
    display: block;
    margin: 0.5em 0;
}

.ql-comment-style {
    font-style: italic;
    color: #92400e;
    background: rgba(251, 191, 36, 0.25);
    border-left: 3px solid #f59e0b;
    padding: 0.1em 0.35em;
    border-radius: 4px;
    display: inline;
    white-space: pre-wrap;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
}

[data-theme='dark'] .ql-comment-style {
    color: #fcd34d;
    background: rgba(146, 64, 14, 0.35);
    border-left-color: #fbbf24;
}

.ql-short-pause { color: #2563eb; font-weight: bold; white-space: pre; }
.ql-long-pause { color: #dc2626; font-weight: bold; white-space: pre; }

.ql-dirgha-char, .ql-dirgha, .ql-dirgha-true {
    --dirgha-line-color: #1d4ed8;
    --dirgha-line-thickness: 0.08em;
    --dirgha-line-y: 0.28em;
    --dirgha-line-extend: 0.12em;
    color: inherit !important;
    text-decoration: none !important;
    position: relative !important;
    display: inline-block !important;
}

.ql-dirgha-char::before, .ql-dirgha::before, .ql-dirgha-true::before {
    content: '';
    position: absolute;
    left: calc(-1 * var(--dirgha-line-extend));
    right: calc(-1 * var(--dirgha-line-extend));
    top: var(--dirgha-line-y);
    height: var(--dirgha-line-thickness);
    background: var(--dirgha-line-color);
    pointer-events: none;
}

[data-theme='dark'] .ql-dirgha-char,
[data-theme='dark'] .ql-dirgha,
[data-theme='dark'] .ql-dirgha-true {
    --dirgha-line-color: #60a5fa;
}

.ql-svara-char, .ql-svara, .ql-svara-true {
    font-family: "URW Palladio ITU", "Times New Roman", serif !important;
    font-size: inherit !important;
    font-weight: 800 !important;
    color: #cc1b1b !important;
    font-style: normal !important;
    text-decoration: none !important;
}

[data-theme='dark'] .ql-svara-char,
[data-theme='dark'] .ql-svara,
[data-theme='dark'] .ql-svara-true {
    color: #ff4d4d !important;
}

/* Audio attachment styling */
.ql-audio-attachment {
    display: inline;
}

.ql-audio-attachment audio {
    display: none !important;
}

.audio-play-button {
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    min-width: 28px;
    border-radius: 50%;
    border: 2px solid var(--primary);
    background: var(--paper-bg);
    color: var(--primary);
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: var(--shadow-sm);
    padding: 0;
    margin: 0 4px;
    vertical-align: middle;
}

.audio-play-button:hover {
    background: var(--primary);
    color: #ffffff;
    transform: scale(1.1);
}

.audio-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
}

.audio-icon svg {
    width: 12px;
    height: 12px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
}

.audio-play-button[data-state='play'] .icon-play { display: block; }
.audio-play-button[data-state='play'] .icon-stop { display: none; }
.audio-play-button[data-state='pause'] .icon-play { display: none; }
.audio-play-button[data-state='pause'] .icon-stop { display: block; }

/* Theme Toggle Button */
.theme-toggle {
    position: fixed;
    top: 20px;
    right: 20px;
    width: 40px;
    height: 40px;
    border: 1px solid var(--border);
    border-radius: 50%;
    background: var(--paper-bg);
    color: var(--text-primary);
    cursor: pointer;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    box-shadow: var(--shadow-md);
    z-index: 1000;
}

.theme-toggle:hover {
    transform: scale(1.1);
    box-shadow: var(--shadow-lg);
    border-color: var(--primary);
}

/* Options Panel */
.options-toggle {
    position: fixed;
    top: 20px;
    right: 70px;
    width: 40px;
    height: 40px;
    border: 1px solid var(--border);
    border-radius: 50%;
    background: var(--paper-bg);
    color: var(--text-primary);
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    box-shadow: var(--shadow-md);
    z-index: 1000;
}

.options-toggle:hover {
    transform: scale(1.1);
    box-shadow: var(--shadow-lg);
    border-color: var(--primary);
}

.options-panel {
    position: fixed;
    top: 70px;
    right: 20px;
    background: var(--paper-bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 16px;
    box-shadow: var(--shadow-lg);
    z-index: 999;
    min-width: 200px;
    display: none;
}

.options-panel.visible {
    display: block;
}

.options-panel label {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    cursor: pointer;
    font-size: 14px;
    color: var(--text-primary);
}

.options-panel label:hover {
    color: var(--primary);
}

.options-panel input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--primary);
}

body.hide-audio .audio-play-button { display: none !important; }

@media print {
    body { background: #ffffff !important; padding: 0; }
    .paper { box-shadow: none; border-radius: 0; border: none; margin: 0; max-width: 100%; padding: 2.5cm; }
    .theme-toggle, .options-toggle, .options-panel { display: none !important; }
}
`;
    },

    /**
     * Escape HTML special characters
     */
    _escapeHTML(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    /**
     * Extract content from full HTML (for converting HTML to smdoc)
     * @param {string} html - Full HTML document
     * @returns {Object} Extracted document data
     */
    fromHTML(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Extract title
        const title = doc.querySelector('title')?.textContent || 'Untitled';
        
        // Extract theme
        const theme = doc.body?.getAttribute('data-theme') || 'light';
        
        // Extract editor content
        const editorDiv = doc.querySelector('.ql-editor');
        const content = editorDiv ? editorDiv.innerHTML.trim() : '';
        const audioAttachments = Array.from(doc.querySelectorAll('.ql-audio-attachment')).map((node) => {
            const audio = node.querySelector('audio');
            return {
                id: node.dataset.audioId || '',
                label: node.dataset.audioLabel || 'Audio',
                src: node.dataset.audioSrc || (audio ? audio.getAttribute('src') || '' : ''),
                startTime: parseFloat(node.dataset.startTime) || 0,
                endTime: node.dataset.endTime ? parseFloat(node.dataset.endTime) : null,
                duration: parseFloat(node.dataset.duration) || 0,
                size: parseFloat(node.dataset.size) || 0,
                fadeIn: parseFloat(node.dataset.fadeIn) || 0,
                fadeOut: parseFloat(node.dataset.fadeOut) || 0,
            };
        }).filter(item => item.id && item.src);
        
        // Extract any custom styles (look for style differences)
        // For now, we don't extract custom CSS - that would require more complex parsing
        
        return {
            content,
            title,
            theme,
            paragraphStyles: null,
            customCSS: null,
            audioAttachments: audioAttachments.length ? audioAttachments : null
        };
    }
};

// Export for use in browser and Node.js
if (typeof window !== 'undefined') {
    window.SMDocFormat = SMDocFormat;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SMDocFormat;
}
