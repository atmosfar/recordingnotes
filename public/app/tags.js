class TagManager {
    constructor() {
        this.defaultTags = ['x Cut', '! Important', '< Retake', '? Question'];
        this.tags = this.loadTags();
    }

    loadTags() {
        const stored = localStorage.getItem('quick_tags');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                return this.defaultTags;
            }
        }
        return this.defaultTags;
    }

    saveTags() {
        localStorage.setItem('quick_tags', JSON.stringify(this.tags));
    }

    addTag(text) {
        const trimmed = text.trim();
        if (trimmed && !this.tags.includes(trimmed)) {
            this.tags.push(trimmed);
            this.saveTags();
            return true;
        }
        return false;
    }

    removeTag(text) {
        const index = this.tags.indexOf(text);
        if (index !== -1) {
            this.tags.splice(index, 1);
            this.saveTags();
            return true;
        }
        return false;
    }

    getTags() {
        return this.tags;
    }
}

export const tagManager = new TagManager();
