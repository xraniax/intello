import multer from 'multer';
import path from 'path';
import SettingsService from '../../services/settings.service.js';

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
 * Middleware for PDF uploads using dynamic limits from DB.
 */
export const pdfUpload = async (req, res, next) => {
  try {
    const controls = await SettingsService.getStorageControls();
    const maxSizeBytes = (controls?.max_file_size_mb || 10) * 1024 * 1024;

    const upload = multer({
      storage,
      fileFilter: pdfOnlyFilter,
      limits: { fileSize: maxSizeBytes }
    }).single('file');

    upload(req, res, function (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        const customErr = new Error(`File too large. Max allowed size is ${controls.max_file_size_mb}MB.`);
        customErr.statusCode = 400;
        return next(customErr);
      } else if (err) {
        return next(err);
      }
      next();
    });
  } catch (error) {
    next(error);
  }
};

// Keep the raw storage export for any other use-case
export { storage };

