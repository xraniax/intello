import { PDFParse } from 'pdf-parse';
import fs from 'fs';

try {
    const testPdf = '/home/rania/cognify/backend/uploads/file-1773221563356-BigData_TP1.pdf';
    const buffer = fs.readFileSync(testPdf);

    console.log('Buffer read, size:', buffer.length);

    // According to d.ts, constructor takes LoadParameters. 
    // Usually pdf-parse v1 took buffer directly. Let's see if options can be the buffer.
    const parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();

    console.log('Success! Extracted text length:', textResult.text.length);
    console.log('Total pages:', textResult.pages.length);
} catch (err) {
    console.error('Error during PDFParse execution:', err.message);
    if (err.stack) console.error(err.stack);
}
