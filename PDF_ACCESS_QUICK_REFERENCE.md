# PDF File Access - Quick Reference & Monitoring Guide

## ✅ What Was Fixed

| Issue | Cause | Fix |
|-------|-------|-----|
| Some PDFs inaccessible | `PDF_STORAGE_PATH=/tmp` (ephemeral) | Changed to `/app/data/uploads` (persistent volume) |
| Files lost after restart | Container restarts clear /tmp | Now using Docker volume mount |
| No visibility into failures | No logging on file access | Added comprehensive fileAccessLogger middleware |

---

## 🔍 How to Monitor File Access

### View Real-Time Logs
```bash
# Watch backend logs for file access events
docker-compose logs -f backend | grep "FileAccessLog"

# Output example:
# [FileAccessLog] 2026-05-01T20:07:38.000Z
#   Requested URL: /app/data/uploads/1777475471119-320681748.pdf
#   File Exists (fs.existsSync): true
#   File Size: 2.70 MB (2825412 bytes)
```

### Test File Access
```bash
# Test a specific PDF
curl -I http://localhost:5000/uploads/1777475471119-320681748.pdf

# Or via the app/data/uploads route
curl -I http://localhost:5000/app/data/uploads/1777475471119-320681748.pdf
```

### Check Directory Status
```bash
# From host machine
ls -lah /home/rania/cognify/data/uploads/

# From inside backend container
docker-compose exec backend ls -lah /app/data/uploads/
```

---

## 📊 Diagnostic Tools

### Run Full Diagnostic (in Docker)
```bash
# Must be run inside the backend container since it needs database access
docker-compose exec backend node diagnose_pdf_access.js
```

**Output includes**:
- Total files in database
- Accessible vs inaccessible count
- Path resolution success rate
- Specific issues (ZERO_BYTE_FILE, SIZE_MISMATCH, etc.)
- List of problematic files

### Verify Configuration
```bash
# Check that all fixes are applied
docker-compose exec backend node verify_pdf_fix.js
```

**Output confirms**:
- ✓ PDF_STORAGE_PATH set to /app/data/uploads
- ✓ Docker volume mounted correctly
- ✓ Logging middleware present

### List All Uploads
```bash
# From host
find /home/rania/cognify/data/uploads -type f -name "*.pdf" | sort -V

# From container
docker-compose exec backend find /app/data/uploads -type f -name "*.pdf"

# Get disk usage
docker-compose exec backend du -sh /app/data/uploads
```

---

## 🚀 After Applying Fixes

### Step 1: Restart Containers
```bash
docker-compose down
docker-compose up -d
```

### Step 2: Verify Persistence
```bash
# Test file still exists
curl -I http://localhost:5000/uploads/1777475471119-320681748.pdf
# Should return: 200 OK

# Check backend logs
docker-compose logs backend | grep "File Exists"
```

### Step 3: Test New Uploads
```bash
# Upload a new PDF via the frontend
# Then check logs
docker-compose logs backend | grep "FileAccessLog" | tail -1

# Verify file is in persistent storage
docker-compose exec backend ls -lh /app/data/uploads/ | grep $(date +%Y%m%d)
```

---

## 🐛 Troubleshooting

### Symptoms: 404 on PDF Access

**Check 1**: Verify env variable
```bash
docker-compose exec backend env | grep PDF_STORAGE_PATH
# Should print: PDF_STORAGE_PATH=/app/data/uploads
```

**Check 2**: Verify file exists
```bash
docker-compose exec backend ls -lh /app/data/uploads/FILENAME
# Should list the file with size > 0
```

**Check 3**: Check permissions
```bash
docker-compose exec backend ls -ld /app/data/uploads
# Should show rwx for owner or group
```

**Check 4**: Check logs
```bash
docker-compose logs backend | grep "FileAccessLog"
# Look for "File Exists (fs.existsSync): false"
```

### Symptoms: File Size Mismatch

```bash
# Compare database record size vs actual file size
docker-compose exec backend stat /app/data/uploads/FILENAME | grep Size
# vs check database:
docker-compose exec db psql -U postgres -d intello_db \
  -c "SELECT filename, size_bytes FROM files WHERE filename='FILENAME';"
```

### Symptoms: Permission Denied

```bash
# Check Docker user permissions
docker-compose exec backend whoami  # Should be 'node' or 'root'
docker-compose exec backend id      # Check uid/gid

# Check volume mount permissions
docker-compose exec backend ls -ld /app/data/uploads
# Should have write permission for the running user
```

---

## 📈 Performance & Disk Space

### Monitor Disk Usage
```bash
# Check current usage
docker-compose exec backend df -h /app/data/uploads

# Check largest files
docker-compose exec backend ls -lhS /app/data/uploads | head -10

# Total count and size
docker-compose exec backend "find /app/data/uploads -type f | wc -l && du -sh /app/data/uploads"
```

### Cleanup Old Files (if needed)
```bash
# List files older than 30 days
docker-compose exec backend find /app/data/uploads -type f -mtime +30 -ls

# Delete files older than 30 days (careful!)
docker-compose exec backend find /app/data/uploads -type f -mtime +30 -delete
```

---

## 📋 Environment Variables

### Critical Variables (must match)

**docker-compose.yml**:
```yaml
environment:
  - PDF_STORAGE_PATH=/app/data/uploads
```

**backend/.env**:
```env
PDF_STORAGE_PATH=/app/data/uploads
```

✅ Both must point to the same persistent location!

### Volume Mount Configuration

**docker-compose.yml**:
```yaml
volumes:
  - ./data/uploads:/app/data/uploads  # Host:Container mapping
```

This creates a symlink from host's `./data/uploads` to container's `/app/data/uploads`.

---

## 🔐 Security Considerations

### File Permissions
- Files created by Node.js process with permissions determined by umask
- Current: `-rw-r--r--` (644) - readable by all, writable by owner
- Consider: Setting stricter permissions if files contain sensitive data

### Access Control
- Static file routes are not protected by authentication middleware
- Files at `/uploads` and `/app/data/uploads` are directly accessible
- Consider: Adding authentication checks if needed

### Path Traversal Prevention
- Multer uses absolute path with UUID-based naming (prevents directory traversal)
- Filename format: `{timestamp}-{random}.pdf`
- No user-controllable path components in storage path

---

## 📞 For Support

If PDFs are still not accessible after these fixes:

1. **Collect information**:
   ```bash
   docker-compose logs backend > backend_logs.txt
   docker-compose exec backend node diagnose_pdf_access.js > diagnostics.txt
   ```

2. **Check the logs for patterns**:
   - `File Exists: false` → File missing from storage
   - `ZERO_BYTE_FILE` → Upload incomplete
   - `PATH_RESOLUTION_FAILED` → Path stored incorrectly in DB
   - Permission errors → Storage permissions issue

3. **Verify**: All three fixes are in place:
   - ✓ `backend/.env` has `PDF_STORAGE_PATH=/app/data/uploads`
   - ✓ `docker-compose.yml` has volume mount
   - ✓ `backend/src/app.js` has fileAccessLogger middleware

