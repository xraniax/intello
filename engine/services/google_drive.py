import os
import logging
from googleapiclient.http import MediaIoBaseUpload, MediaIoBaseDownload
import io
import tempfile
import time

from .google_client import (
    GoogleDriveConfigError,
    GoogleDriveNotConfiguredError,
    get_drive_service,
    get_google_drive_folder_id,
)

logger = logging.getLogger("engine-google-drive")

async def upload_file_to_drive(file, filename: str) -> str:
    """Read the uploaded file asynchronously and upload to Google Drive."""
    folder_id = get_google_drive_folder_id()
        
    try:
        service = get_drive_service()
        
        # Read the file content asynchronously
        content = await file.read()
        file_stream = io.BytesIO(content)
        
        file_metadata = {
            'name': filename,
            'parents': [folder_id]
        }
        
        media = MediaIoBaseUpload(
            file_stream, 
            mimetype=file.content_type or "application/octet-stream", 
            resumable=True
        )
        
        logger.info(f"Uploading {filename} to Google Drive...")
        uploaded_file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id',
            supportsAllDrives=True
        ).execute()
        
        file_id = uploaded_file.get('id')
        logger.info(f"Successfully uploaded {filename} with ID: {file_id}")
        return file_id
    except (GoogleDriveConfigError, GoogleDriveNotConfiguredError):
        raise
    except Exception as e:
        logger.error(f"Google Drive upload failed: {str(e)}")
        raise RuntimeError(f"Google Drive upload failed: {str(e)}") from e


async def upload_file_to_drive_from_bytes(content: bytes, filename: str, *, request_id: str | None = None) -> str:
    """Upload raw bytes to Google Drive and return file_id."""
    folder_id = get_google_drive_folder_id()
        
    try:
        started_at = time.time()
        service = get_drive_service()
        
        file_stream = io.BytesIO(content)
        
        file_metadata = {
            'name': filename,
            'parents': [folder_id]
        }
        
        # Detect mimetype from filename extension
        mimetype = "application/octet-stream"
        if filename.lower().endswith('.pdf'):
            mimetype = "application/pdf"
        elif filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            ext = filename.split('.')[-1].lower()
            if ext == 'jpg':
                ext = 'jpeg'
            mimetype = f"image/{ext}"
        
        media = MediaIoBaseUpload(
            file_stream, 
            mimetype=mimetype, 
            resumable=True
        )
        
        logger.info(
            "[PIPELINE] drive_upload request_id=%s filename=%s bytes=%d folder_id_set=%s",
            request_id,
            filename,
            len(content) if content is not None else 0,
            bool(folder_id),
        )
        uploaded_file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id',
            supportsAllDrives=True
        ).execute()
        
        file_id = uploaded_file.get('id')
        logger.info(
            "[PIPELINE] drive_upload_ok request_id=%s filename=%s drive_file_id=%s elapsed_ms=%d",
            request_id,
            filename,
            file_id,
            int((time.time() - started_at) * 1000),
        )
        return file_id
    except (GoogleDriveConfigError, GoogleDriveNotConfiguredError):
        raise
    except Exception as e:
        logger.error(f"Google Drive upload failed: {str(e)}")
        raise RuntimeError(f"Google Drive upload failed: {str(e)}") from e

def download_file_from_drive(file_id: str, *, request_id: str | None = None) -> str:
    """Download a file from Google Drive into a temporary file."""
    try:
        started_at = time.time()
        service = get_drive_service()
        
        # Get file metadata to determine the suffix
        file_metadata = service.files().get(
            fileId=file_id, 
            fields='name,size',
            supportsAllDrives=True
        ).execute()
        filename = file_metadata.get('name', 'downloaded_file')
        size = file_metadata.get('size')
        suffix = os.path.splitext(filename)[1].lower() or ".pdf"

        logger.info(
            "[PIPELINE] drive_download_start request_id=%s drive_file_id=%s name=%s size=%s",
            request_id,
            file_id,
            filename,
            size,
        )
        
        request = service.files().get_media(
            fileId=file_id,
            supportsAllDrives=True
        )
        
        fd, temp_path = tempfile.mkstemp(suffix=suffix)
        with os.fdopen(fd, 'wb') as f:
            downloader = MediaIoBaseDownload(f, request)
            done = False
            while done is False:
                status, done = downloader.next_chunk()

        try:
            downloaded_bytes = os.path.getsize(temp_path)
        except OSError:
            downloaded_bytes = -1
                
        logger.info(
            "[PIPELINE] drive_download_ok request_id=%s drive_file_id=%s tmp_path=%s bytes=%d elapsed_ms=%d",
            request_id,
            file_id,
            temp_path,
            downloaded_bytes,
            int((time.time() - started_at) * 1000),
        )
        return temp_path
    except (GoogleDriveConfigError, GoogleDriveNotConfiguredError):
        raise
    except Exception as e:
        logger.error(f"Failed to download file from Drive (ID: {file_id}): {str(e)}")
        raise RuntimeError(f"Failed to download file from Drive: {str(e)}") from e
def delete_file_from_drive(file_id: str) -> bool:
    """Delete a file from Google Drive by ID. Returns True if successful."""
    try:
        service = get_drive_service()
        service.files().delete(fileId=file_id, supportsAllDrives=True).execute()
        logger.info(f"Deleted file from Google Drive: {file_id}")
        return True
    except (GoogleDriveConfigError, GoogleDriveNotConfiguredError):
        raise
    except Exception as e:
        logger.error(f"Failed to delete file from Google Drive (ID: {file_id}): {str(e)}")
        return False


def list_files_in_folder() -> list:
    """Retrieve all files from the configured Google Drive folder."""
    try:
        folder_id = get_google_drive_folder_id()
        service = get_drive_service()
        
        query = f"'{folder_id}' in parents and trashed = false"
        logger.info(f"Listing files in Google Drive folder: {folder_id}")
        
        results = service.files().list(
            q=query,
            fields="files(id, name, mimeType, size, webViewLink, thumbnailLink)",
            supportsAllDrives=True,
            includeItemsFromAllDrives=True
        ).execute()
        
        files = results.get('files', [])
        logger.info(f"Found {len(files)} files in Google Drive folder.")
        return files
    except (GoogleDriveConfigError, GoogleDriveNotConfiguredError):
        raise
    except Exception as e:
        logger.error(f"Failed to list files in Google Drive folder: {str(e)}")
        raise RuntimeError(f"Failed to list files in Google Drive folder: {str(e)}") from e
