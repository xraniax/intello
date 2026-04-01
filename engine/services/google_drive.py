import os
import logging
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
import io

logger = logging.getLogger("engine-google-drive")

# Configuration from environment
GOOGLE_SERVICE_ACCOUNT_FILE = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "service-account.json")
# Optional: The ID of a specific Google Drive folder where everything should be uploaded
GOOGLE_DRIVE_FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID")

def get_drive_service():
    """Initialize and return the Google Drive API service."""
    creds_file = GOOGLE_SERVICE_ACCOUNT_FILE
    
    if not os.path.exists(creds_file):
        # Fallback for when the file is in the credentials folder alongside this script
        fallback = os.path.join(os.path.dirname(__file__), "credentials", os.path.basename(creds_file))
        if os.path.exists(fallback):
            creds_file = fallback
        else:
            logger.error(f"Service account file not found at: {GOOGLE_SERVICE_ACCOUNT_FILE}")
            raise FileNotFoundError(f"Google Service Account file missing: {GOOGLE_SERVICE_ACCOUNT_FILE}")
    
    # We only need the 'drive' scope to upload and manage files created by this app
    scopes = ['https://www.googleapis.com/auth/drive']
    creds = service_account.Credentials.from_service_account_file(
        creds_file, scopes=scopes
    )
    return build('drive', 'v3', credentials=creds)

async def upload_file_to_drive(file, filename: str) -> str:
    """Read the uploaded file asynchronously and upload to Google Drive."""
    if not GOOGLE_DRIVE_FOLDER_ID:
        raise ValueError("Missing GOOGLE_DRIVE_FOLDER_ID in environment")
        
    try:
        service = get_drive_service()
        
        # Read the file content asynchronously
        content = await file.read()
        file_stream = io.BytesIO(content)
        
        file_metadata = {
            'name': filename,
            'parents': [GOOGLE_DRIVE_FOLDER_ID]
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
        
    except Exception as e:
        logger.error(f"Google Drive upload failed: {str(e)}")
        raise RuntimeError(f"Google Drive upload failed: {str(e)}") from e


async def upload_file_to_drive_from_bytes(content: bytes, filename: str) -> str:
    """Upload raw bytes to Google Drive and return file_id."""
    if not GOOGLE_DRIVE_FOLDER_ID:
        raise ValueError("Missing GOOGLE_DRIVE_FOLDER_ID in environment")
        
    try:
        service = get_drive_service()
        
        file_stream = io.BytesIO(content)
        
        file_metadata = {
            'name': filename,
            'parents': [GOOGLE_DRIVE_FOLDER_ID]
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
        
    except Exception as e:
        logger.error(f"Google Drive upload failed: {str(e)}")
        raise RuntimeError(f"Google Drive upload failed: {str(e)}") from e
