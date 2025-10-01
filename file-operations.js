/**
 * File Operations Manager for śikṣāmitra Editor
 * 
 * Handles file operations including open, save, export to various formats
 */

class FileOperations {
    constructor(quill) {
        this.quill = quill;
        this.currentFileName = 'Untitled';
        this.currentFilePath = null;
        this.hasUnsavedChanges = false;
        this.fileInput = null;
        
        this.init();
    }

    /**
     * Initialize file operations
     */
    init() {
        this.setupFileInput();
        this.setupEventListeners();
        this.trackChanges();
        this.updateTitle();
    }

    /**
     * Setup hidden file input for opening files
     */
    setupFileInput() {
        this.fileInput = document.getElementById('fileInput');
        if (!this.fileInput) {
            this.fileInput = document.createElement('input');
            this.fileInput.type = 'file';
            this.fileInput.accept = '.txt,.html,.md,.json';
            this.fileInput.style.display = 'none';
            this.fileInput.id = 'fileInput';
            document.body.appendChild(this.fileInput);
        }

        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.openFile(e.target.files[0]);
            }
        });
    }

    /**
     * Setup event listeners for file operation buttons
     */
    setupEventListeners() {
        // File operation buttons
        const buttons = {
            newFile: () => this.newFile(),
            openFile: () => this.openFileDialog(),
            saveFile: () => this.saveFile(),
            saveAsFile: () => this.saveAsFile(),
            exportHtml: () => this.exportHtml(),
            exportDocx: () => this.exportDocx(),
            exportPdf: () => this.exportPdf()
        };

        Object.entries(buttons).forEach(([id, handler]) => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', handler);
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'n':
                        e.preventDefault();
                        this.newFile();
                        break;
                    case 'o':
                        e.preventDefault();
                        this.openFileDialog();
                        break;
                    case 's':
                        e.preventDefault();
                        if (e.shiftKey) {
                            this.saveAsFile();
                        } else {
                            this.saveFile();
                        }
                        break;
                }
            }
        });

        // Handle browser close/refresh
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return e.returnValue;
            }
        });
    }

    /**
     * Track changes in the editor
     */
    trackChanges() {
        if (!this.quill) return;

        this.quill.on('text-change', () => {
            this.hasUnsavedChanges = true;
            this.updateTitle();
            this.updateStatusBar();
        });
    }

    /**
     * Create new file
     */
    async newFile() {
        if (this.hasUnsavedChanges) {
            const save = await this.confirmSave();
            if (save === null) return; // User cancelled
            if (save) await this.saveFile();
        }

        this.quill.setContents([]);
        this.currentFileName = 'Untitled';
        this.currentFilePath = null;
        this.hasUnsavedChanges = false;
        this.updateTitle();
        this.updateStatusBar();
    }

    /**
     * Open file dialog
     */
    openFileDialog() {
        this.fileInput.click();
    }

    /**
     * Open file from File object
     * @param {File} file - File to open
     */
    async openFile(file) {
        try {
            if (this.hasUnsavedChanges) {
                const save = await this.confirmSave();
                if (save === null) return; // User cancelled
                if (save) await this.saveFile();
            }

            const text = await file.text();
            let content;

            // Parse based on file extension
            const extension = file.name.split('.').pop().toLowerCase();
            switch (extension) {
                case 'html':
                    content = this.parseHtmlContent(text);
                    break;
                case 'json':
                    content = this.parseJsonContent(text);
                    break;
                case 'md':
                    content = this.parseMarkdownContent(text);
                    break;
                default:
                    content = text;
            }

            this.quill.root.innerHTML = content;
            this.currentFileName = file.name;
            this.currentFilePath = null; // File API doesn't provide full path
            this.hasUnsavedChanges = false;
            this.updateTitle();
            this.updateStatusBar();

            this.showNotification(`Opened ${file.name}`, 'success');
        } catch (error) {
            console.error('Error opening file:', error);
            this.showNotification('Error opening file', 'error');
        }
    }

    /**
     * Save current file
     */
    async saveFile() {
        if (this.currentFilePath) {
            await this.saveToPath(this.currentFilePath);
        } else {
            await this.saveAsFile();
        }
    }

    /**
     * Save file with new name/location
     */
    async saveAsFile() {
        try {
            const content = this.getFileContent();
            const fileName = this.currentFileName.endsWith('.html') ? 
                this.currentFileName : `${this.currentFileName}.html`;

            await this.downloadFile(content, fileName, 'text/html');
            
            this.hasUnsavedChanges = false;
            this.updateTitle();
            this.showNotification(`Saved as ${fileName}`, 'success');
        } catch (error) {
            console.error('Error saving file:', error);
            this.showNotification('Error saving file', 'error');
        }
    }

    /**
     * Export as HTML
     */
    async exportHtml() {
        try {
            const html = this.generateHtmlExport();
            const fileName = `${this.currentFileName.replace(/\.[^/.]+$/, '')}_export.html`;
            
            await this.downloadFile(html, fileName, 'text/html');
            this.showNotification('Exported as HTML', 'success');
        } catch (error) {
            console.error('Error exporting HTML:', error);
            this.showNotification('Error exporting HTML', 'error');
        }
    }

    /**
     * Export as DOCX (placeholder - requires additional library)
     */
    async exportDocx() {
        try {
            // This would require a library like docx.js or similar
            const content = this.quill.root.innerText;
            const fileName = `${this.currentFileName.replace(/\.[^/.]+$/, '')}_export.txt`;
            
            await this.downloadFile(content, fileName, 'text/plain');
            this.showNotification('Exported as text (DOCX export requires additional setup)', 'warning');
        } catch (error) {
            console.error('Error exporting DOCX:', error);
            this.showNotification('Error exporting DOCX', 'error');
        }
    }

    /**
     * Export as PDF (placeholder - requires additional library)
     */
    async exportPdf() {
        try {
            // This would require a library like jsPDF or html2pdf
            const content = this.generateHtmlExport();
            const fileName = `${this.currentFileName.replace(/\.[^/.]+$/, '')}_export.html`;
            
            await this.downloadFile(content, fileName, 'text/html');
            this.showNotification('Exported as HTML (PDF export requires additional setup)', 'warning');
        } catch (error) {
            console.error('Error exporting PDF:', error);
            this.showNotification('Error exporting PDF', 'error');
        }
    }

    /**
     * Get file content for saving
     * @returns {string} File content
     */
    getFileContent() {
        return this.generateHtmlExport();
    }

    /**
     * Generate HTML export with styling
     * @returns {string} Complete HTML document
     */
    generateHtmlExport() {
        const content = this.quill.root.innerHTML;
        const themeManager = window.getThemeManager();
        const currentTheme = themeManager ? themeManager.getCurrentTheme() : 'light';
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.currentFileName}</title>
    <style>
        body {
            font-family: 'Gentium Plus', 'Times New Roman', serif;
            line-height: 1.8;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            background: ${currentTheme === 'dark' ? '#1e293b' : '#ffffff'};
            color: ${currentTheme === 'dark' ? '#f1f5f9' : '#1e293b'};
        }
        
        .short-holding {
            border: 1px solid #16a34a;
            border-radius: 0.25rem;
            padding: 0.125rem 0.25rem;
            background: rgba(34, 197, 94, 0.1);
            display: inline;
        }
        
        .long-holding {
            border: 2px solid #059669;
            border-radius: 0.25rem;
            padding: 0.125rem 0.25rem;
            background: rgba(16, 185, 129, 0.1);
            display: inline;
        }
        
        change {
            font-style: italic;
            color: #1d4ed8;
            font-weight: 500;
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
     * Parse HTML content for import
     * @param {string} html - HTML content
     * @returns {string} Parsed content
     */
    parseHtmlContent(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const body = doc.body;
        return body ? body.innerHTML : html;
    }

    /**
     * Parse JSON content for import
     * @param {string} json - JSON content
     * @returns {string} Parsed content
     */
    parseJsonContent(json) {
        try {
            const data = JSON.parse(json);
            if (data.content) {
                return data.content;
            }
            return JSON.stringify(data, null, 2);
        } catch {
            return json;
        }
    }

    /**
     * Parse Markdown content for import (basic)
     * @param {string} markdown - Markdown content
     * @returns {string} Parsed content
     */
    parseMarkdownContent(markdown) {
        // Basic markdown to HTML conversion
        return markdown
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
    }

    /**
     * Download file
     * @param {string} content - File content
     * @param {string} fileName - File name
     * @param {string} mimeType - MIME type
     */
    async downloadFile(content, fileName, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }

    /**
     * Show confirmation dialog for unsaved changes
     * @returns {Promise<boolean|null>} true to save, false to discard, null to cancel
     */
    async confirmSave() {
        return new Promise((resolve) => {
            const result = confirm('You have unsaved changes. Save before continuing?');
            resolve(result);
        });
    }

    /**
     * Update window title
     */
    updateTitle() {
        const title = `${this.currentFileName}${this.hasUnsavedChanges ? ' *' : ''} - śikṣāmitra`;
        document.title = title;
        
        // Update status bar
        const fileNameElement = document.getElementById('fileName');
        if (fileNameElement) {
            fileNameElement.textContent = this.currentFileName;
        }
    }

    /**
     * Update status bar with file info
     */
    updateStatusBar() {
        const wordCountElement = document.getElementById('wordCount');
        const charCountElement = document.getElementById('charCount');
        
        if (wordCountElement || charCountElement) {
            const text = this.quill.getText();
            const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
            const chars = text.length;
            
            if (wordCountElement) {
                wordCountElement.textContent = `Words: ${words}`;
            }
            if (charCountElement) {
                charCountElement.textContent = `Characters: ${chars}`;
            }
        }
    }

    /**
     * Show notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type ('success', 'error', 'warning')
     */
    showNotification(message, type = 'info') {
        // Simple notification - could be enhanced with a toast library
        console.log(`${type.toUpperCase()}: ${message}`);
        
        // Create temporary notification element
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem;
            border-radius: 0.5rem;
            color: white;
            z-index: 1000;
            font-size: 0.875rem;
            background: ${type === 'success' ? '#10b981' : 
                       type === 'error' ? '#ef4444' : 
                       type === 'warning' ? '#f59e0b' : '#3b82f6'};
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    /**
     * Get current file information
     * @returns {Object} File information
     */
    getFileInfo() {
        return {
            fileName: this.currentFileName,
            filePath: this.currentFilePath,
            hasUnsavedChanges: this.hasUnsavedChanges,
            wordCount: this.quill.getText().trim().split(/\s+/).filter(word => word.length > 0).length,
            charCount: this.quill.getText().length
        };
    }
}

// Export for use in other modules
window.FileOperations = FileOperations;