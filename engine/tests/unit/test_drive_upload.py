"""
Google Drive Upload + Deletion Unit Tests

Scenarios:
1. upload_file_to_drive_from_bytes returns file_id
2. delete_file_from_drive succeeds
3. delete_file_from_drive handles errors
4. documents route constructs response with drive_file_id

Style: Direct function imports, no FastAPI fixtures, no startup events.
"""

import pytest
from unittest.mock import MagicMock, patch, AsyncMock
import io


# ─────────────────────────────────────────────────────────────────────────────
# Tests for upload_file_to_drive_from_bytes
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.unit
class TestUploadFileToDrive:
    """Tests for upload_file_to_drive_from_bytes function - direct import."""

    @pytest.mark.asyncio
    async def test_upload_returns_file_id(self):
        """Test 1: Upload returns Google Drive file_id string."""
        
        # Mock the Drive service and API
        mock_service = MagicMock()
        mock_files = MagicMock()
        mock_service.files.return_value = mock_files
        
        # Mock Drive API response
        mock_files.create.return_value.execute.return_value = {
            "id": "1aBcD123TestFileIdXYZ",
            "name": "test_upload.pdf"
        }
        
        with patch("services.google_drive.get_drive_service", return_value=mock_service), \
             patch("services.google_drive.get_google_drive_folder_id", return_value="folder123"):
            
            from services.google_drive import upload_file_to_drive_from_bytes
            
            test_content = b"%PDF-1.4 test pdf content"
            result = await upload_file_to_drive_from_bytes(
                test_content, 
                "test_upload.pdf",
                request_id="test-req-123"
            )
            
            # Verify result is the file_id string
            assert result == "1aBcD123TestFileIdXYZ"
            
            # Verify API was called correctly
            mock_files.create.assert_called_once()
            call_args = mock_files.create.call_args
            assert call_args.kwargs["body"]["name"] == "test_upload.pdf"
            assert call_args.kwargs["body"]["parents"] == ["folder123"]
            assert call_args.kwargs["fields"] == "id"

    @pytest.mark.asyncio
    async def test_upload_raises_on_drive_error(self):
        """Test 2: Upload propagates Drive errors as RuntimeError."""
        
        mock_service = MagicMock()
        mock_files = MagicMock()
        mock_service.files.return_value = mock_files
        
        # Simulate Drive API error
        mock_files.create.side_effect = Exception("Drive API Error: 403 Forbidden")
        
        with patch("services.google_drive.get_drive_service", return_value=mock_service), \
             patch("services.google_drive.get_google_drive_folder_id", return_value="folder123"):
            
            from services.google_drive import upload_file_to_drive_from_bytes
            
            with pytest.raises(RuntimeError) as exc_info:
                await upload_file_to_drive_from_bytes(b"content", "test.pdf")
            
            assert "Drive API Error" in str(exc_info.value)


# ─────────────────────────────────────────────────────────────────────────────
# Tests for delete_file_from_drive
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.unit
class TestDeleteFileFromDrive:
    """Tests for delete_file_from_drive function - direct import."""

    def test_delete_returns_true_on_success(self):
        """Test 1: Delete returns True when Drive API succeeds."""
        
        mock_service = MagicMock()
        mock_files = MagicMock()
        mock_service.files.return_value = mock_files
        
        # Drive delete returns empty dict on success
        mock_files.delete.return_value.execute.return_value = {}
        
        with patch("services.google_drive.get_drive_service", return_value=mock_service):
            from services.google_drive import delete_file_from_drive
            
            result = delete_file_from_drive("file-to-delete-123")
            
            assert result is True
            mock_files.delete.assert_called_once_with(
                fileId="file-to-delete-123",
                supportsAllDrives=True
            )

    def test_delete_returns_false_on_failure(self):
        """Test 2: Delete returns False (not raises) on API error."""
        
        mock_service = MagicMock()
        mock_files = MagicMock()
        mock_service.files.return_value = mock_files
        
        mock_files.delete.side_effect = Exception("File not found")
        
        with patch("services.google_drive.get_drive_service", return_value=mock_service):
            from services.google_drive import delete_file_from_drive
            
            # Should NOT raise, should return False
            result = delete_file_from_drive("non-existent-file")
            
            assert result is False


# ─────────────────────────────────────────────────────────────────────────────
# Tests for documents route response construction
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.unit
@pytest.mark.asyncio
class TestDocumentsRouteResponse:
    """Tests for /process-document response construction with drive_file_id."""

    async def test_response_includes_drive_file_id(self):
        """Test: Response includes drive_file_id when upload succeeds."""
        
        # Mock the upload helper to return a file_id
        with patch("services.routes.documents.upload_file_to_drive_from_bytes", 
                   return_value="abc123") as mock_upload, \
             patch("services.routes.documents.task_process_document") as mock_task:
            
            mock_task.delay.return_value = MagicMock(id="celery-job-456")
            
            # Import and test the endpoint function directly
            from services.routes.documents import process_document
            from fastapi import UploadFile
            import io
            
            # Create a mock UploadFile
            test_content = b"%PDF-1.4 test content"
            mock_file = MagicMock(spec=UploadFile)
            mock_file.filename = "test.pdf"
            mock_file.read = AsyncMock(return_value=test_content)
            
            # Build the mock request
            mock_request = MagicMock()
            mock_request.headers = {}
            mock_request.state = MagicMock()
            mock_request.state.request_id = "test-req-789"
            
            # Call the endpoint function directly
            response = await process_document(
                file=mock_file,
                document_id="doc-123",
                subject_id="sub-456",
                user_id="user-789",
                request=mock_request
            )
            
            # Verify response structure
            assert response["status"] == "accepted"
            assert response["stage"] == "processing"
            assert response["job_id"] == "celery-job-456"
            assert response["drive_file_id"] == "abc123"
            
            # Verify upload was called
            mock_upload.assert_called_once()

    async def test_response_no_drive_file_id_on_fallback(self):
        """Test: Response has no drive_file_id when Drive upload fails (local fallback)."""
        
        with patch("services.routes.documents.upload_file_to_drive_from_bytes",
                   side_effect=Exception("Drive unavailable")) as mock_upload, \
             patch("services.routes.documents.task_process_document_local") as mock_task, \
             patch("services.routes.documents.DEFAULT_UPLOADS_DIR", "/tmp/test-uploads"):
            
            mock_task.delay.return_value = MagicMock(id="local-job-789")
            
            from services.routes.documents import process_document
            from fastapi import UploadFile
            
            # Create mock file
            test_content = b"%PDF-1.4 test content"
            mock_file = MagicMock(spec=UploadFile)
            mock_file.filename = "local.pdf"
            mock_file.read = AsyncMock(return_value=test_content)
            
            # Mock request
            mock_request = MagicMock()
            mock_request.headers = {}
            mock_request.state = MagicMock()
            mock_request.state.request_id = "test-req-fallback"
            
            response = await process_document(
                file=mock_file,
                document_id="doc-local",
                subject_id="sub-local",
                user_id="user-local",
                request=mock_request
            )
            
            # Verify fallback response structure
            assert response["status"] == "accepted"
            assert response["stage"] == "processing"
            assert response["job_id"] == "local-job-789"
            # drive_file_id should NOT be present in fallback
            assert "drive_file_id" not in response
            assert "local processing" in response["message"].lower()

    async def test_job_queued_with_correct_drive_file_id(self):
        """Test: Celery task receives correct drive_file_id."""
        
        drive_id = "drive-id-for-celery-xyz"
        
        with patch("services.routes.documents.upload_file_to_drive_from_bytes",
                   return_value=drive_id) as mock_upload, \
             patch("services.routes.documents.task_process_document") as mock_task:
            
            mock_task.delay.return_value = MagicMock(id="job-with-drive")
            
            from services.routes.documents import process_document
            from fastapi import UploadFile
            
            test_content = b"%PDF-1.4"
            mock_file = MagicMock(spec=UploadFile)
            mock_file.filename = "celery.pdf"
            mock_file.read = AsyncMock(return_value=test_content)
            
            mock_request = MagicMock()
            mock_request.headers = {}
            mock_request.state = MagicMock()
            mock_request.state.request_id = "test-req-celery"
            
            await process_document(
                file=mock_file,
                document_id="doc-celery",
                subject_id="sub-celery",
                user_id="user-celery",
                request=mock_request
            )
            
            # Verify Celery task called with drive_file_id
            mock_task.delay.assert_called_once()
            call_kwargs = mock_task.delay.call_args.kwargs
            assert call_kwargs["drive_file_id"] == drive_id
            assert call_kwargs["material_id"] == "doc-celery"
            assert call_kwargs["subject_id"] == "sub-celery"
            assert call_kwargs["user_id"] == "user-celery"


# ─────────────────────────────────────────────────────────────────────────────
# Tests for /drive/delete endpoint
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.unit
@pytest.mark.asyncio
class TestDriveDeleteEndpoint:
    """Tests for /drive/delete endpoint function."""

    async def test_delete_endpoint_success(self):
        """Test: Delete endpoint returns success when Drive delete works."""
        
        with patch("services.routes.documents.delete_file_from_drive",
                   return_value=True) as mock_delete:
            
            from services.routes.documents import delete_drive_file_route
            
            response = await delete_drive_file_route({"file_id": "file-to-delete-789"})
            
            assert response["status"] == "success"
            assert response["deleted"] is True
            mock_delete.assert_called_once_with("file-to-delete-789")

    async def test_delete_endpoint_missing_file_id(self):
        """Test: Delete endpoint rejects missing file_id."""
        
        from services.routes.documents import delete_drive_file_route
        
        response = await delete_drive_file_route({})  # No file_id
        
        assert response["status"] == "error"
        assert response["stage"] == "drive_delete"
        assert "file_id" in response["message"].lower()

    async def test_delete_endpoint_drive_failure(self):
        """Test: Delete endpoint handles Drive failure gracefully."""
        
        with patch("services.routes.documents.delete_file_from_drive",
                   side_effect=Exception("Drive API error")):
            
            from services.routes.documents import delete_drive_file_route
            
            response = await delete_drive_file_route({"file_id": "bad-file-id"})
            
            assert response["status"] == "error"
            assert response["stage"] == "drive_delete"

    async def test_delete_endpoint_returns_false_on_failure(self):
        """Test: Delete endpoint returns deleted=false when Drive fails."""
        
        with patch("services.routes.documents.delete_file_from_drive",
                   return_value=False):
            
            from services.routes.documents import delete_drive_file_route
            
            response = await delete_drive_file_route({"file_id": "undeletable-file"})
            
            # Status is success (request processed) but deleted is false
            assert response["deleted"] is False
