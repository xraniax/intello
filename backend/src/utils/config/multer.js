import multer from 'multer';
import path from 'path';
import SettingsService from '../../services/settings.service.js';
import AlertService from '../../services/alert.service.js';

import fs from 'fs';

// Use shared upload path in containers; local dev can override via PDF_STORAGE_PATH.
const destPath = process.env.PDF_STORAGE_PATH || path.resolve('uploads');
// Ensure the directory exists (crucial for freshly mounted NFS volumes or fresh clones)
fs.mkdirSync(destPath, { recursive: true });

/**
 * Multer disk storage configuration.
 * Files are persisted to disk to act as a fallback, enabling admin download
 * and correct metadata passing to processing pipelines.
 */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, destPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

/**
 * File filter: only allow supported document formats based on system rules.
 */
const documentOnlyFilter = (req, file, cb) => {
  const allowed = req.allowedMimeTypes || ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  const mimeOk = allowed.includes(file.mimetype);

  if (mimeOk) {
    cb(null, true);
  } else {
    const err = new Error(`File type prohibited. Allowed formats: ${allowed.join(', ')}.`);
    err.statusCode = 400;
    cb(err, false);
  }
};

/**
 * Middleware for document uploads using dynamic limits from DB.
 */
export const documentUpload = async (req, res, next) => {
  try {
    const controls = await SettingsService.getStorageControls();
    
    // Check if user has specific max_file_size_mb overrides in their settings JSON
    const userMaxFileSizeMb = req.user?.settings?.max_file_size_mb;
    const effectiveLimitMb = userMaxFileSizeMb || controls?.max_file_size_mb || 10;
    
    const maxSizeBytes = effectiveLimitMb * 1024 * 1024;
    
    // Pass allowed types to the filter via the request object
    req.allowedMimeTypes = controls?.allowed_types || ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

    const upload = multer({
      storage,
      fileFilter: documentOnlyFilter,
      limits: { fileSize: maxSizeBytes }
    }).single('file');

    upload(req, res, async function (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        const errorMsg = `File too large. Max allowed size is ${effectiveLimitMb}MB.`;
        await AlertService.triggerUploadFailure(req.user?.id, req.file?.originalname || 'Unknown File', errorMsg);
        const customErr = new Error(errorMsg);
        customErr.statusCode = 400;
        return next(customErr);
      } else if (err) {
        await AlertService.triggerUploadFailure(req.user?.id, req.file?.originalname || 'Unknown File', err.message);
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

