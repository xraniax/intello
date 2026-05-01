/**
 * Diagnostic script: Compare working vs broken PDF file access.
 * 
 * This script:
 * 1. Queries the database for files
 * 2. For each file, checks:
 *    - DB record (stored path, filename, size)
 *    - Resolved filesystem path
 *    - File existence (fs.existsSync)
 *    - Actual file size on disk
 *    - File permissions
 *    - Generated access URLs
 * 3. Identifies patterns in working vs broken files
 */

import { query } from './src/utils/config/db.js';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const uploadStoragePath = process.env.PDF_STORAGE_PATH || 'uploads';
const normalizedUploadPath = path.isAbsolute(uploadStoragePath)
  ? uploadStoragePath
  : path.resolve(uploadStoragePath);

console.log(`\n${'='.repeat(80)}`);
console.log('PDF ACCESS DIAGNOSTIC TOOL');
console.log(`${'='.repeat(80)}`);
console.log(`Upload Storage Path (env): ${uploadStoragePath}`);
console.log(`Normalized Upload Path: ${normalizedUploadPath}`);
console.log(`Upload Directory Exists: ${fs.existsSync(normalizedUploadPath)}`);
if (fs.existsSync(normalizedUploadPath)) {
  try {
    const stats = fs.statSync(normalizedUploadPath);
    console.log(`Upload Directory Permissions: ${stats.mode.toString(8)}`);
  } catch (err) {
    console.log(`Upload Directory Permissions: Error - ${err.message}`);
  }
}
console.log(`${'='.repeat(80)}\n`);

async function diagnoseFileAccess() {
  try {
    // Fetch all files from database
    const result = await query(
      `SELECT f.*, u.email as user_email, s.name as subject_name, m.title as material_title
       FROM files f
       JOIN users u ON f.user_id = u.id
       LEFT JOIN subjects s ON f.subject_id = s.id
       LEFT JOIN materials m ON f.material_id = m.id
       ORDER BY f.created_at DESC
       LIMIT 50`
    );

    const files = result.rows;
    console.log(`\nTotal files in database: ${files.length}\n`);

    if (files.length === 0) {
      console.log('No files found in database.');
      process.exit(0);
    }

    let accessibleCount = 0;
    let inaccessibleCount = 0;
    const issues = [];

    for (const file of files) {
      console.log(`${'─'.repeat(80)}`);
      console.log(`FILE ID: ${file.id}`);
      console.log(`Material: ${file.material_title || 'N/A'}`);
      console.log(`User: ${file.user_email}`);
      console.log(`Subject: ${file.subject_name || 'N/A'}`);
      console.log(`Original Name: ${file.original_name}`);
      console.log(`\nDB Record:`);
      console.log(`  Filename: ${file.filename}`);
      console.log(`  DB Stored Path: ${file.path}`);
      console.log(`  DB Size: ${(file.size_bytes / 1024 / 1024).toFixed(2)} MB (${file.size_bytes} bytes)`);
      console.log(`  MIME Type: ${file.mime_type}`);
      console.log(`  Created: ${file.created_at}`);

      // Resolve filesystem paths
      const dbStoredPath = file.path;
      
      // Try to resolve the path
      let resolvedPath = null;
      let pathResolution = 'UNRESOLVED';
      
      // Try 1: If DB path is absolute and exists
      if (path.isAbsolute(dbStoredPath) && fs.existsSync(dbStoredPath)) {
        resolvedPath = dbStoredPath;
        pathResolution = 'ABSOLUTE_PATH_FROM_DB';
      }
      // Try 2: Assume it's relative to normalized upload path and just the filename
      else if (fs.existsSync(path.join(normalizedUploadPath, path.basename(dbStoredPath)))) {
        resolvedPath = path.join(normalizedUploadPath, path.basename(dbStoredPath));
        pathResolution = 'BASENAME_IN_UPLOAD_DIR';
      }
      // Try 3: Try the full path relative to normalized upload path
      else if (fs.existsSync(path.join(normalizedUploadPath, dbStoredPath))) {
        resolvedPath = path.join(normalizedUploadPath, dbStoredPath);
        pathResolution = 'RELATIVE_TO_UPLOAD_DIR';
      }

      console.log(`\nFilesystem Resolution:`);
      console.log(`  Resolution Method: ${pathResolution}`);
      console.log(`  Attempted Absolute Path: ${dbStoredPath}`);
      console.log(`  Attempted Basename: ${path.join(normalizedUploadPath, path.basename(dbStoredPath))}`);
      console.log(`  Attempted Relative: ${path.join(normalizedUploadPath, dbStoredPath)}`);

      if (resolvedPath) {
        console.log(`  ✓ RESOLVED: ${resolvedPath}`);
        const exists = fs.existsSync(resolvedPath);
        console.log(`  File Exists (fs.existsSync): ${exists}`);

        if (exists) {
          try {
            const stats = fs.statSync(resolvedPath);
            const diskSize = stats.size;
            const diskSizeMB = (diskSize / 1024 / 1024).toFixed(2);
            console.log(`  ✓ File Size on Disk: ${diskSizeMB} MB (${diskSize} bytes)`);
            console.log(`  File Permissions: ${stats.mode.toString(8)}`);
            console.log(`  Readable: ${(stats.mode & fs.constants.R_OK) !== 0 ? 'Yes' : 'No'}`);
            console.log(`  Last Modified: ${stats.mtime}`);

            // Check for size mismatch
            if (diskSize === 0) {
              inaccessibleCount++;
              issues.push({
                fileId: file.id,
                reason: 'ZERO_BYTE_FILE',
                details: `${file.original_name} is 0 bytes on disk`
              });
              console.log(`  ⚠️ WARNING: File is 0 bytes (corrupted or incomplete upload)`);
            } else if (Math.abs(diskSize - file.size_bytes) > 100) {
              issues.push({
                fileId: file.id,
                reason: 'SIZE_MISMATCH',
                details: `DB: ${file.size_bytes} bytes, Disk: ${diskSize} bytes`
              });
              console.log(`  ⚠️ WARNING: Size mismatch between DB and disk`);
            } else {
              accessibleCount++;
              console.log(`  ✓ ACCESSIBLE`);
            }
          } catch (err) {
            inaccessibleCount++;
            issues.push({
              fileId: file.id,
              reason: 'STAT_ERROR',
              details: err.message
            });
            console.log(`  ✗ Error reading file stats: ${err.message}`);
          }
        } else {
          inaccessibleCount++;
          issues.push({
            fileId: file.id,
            reason: 'FILE_NOT_FOUND',
            details: `Resolved path does not exist: ${resolvedPath}`
          });
          console.log(`  ✗ INACCESSIBLE: File not found at resolved path`);
        }
      } else {
        inaccessibleCount++;
        issues.push({
          fileId: file.id,
          reason: 'PATH_RESOLUTION_FAILED',
          details: `Could not resolve DB path: ${dbStoredPath}`
        });
        console.log(`  ✗ INACCESSIBLE: Could not resolve path from database record`);
      }

      // Generated URLs
      console.log(`\nGenerated Access URLs:`);
      const filename = path.basename(dbStoredPath);
      console.log(`  /uploads/${filename}`);
      console.log(`  /app/data/uploads/${filename}`);
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('SUMMARY');
    console.log(`${'='.repeat(80)}`);
    console.log(`Total Files Checked: ${files.length}`);
    console.log(`Accessible: ${accessibleCount}`);
    console.log(`Inaccessible: ${inaccessibleCount}`);
    console.log(`Success Rate: ${((accessibleCount / files.length) * 100).toFixed(1)}%`);

    if (issues.length > 0) {
      console.log(`\n${'='.repeat(80)}`);
      console.log('ISSUES FOUND');
      console.log(`${'='.repeat(80)}`);
      
      const issuesByReason = {};
      for (const issue of issues) {
        if (!issuesByReason[issue.reason]) {
          issuesByReason[issue.reason] = [];
        }
        issuesByReason[issue.reason].push(issue);
      }

      for (const [reason, items] of Object.entries(issuesByReason)) {
        console.log(`\n${reason} (${items.length} files):`);
        items.slice(0, 5).forEach((item, idx) => {
          console.log(`  ${idx + 1}. File ID ${item.fileId}: ${item.details}`);
        });
        if (items.length > 5) {
          console.log(`  ... and ${items.length - 5} more`);
        }
      }
    }

    console.log(`\n${'='.repeat(80)}\n`);
    process.exit(0);
  } catch (error) {
    console.error('Error during diagnosis:', error);
    process.exit(1);
  }
}

diagnoseFileAccess();
