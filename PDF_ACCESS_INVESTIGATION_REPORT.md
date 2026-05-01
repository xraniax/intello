# PDF File Access Investigation & Fix

## Executive Summary

**Root Cause Found and Fixed**: The `PDF_STORAGE_PATH` environment variable was set to `/tmp` (ephemeral) instead of `/app/data/uploads` (persistent Docker volume). This caused uploaded PDFs to be inaccessible after container restarts.

---

## Investigation Process

### 1. Configuration Analysis

#### Docker-Compose Setup (Correct)
- **Volume Mount**: `./data/uploads:/app/data/uploads` ✓
- **Environment Variable**: `PDF_STORAGE_PATH=/app/data/uploads` ✓

```yaml
# docker-compose.yml (lines 39-41)
volumes:
  - ./data/uploads:/app/data/uploads
environment:
  - PDF_STORAGE_PATH=/app/data/uploads
```

#### Backend Configuration (Was Incorrect)
- **File**: `backend/.env`
- **Original Value**: `PDF_STORAGE_PATH=/tmp` ✗
- **Issue**: This overrode the docker-compose environment variable

**Why it happened**: The Node.js `dotenv` package loads .env files AFTER docker-compose environment variables are set, causing the docker-compose values to be overridden.

### 2. File Upload Path Analysis

#### Multer Configuration
- **Location**: `backend/src/utils/config/multer.js`
- **Behavior**: Files are saved to the path specified by `PDF_STORAGE_PATH` environment variable
- **Filename Format**: `{timestamp}-{random}.pdf` (e.g., `1777475471119-320681748.pdf`)

```javascript
const destPath = process.env.PDF_STORAGE_PATH || path.resolve('uploads');
```

#### Database Storage
- **Model**: `backend/src/models/file.model.js`
- **Fields**: 
  - `path`: The full filesystem path where the file is stored
  - `filename`: The generated filename
  - `original_name`: User-provided filename
  - `size_bytes`: File size on disk

### 3. File Serving Configuration

#### Static Routes (backend/src/app.js)
```javascript
app.use('/uploads', relaxFramingHeaders, express.static(normalizedUploadPath));
app.use('/app/data/uploads', relaxFramingHeaders, express.static(normalizedUploadPath));
```

**Both routes serve from the same directory**: `normalizedUploadPath`, which is derived from `PDF_STORAGE_PATH`.

#### Working PDF Example
```
HTTP Request:   GET /app/data/uploads/1777475471119-320681748.pdf
Status:         200 OK
File Exists:    YES (on persistent volume)
Access URL:     http://localhost:5000/app/data/uploads/1777475471119-320681748.pdf
                OR http://localhost:5000/uploads/1777475471119-320681748.pdf
```

---

## The Problem Scenario

### Before Container Restart (Files in /tmp)
1. User uploads PDF → Multer saves to `/tmp/1234567890-123456789.pdf` (ephemeral storage)
2. Database records: `path=/tmp/1234567890-123456789.pdf`
3. Frontend accesses: ✓ File accessible (still in /tmp)

### After Container Restart
1. `/tmp` is cleared (ephemeral storage in Docker)
2. Database still references: `path=/tmp/1234567890-123456789.pdf`
3. Frontend requests same URL → express.static looks in `normalizedUploadPath` (now resolves to wherever PDF_STORAGE_PATH points)
4. File not found → **404 Not Found**

### With Persistent Volume (/app/data/uploads)
1. Files persisted through container restarts
2. Database references remain valid
3. Files always accessible regardless of container lifecycle

---

## Solutions Implemented

### 1. Primary Fix: Configuration Correction

**File**: `backend/.env`
```diff
- PDF_STORAGE_PATH=/tmp
+ PDF_STORAGE_PATH=/app/data/uploads
```

This change ensures:
- All NEW uploads are saved to the persistent Docker volume
- Environment variable aligns with docker-compose.yml
- Files survive container restarts

### 2. Secondary Fix: Comprehensive Logging

**File**: `backend/src/app.js`

Added `fileAccessLogger` middleware that logs every file access attempt with:
- Requested URL (`/uploads/...` or `/app/data/uploads/...`)
- Resolved filesystem path
- File existence check (`fs.existsSync`)
- File size on disk
- User authentication status
- Timestamp

```javascript
const fileAccessLogger = (req, res, next) => {
  const requestedUrl = req.originalUrl;
  const resolvedPath = path.resolve(normalizedUploadPath, filename);
  const exists = fs.existsSync(resolvedPath);
  
  console.log(`
[FileAccessLog] ${new Date().toISOString()}
  Requested URL: ${requestedUrl}
  Resolved Path: ${resolvedPath}
  File Exists: ${exists}
  ...
  `);
  
  next();
};
```

**Log Output Example**:
```
[FileAccessLog] 2026-05-01T20:07:38.000Z
  Requested URL: /app/data/uploads/1777475471119-320681748.pdf
  Requested Path: /app/data/uploads/1777475471119-320681748.pdf
  Filename: 1777475471119-320681748.pdf
  Upload Storage Path (env): /app/data/uploads
  Normalized Upload Path: /app/data/uploads
  Resolved Filesystem Path: /app/data/uploads/1777475471119-320681748.pdf
  File Exists (fs.existsSync): true
  File Size: 2.70 MB (2825412 bytes)
  User: 12e4a5b8-f9c2-4a3d-b8e6-1a2b3c4d5e6f
  Auth Status: authenticated
```

### 3. Diagnostic Tools Created

#### `backend/diagnose_pdf_access.js`
- Queries database for all files
- For each file:
  - Checks DB record (stored path, size, MIME type)
  - Attempts to resolve filesystem path (3 strategies)
  - Verifies file existence
  - Checks file permissions and actual disk size
  - Identifies discrepancies and patterns
- Produces summary report of accessible vs inaccessible files
- Lists issues with categorization (ZERO_BYTE, PATH_RESOLUTION_FAILED, etc.)

#### `backend/diagnose_filesystem.sh`
- Lists files in `/app/data/uploads`
- Lists files in `/tmp` (old location)
- Shows directory permissions
- Displays environment variables

#### `backend/verify_pdf_fix.js`
- Verifies that all fixes have been applied
- Checks .env configuration
- Checks docker-compose.yml
- Checks app.js for logging middleware

---

## Docker Volume Persistence Verification

### Volume Configuration (docker-compose.yml)
```yaml
volumes:
  - ./data/uploads:/app/data/uploads    # Persistent host directory mounted
  - backend_node_modules:/app/node_modules

environment:
  - PDF_STORAGE_PATH=/app/data/uploads  # Points to persistent volume
```

### On Host Machine
```bash
$ ls -lah /home/rania/cognify/data/uploads/
total 13M
-rw-r--r-- 1 rania rania 235K Apr 29 08:01 1777446092551-455577627.pdf
-rw-r--r-- 1 rania rania 1.4M Apr 29 08:17 1777447072085-867665837.pdf
-rw-r--r-- 1 rania rania 2.3M Apr 29 08:20 1777447203344-671844248.pdf
-rw-r--r-- 1 rania rania 2.7M Apr 29 16:11 1777475471119-320681748.pdf  ← Working file
-rw-r--r-- 1 rania rania 1.4M May  1 20:05 file-1777314904001-...
```

**All files are persisted** on the host and will survive container restarts.

---

## Verification Steps

### Before Restart
```bash
# Check file exists
curl -I http://localhost:5000/app/data/uploads/1777475471119-320681748.pdf
# Expected: HTTP/1.1 200 OK
```

### Check Logs During Access
```bash
# Monitor file access logs
docker-compose logs -f backend | grep "FileAccessLog"
```

### After Containers Restart
```bash
# Stop and restart
docker-compose down
docker-compose up -d

# Same file should still be accessible
curl -I http://localhost:5000/app/data/uploads/1777475471119-320681748.pdf
# Expected: HTTP/1.1 200 OK (file still accessible)
```

---

## Summary of Changes

| File | Change | Purpose |
|------|--------|---------|
| `backend/.env` | `PDF_STORAGE_PATH=/tmp` → `/app/data/uploads` | Use persistent volume |
| `backend/src/app.js` | Added `fileAccessLogger` middleware | Log all file access attempts |
| `backend/diagnose_pdf_access.js` | Created | Database-aware file diagnostics |
| `backend/diagnose_filesystem.sh` | Created | Filesystem inspection tool |
| `backend/verify_pdf_fix.js` | Created | Verify fix implementation |

---

## Prevention Going Forward

1. **Configuration Management**
   - Always ensure .env values align with docker-compose.yml environment variables
   - Use docker-compose environment variables as source of truth
   - Document why persistent storage is needed

2. **Monitoring**
   - Monitor fileAccessLogger output for 404s or permission errors
   - Set up alerts for sudden increases in file access failures
   - Regularly audit DB file paths vs actual filesystem

3. **Backup & Recovery**
   - Regularly backup `/data/uploads` directory
   - Monitor disk space on persistent volume
   - Test container restarts to verify file persistence

---

## Technical Details

### Environment Variable Precedence
In Node.js with dotenv:
1. Process environment (docker-compose environment)
2. dotenv .env file ← OVERRIDES process environment
3. Default fallback

**Solution**: Either:
- Remove `PDF_STORAGE_PATH` from .env (let docker-compose provide it)
- OR keep them in sync (which is what we did)

### File Access Flow
```
Request → /uploads or /app/data/uploads
         ↓
app.use(fileAccessLogger)  ← Logs access attempt
         ↓
app.use(relaxFramingHeaders)  ← Removes frame-blocking headers
         ↓
express.static(normalizedUploadPath)  ← Serves from /app/data/uploads
         ↓
fs.existsSync + fs.readFile  ← Checks if file exists
         ↓
Response (200 if exists, 404 if not)
```

