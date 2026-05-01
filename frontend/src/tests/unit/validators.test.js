import { describe, it, expect } from 'vitest';
import {
    validateEmail,
    validatePassword,
    validateName,
    validateRequired,
    validateSubjectName,
} from '../../utils/validators';

// ─── validateEmail ────────────────────────────────────────────────────────────

describe('validateEmail', () => {
    it('accepts a well-formed email address', () => {
        expect(validateEmail('alice@example.com').valid).toBe(true);
    });

    it('accepts emails with subdomains', () => {
        expect(validateEmail('user@mail.example.co.uk').valid).toBe(true);
    });

    it('rejects an empty string', () => {
        const result = validateEmail('');
        expect(result.valid).toBe(false);
        expect(result.message).toMatch(/required/i);
    });

    it('rejects null/undefined', () => {
        expect(validateEmail(null).valid).toBe(false);
        expect(validateEmail(undefined).valid).toBe(false);
    });

    it('rejects an address without @', () => {
        const result = validateEmail('noatsign.com');
        expect(result.valid).toBe(false);
        expect(result.message).toMatch(/valid email/i);
    });

    it('rejects an address without a domain', () => {
        expect(validateEmail('alice@').valid).toBe(false);
    });

    it('rejects an address with spaces', () => {
        expect(validateEmail('alice @example.com').valid).toBe(false);
    });
});

// ─── validatePassword ─────────────────────────────────────────────────────────

describe('validatePassword', () => {
    it('accepts a password of exactly 8 characters', () => {
        expect(validatePassword('12345678').valid).toBe(true);
    });

    it('accepts a long password', () => {
        expect(validatePassword('a'.repeat(64)).valid).toBe(true);
    });

    it('rejects an empty password', () => {
        const result = validatePassword('');
        expect(result.valid).toBe(false);
        expect(result.message).toMatch(/required/i);
    });

    it('rejects null', () => {
        expect(validatePassword(null).valid).toBe(false);
    });

    it('rejects a password shorter than 8 characters', () => {
        const result = validatePassword('short');
        expect(result.valid).toBe(false);
        expect(result.message).toMatch(/8 characters/i);
    });

    it('rejects a 7-character password (boundary)', () => {
        expect(validatePassword('1234567').valid).toBe(false);
    });
});

// ─── validateName ─────────────────────────────────────────────────────────────

describe('validateName', () => {
    it('accepts a name with 2 or more non-whitespace characters', () => {
        expect(validateName('Al').valid).toBe(true);
        expect(validateName('Alice Smith').valid).toBe(true);
    });

    it('rejects an empty name', () => {
        const result = validateName('');
        expect(result.valid).toBe(false);
        expect(result.message).toMatch(/required/i);
    });

    it('rejects a name that is only one character', () => {
        const result = validateName('A');
        expect(result.valid).toBe(false);
        expect(result.message).toMatch(/2 characters/i);
    });

    it('rejects null', () => {
        expect(validateName(null).valid).toBe(false);
    });
});

// ─── validateRequired ─────────────────────────────────────────────────────────

describe('validateRequired', () => {
    it('accepts a non-empty string', () => {
        expect(validateRequired('hello').valid).toBe(true);
    });

    it('rejects an empty string', () => {
        const result = validateRequired('', 'Title');
        expect(result.valid).toBe(false);
        expect(result.message).toContain('Title');
    });

    it('rejects a whitespace-only string', () => {
        expect(validateRequired('   ').valid).toBe(false);
    });

    it('rejects null and undefined', () => {
        expect(validateRequired(null).valid).toBe(false);
        expect(validateRequired(undefined).valid).toBe(false);
    });
});

// ─── validateSubjectName ─────────────────────────────────────────────────────

describe('validateSubjectName', () => {
    it('accepts a name within the 2–50 character range', () => {
        expect(validateSubjectName('Biology 101').valid).toBe(true);
    });

    it('rejects an empty name', () => {
        expect(validateSubjectName('').valid).toBe(false);
    });

    it('rejects a name shorter than 2 characters', () => {
        const result = validateSubjectName('A');
        expect(result.valid).toBe(false);
        expect(result.message).toMatch(/too short/i);
    });

    it('rejects a name longer than 50 characters', () => {
        const result = validateSubjectName('A'.repeat(51));
        expect(result.valid).toBe(false);
        expect(result.message).toMatch(/too long/i);
    });

    it('accepts a name of exactly 50 characters (boundary)', () => {
        expect(validateSubjectName('A'.repeat(50)).valid).toBe(true);
    });

    it('accepts a name of exactly 2 characters (boundary)', () => {
        expect(validateSubjectName('AB').valid).toBe(true);
    });
});
