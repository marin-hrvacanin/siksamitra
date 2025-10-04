/**
 * Custom Quill Blots for śikṣāmitra Editor
 * 
 * Provides specialized formatting for Sanskrit text:
 * - ShortHolding: Short vowel markings
 * - LongHolding: Long vowel markings  
 * - ChangeStyle: Style changes (italic blue text)
 */

// Import Quill's base inline blot
const Inline = Quill.import('blots/inline');

/**
 * Short Holding Blot
 * Creates spans with short-holding class for brief vowel markings
 */
class ShortHolding extends Inline {
    static blotName = 'short-holding';
    static tagName = 'span';
    static className = 'short-holding';

    static create(value) {
        let node = super.create(value);
        node.classList.add(this.className);
        node.setAttribute('data-holding', 'short');
        return node;
    }

    static formats(node) {
        return node.classList.contains(this.className);
    }

    static value(node) {
        return node.getAttribute('data-holding') || true;
    }

    optimize() {
        super.optimize();
        // Remove empty holding spans
        if (!this.domNode.textContent.trim()) {
            this.remove();
        }
    }
}

/**
 * Long Holding Blot
 * Creates spans with long-holding class for extended vowel markings
 */
class LongHolding extends Inline {
    static blotName = 'long-holding';
    static tagName = 'span';
    static className = 'long-holding';

    static create(value) {
        let node = super.create(value);
        node.classList.add(this.className);
        node.setAttribute('data-holding', 'long');
        return node;
    }

    static formats(node) {
        return node.classList.contains(this.className);
    }

    static value(node) {
        return node.getAttribute('data-holding') || true;
    }

    optimize() {
        super.optimize();
        // Remove empty holding spans
        if (!this.domNode.textContent.trim()) {
            this.remove();
        }
    }
}

/**
 * Change Style Blot
 * Creates change tags for style variations (italic blue text)
 */
class ChangeStyle extends Inline {
    static blotName = 'change';
    static tagName = 'change';

    static create(value) {
        let node = super.create(value);
        node.setAttribute('data-style', 'change');
        return node;
    }

    static formats(node) {
        return node.tagName === 'CHANGE';
    }

    static value(node) {
        return node.getAttribute('data-style') || true;
    }

    optimize() {
        super.optimize();
        // Remove empty change spans
        if (!this.domNode.textContent.trim()) {
            this.remove();
        }
    }
}

/**
 * Svara Accent Blot (for future implementation)
 * Creates spans for tone/accent markings
 */
class SvaraAccent extends Inline {
    static blotName = 'svara-accent';
    static tagName = 'span';
    static className = 'svara-accent';

    static create(value) {
        let node = super.create(value);
        node.classList.add(this.className);
        node.setAttribute('data-svara', 'accent');
        return node;
    }

    static formats(node) {
        return node.classList.contains(this.className);
    }

    static value(node) {
        return node.getAttribute('data-svara') || true;
    }
}

// Register all custom blots with Quill
Quill.register(ShortHolding);
Quill.register(LongHolding);
Quill.register(ChangeStyle);
Quill.register(SvaraAccent);

/**
 * Utility functions for managing custom formats
 */
window.EditorBlots = {
    /**
     * Toggle holding format (short/long/none)
     * @param {Quill} quill - Quill editor instance
     * @param {string} type - 'short' or 'long'
     */
    toggleHolding(quill, type) {
        const range = quill.getSelection();
        if (!range) return;

        const format = quill.getFormat(range.index, range.length);
        const currentShort = format['short-holding'];
        const currentLong = format['long-holding'];

        if (type === 'short') {
            if (currentShort) {
                // Remove short holding
                quill.format('short-holding', false);
            } else {
                // Remove long holding first, then add short
                quill.format('long-holding', false);
                quill.format('short-holding', true);
            }
        } else if (type === 'long') {
            if (currentLong) {
                // Remove long holding
                quill.format('long-holding', false);
            } else {
                // Remove short holding first, then add long
                quill.format('short-holding', false);
                quill.format('long-holding', true);
            }
        }
    },

    /**
     * Clear all holding formats
     * @param {Quill} quill - Quill editor instance
     */
    clearHoldings(quill) {
        const range = quill.getSelection();
        if (!range) return;

        quill.format('short-holding', false);
        quill.format('long-holding', false);
    },

    /**
     * Toggle change style
     * @param {Quill} quill - Quill editor instance
     */
    toggleChangeStyle(quill) {
        const range = quill.getSelection();
        if (!range) return;

        const format = quill.getFormat(range.index, range.length);
        const isChange = format.change;
        quill.format('change', !isChange);
    },

    /**
     * Set style to normal (remove change format)
     * @param {Quill} quill - Quill editor instance
     */
    setNormalStyle(quill) {
        const range = quill.getSelection();
        if (!range) return;

        quill.format('change', false);
    },

    /**
     * Get current format state
     * @param {Quill} quill - Quill editor instance
     * @returns {Object} Current format state
     */
    getCurrentFormat(quill) {
        const range = quill.getSelection();
        if (!range) return {};

        return quill.getFormat(range.index, range.length);
    },

    /**
     * Clean up empty format spans
     * @param {Quill} quill - Quill editor instance
     */
    cleanup(quill) {
        const editor = quill.container.querySelector('.ql-editor');
        const emptySpans = editor.querySelectorAll('span:empty, change:empty');
        
        emptySpans.forEach(span => {
            span.remove();
        });
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ShortHolding, LongHolding, ChangeStyle, SvaraAccent };
}
