import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';

// Mock localStorage
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  clear() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
}

global.localStorage = new LocalStorageMock();

// Simple TagManager implementation for testing (to be moved to app.js)
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

describe('TagManager Logic', () => {
  let tagManager;

  beforeEach(() => {
    localStorage.clear();
    tagManager = new TagManager();
  });

  test('should initialize with default tags if localStorage is empty', () => {
    const tags = tagManager.getTags();
    assert.deepStrictEqual(tags, ['x Cut', '! Important', '< Retake', '? Question']);
  });

  test('should load tags from localStorage', () => {
    const customTags = ['Tag 1', 'Tag 2'];
    localStorage.setItem('quick_tags', JSON.stringify(customTags));
    const newManager = new TagManager();
    assert.deepStrictEqual(newManager.getTags(), customTags);
  });

  test('should add a new tag', () => {
    const result = tagManager.addTag('New Tag');
    assert.strictEqual(result, true);
    assert.ok(tagManager.getTags().includes('New Tag'));
    
    // Verify persistence
    const stored = JSON.parse(localStorage.getItem('quick_tags'));
    assert.ok(stored.includes('New Tag'));
  });

  test('should not add duplicate tags', () => {
    tagManager.addTag('Duplicate');
    const result = tagManager.addTag('Duplicate');
    assert.strictEqual(result, false);
    const count = tagManager.getTags().filter(t => t === 'Duplicate').length;
    assert.strictEqual(count, 1);
  });

  test('should remove a tag', () => {
    tagManager.removeTag('x Cut');
    assert.ok(!tagManager.getTags().includes('x Cut'));
    
    // Verify persistence
    const stored = JSON.parse(localStorage.getItem('quick_tags'));
    assert.ok(!stored.includes('x Cut'));
  });
});

describe('Quick Tag Click Interaction', () => {
  let mockSocket;
  let mockSession;

  beforeEach(() => {
    mockSocket = {
      send: (type, payload) => {
        mockSocket.lastMessage = { type, ...payload };
      }
    };
    mockSession = {
      started_at: new Date().toISOString()
    };
    global.socket = mockSocket;
    global.currentSession = mockSession;
    global.selectedColor = '#FF4D4D';
  });

  test('should send CREATE_NOTE event on tag click', () => {
    const tagName = 'x Cut';
    
    // Mock the click handler logic from renderQuickTags
    const handleTagClick = (tag) => {
      const timestamp = (global.currentSession && global.currentSession.started_at) 
          ? (Date.now() - new Date(global.currentSession.started_at).getTime()) / 1000 
          : 0;
      global.socket.send('CREATE_NOTE', {
          payload: { content: tag, timestamp, color: global.selectedColor }
      });
    };

    handleTagClick(tagName);

    assert.strictEqual(mockSocket.lastMessage.type, 'CREATE_NOTE');
    assert.strictEqual(mockSocket.lastMessage.payload.content, tagName);
    assert.strictEqual(mockSocket.lastMessage.payload.color, '#FF4D4D');
    assert.ok(mockSocket.lastMessage.payload.timestamp >= 0);
  });
});
