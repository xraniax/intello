import path from 'path';
import fs from 'fs';
import { query } from '../utils/config/db.js';
import asyncHandler from '../utils/asyncHandler.js';

// Resolved once at startup — all stored paths must be children of this directory.
const UPLOAD_BASE = path.resolve(process.env.PDF_STORAGE_PATH || '/app/data/uploads');

// Loose UUID v4 check — prevents obviously bad input from hitting the DB.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const download = asyncHandler(async (req, res) => {
    const { document_id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    console.log(`[files] request document_id=${document_id} user_id=${userId}`);

    if (!UUID_RE.test(document_id)) {
        return res.status(404).json({ message: 'Document not found' });
    }

    // Resolve file record — no user_id filter here so admin path works too.
    const result = await query(
        `SELECT f.path, f.mime_type, f.original_name, f.user_id
         FROM files f
         JOIN materials m ON f.material_id = m.id
         WHERE m.id = $1
           AND m.deleted_at IS NULL
         LIMIT 1`,
        [document_id]
    );

    const record = result.rows[0];

    if (!record) {
        console.log(`[files] 404 document_id=${document_id} user_id=${userId} reason=not_found`);
        return res.status(404).json({ message: 'Document not found' });
    }

    if (!isAdmin && record.user_id !== userId) {
        console.log(`[files] 403 document_id=${document_id} user_id=${userId} reason=ownership`);
        return res.status(403).json({ message: 'Access denied' });
    }

    // Resolve the stored path and confirm it is strictly inside UPLOAD_BASE.
    // path.resolve handles any embedded "../" sequences before the check.
    const resolvedPath = path.resolve(record.path);
    if (!resolvedPath.startsWith(UPLOAD_BASE + path.sep)) {
        console.error(
            `[files] path_escape document_id=${document_id} stored_path=${record.path} resolved=${resolvedPath}`
        );
        return res.status(500).json({ message: 'Internal error' });
    }

    if (!fs.existsSync(resolvedPath)) {
        console.log(`[files] 410 document_id=${document_id} user_id=${userId} reason=missing_on_disk`);
        return res.status(410).json({ message: 'File no longer available' });
    }

    const encodedName = encodeURIComponent(
        record.original_name || path.basename(resolvedPath)
    );
    res.setHeader('Content-Type', record.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedName}`);

    console.log(`[files] 200 document_id=${document_id} user_id=${userId} path=${resolvedPath}`);

    res.sendFile(resolvedPath);
});

export default { download };
