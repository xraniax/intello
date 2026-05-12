import multer from 'multer';
import path from 'path';
import SettingsService from '../../services/settings.service.js';
import QuotaService from '../../services/quota.service.js';
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
    
    // 1. Single File Size Limit (for that user or app default)
    const userMaxFileSizeMb = req.user?.settings?.max_file_size_mb;
    const effectiveLimitMb = userMaxFileSizeMb || controls?.max_file_size_mb || 10;
    const maxSizeBytes = effectiveLimitMb * 1024 * 1024;
    
    // Fail Fast: Check Content-Length header before receiving any bytes
    const contentLength = parseInt(req.headers['content-length'] || '0');
    if (contentLength > 0) {
      // Check Single File Limit
      if (contentLength > maxSizeBytes) {
        const errorMsg = `File too large (header). Max allowed size is ${effectiveLimitMb}MB.`;
        return res.status(400).json({ status: 'error', message: errorMsg });
      }
      
      // Check Total User Quota (Fail fast)
      try {
        await QuotaService.checkUploadAllowance(req.user.id, contentLength);
      } catch (quotaErr) {
        return res.status(quotaErr.statusCode || 403).json({ 
          status: 'error', 
          message: quotaErr.message,
          code: quotaErr.code 
        });
      }
    }

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
        return res.status(400).json({ status: 'error', message: errorMsg });
      } else if (err) {
        await AlertService.triggerUploadFailure(req.user?.id, req.file?.originalname || 'Unknown File', err.message);
        return next(err);
      }

      if (!req.file) {
        return next(); // No file uploaded, might be a text-only material
      }

      // Final Quota Check (Verify with actual received size)
      try {
        await QuotaService.checkUploadAllowance(req.user.id, req.file.size);
        next();
      } catch (quotaErr) {
        // Clean up the uploaded file if quota check fails at the final step
        if (req.file.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(quotaErr.statusCode || 403).json({ 
          status: 'error', 
          message: quotaErr.message,
          code: quotaErr.code 
        });
      }
    });
  } catch (error) {
    next(error);
  }
};

// Keep the raw storage export for any other use-case
export { storage };

