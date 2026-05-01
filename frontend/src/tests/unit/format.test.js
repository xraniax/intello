import { describe, it, expect } from 'vitest';
import { formatBytes } from '../../utils/format';

describe('formatBytes', () => {
    it('returns "0 B" for 0 bytes', () => {
        expect(formatBytes(0)).toBe('0 B');
    });

    it('returns "0 B" for null/undefined', () => {
        expect(formatBytes(null)).toBe('0 B');
        expect(formatBytes(undefined)).toBe('0 B');
    });

    it('formats bytes below 1 KB as bytes', () => {
        expect(formatBytes(512)).toBe('512 B');
    });

    it('formats exactly 1 KB', () => {
        expect(formatBytes(1024)).toBe('1 KB');
    });

    it('formats megabytes correctly', () => {
        expect(formatBytes(1024 * 1024)).toBe('1 MB');
        expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
    });

    it('formats gigabytes correctly', () => {
        expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('respects the decimals parameter', () => {
        expect(formatBytes(1536, 0)).toBe('2 KB'); // 1536 / 1024 = 1.5 → rounds to 2
        expect(formatBytes(1536, 1)).toBe('1.5 KB');
        expect(formatBytes(1536, 3)).toBe('1.5 KB'); // trailing zeros stripped by parseFloat
    });

    it('defaults to 2 decimal places', () => {
        // 1500 bytes = 1.46 KB (2 dp)
        const result = formatBytes(1500);
        expect(result).toMatch(/KB$/);
        expect(result).toContain('1.46');
    });
});
