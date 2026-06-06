import { test, describe } from 'node:test';
import assert from 'node:assert';

// Replicating new logic for unit testing: simple numeric comparison of UTC milliseconds
function compareTimestamps(t1, t2) {
    if (t1 < t2) return -1;
    if (t1 > t2) return 1;
    return 0;
}

describe('Timestamp Comparison Logic (UTC Milliseconds)', () => {
    test('normal sequential order (t1 < t2)', () => {
        assert.strictEqual(compareTimestamps(100, 200), -1);
        assert.strictEqual(compareTimestamps(3600000, 7200000), -1);
    });

    test('normal sequential order (t1 > t2)', () => {
        assert.strictEqual(compareTimestamps(200, 100), 1);
        assert.strictEqual(compareTimestamps(7200000, 3600000), 1);
    });

    test('equality', () => {
        assert.strictEqual(compareTimestamps(500, 500), 0);
    });

    test('crosses midnight boundary (no wrap-around needed)', () => {
        // With UTC ms, midnight crossing is handled naturally
        const latePM = Date.parse('2024-01-01T23:59:00Z');
        const earlyAM = Date.parse('2024-01-02T00:01:00Z');

        // earlyAM should be LATER than latePM (no wrap-around logic needed)
        assert.strictEqual(compareTimestamps(latePM, earlyAM), -1);
        assert.strictEqual(compareTimestamps(earlyAM, latePM), 1);
    });

    test('crosses date boundary across weeks', () => {
        const monday = Date.parse('2024-01-01T10:00:00Z');
        const wednesday = Date.parse('2024-01-03T14:00:00Z');
        assert.strictEqual(compareTimestamps(monday, wednesday), -1);
    });

    test('large UTC ms values (modern epoch)', () => {
        const t1 = 1704067200000; // 2024-01-01T00:00:00Z
        const t2 = 1704153600000; // 2024-01-02T00:00:00Z
        assert.strictEqual(compareTimestamps(t1, t2), -1);
        assert.strictEqual(compareTimestamps(t2, t1), 1);
    });
});
