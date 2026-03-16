import { extractTextFromPdf } from './src/services/pdfExtractor.service.js';
import path from 'path';

const testPdf = '/home/rania/cognify/backend/uploads/file-1773221563356-BigData_TP1.pdf';

try {
    const result = await extractTextFromPdf(testPdf);
    console.log('Success:', result.method, 'Chars:', result.text.length);
} catch (err) {
    console.error('Error:', err.message);
    if (err.stack) console.error(err.stack);
}
