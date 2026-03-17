import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
// Vitest globals provide 'vi' and 'jest' compatibility if configured, 
// but we'll use 'vi' explicitly in tests.
