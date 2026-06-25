const TAG_COLORS = ['', '#ff4d4d', '#2ecc71', '#3498db', '#f1c40f'];

class TagManager {
    constructor() {
        this.defaultTags = [
            { text: 'x Cut', color: '#ff4d4d' },
            { text: '! Important', color: '#f1c40f' },
            { text: '< Retake', color: '#3498db' },
            { text: '? Question', color: '#2ecc71' },
        ];
        this.tags = this.loadTags();
    }

    loadTags() {
        const stored = localStorage.getItem('quick_tags');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                // Migrate old string format to new object format
                if (parsed.length > 0 && typeof parsed[0] === 'string') {
                    return parsed.map(text => ({ text, color: '' }));
                }
                return parsed;
            } catch (e) {
                return this.defaultTags;
            }
        }
        return this.defaultTags;
    }

    saveTags() {
        localStorage.setItem('quick_tags', JSON.stringify(this.tags));
    }

    addTag(text, color = '') {
        const trimmed = text.trim();
        if (trimmed && !this.tags.find(t => t.text === trimmed)) {
            this.tags.push({ text: trimmed, color });
            this.saveTags();
            return true;
        }
        return false;
    }

    removeTag(text) {
        const index = this.tags.findIndex(t => t.text === text);
        if (index !== -1) {
            this.tags.splice(index, 1);
            this.saveTags();
            return true;
        }
        return false;
    }

    moveTag(fromIndex, toIndex) {
        if (toIndex < 0 || toIndex >= this.tags.length) return false;
        const [tag] = this.tags.splice(fromIndex, 1);
        this.tags.splice(toIndex, 0, tag);
        this.saveTags();
        return true;
    }

    updateTagColor(text, color) {
        const tag = this.tags.find(t => t.text === text);
        if (tag) {
            tag.color = color;
            this.saveTags();
        }
    }

    getTags() {
        return this.tags;
    }

    getTagColor(text) {
        const tag = this.tags.find(t => t.text === text);
        return tag ? tag.color : '';
    }
}

export const tagManager = new TagManager();
