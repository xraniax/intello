import multer from 'multer';
import path from 'path';

/**
 * Multer disk storage configuration.
 * Files are saved to the `uploads/` directory with a timestamped, unique filename.
 */
const storage = multer.diskStorage({
  destination: 'uploads',
  filename: (req, file, cb) => {
    // Sanitize the original filename to prevent directory traversal
    const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${file.fieldname}-${Date.now()}-${safeName}`);
  },
});

/**
 * File filter: only allow PDF files.
 * Checks both the MIME type and the file extension for defence-in-depth.
 */
const pdfOnlyFilter = (req, file, cb) => {
  const mimeOk = file.mimetype === 'application/pdf';
  const extOk = path.extname(file.originalname).toLowerCase() === '.pdf';

  if (mimeOk && extOk) {
    cb(null, true); // Accept file
  } else {
    // Pass an error with a status code so errorHandler can render it correctly
    const err = new Error('Only PDF files are allowed. Please upload a file with a .pdf extension.');
    err.statusCode = 400;
    cb(err, false); // Reject file
  }
};

/**
 * Pre-configured multer instance for PDF-only uploads.
 *   - Maximum file size: 10 MB
 *   - Only .pdf files accepted (MIME + extension check)
 *   - Files stored on disk in the `uploads/` directory
 */
export const pdfUpload = multer({
  storage,
  fileFilter: pdfOnlyFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

// Keep the raw storage export for any other use-case
export { storage };

