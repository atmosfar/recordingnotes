import { test, describe } from 'node:test';
import assert from 'node:assert';

// Replicating logic for unit testing
function compareTimestamps(t1, t2) {
    const halfDay = 43200; 
    const diff = t1 - t2;

    if (Math.abs(diff) > halfDay) {
        return diff > 0 ? -1 : 1;
    }

    if (diff < 0) return -1;
    if (diff > 0) return 1;
    return 0;
}

describe('Timestamp Comparison Logic', () => {
    test('normal sequential order (t1 < t2)', () => {
        assert.strictEqual(compareTimestamps(100, 200), -1);
        assert.strictEqual(compareTimestamps(3600, 7200), -1);
    });

    test('normal sequential order (t1 > t2)', () => {
        assert.strictEqual(compareTimestamps(200, 100), 1);
        assert.strictEqual(compareTimestamps(7200, 3600), 1);
    });

    test('equality', () => {
        assert.strictEqual(compareTimestamps(500, 500), 0);
    });

    test('midnight wrap-around (11:59 PM vs 12:01 AM)', () => {
        const latePM = 86340; // 23:59:00
        const earlyAM = 60;    // 00:01:00
        
        // earlyAM (60) should be considered LATER than latePM (86340)
        assert.strictEqual(compareTimestamps(latePM, earlyAM), -1);
        assert.strictEqual(compareTimestamps(earlyAM, latePM), 1);
    });

    test('large gap without wrap-around (e.g., 10 AM vs 4 PM)', () => {
        const tenAM = 36000;
        const fourPM = 57600;
        assert.strictEqual(compareTimestamps(tenAM, fourPM), -1);
    });
});
