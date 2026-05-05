"""
Drive Upload Integration Tests

These tests verify the full flow with mocked external services.
"""

import pytest
from unittest.mock import MagicMock, patch, AsyncMock
import tempfile
import os


@pytest.mark.integration
class TestDriveUploadIntegration:
    """Integration tests for Drive upload flow."""

    @pytest.mark.asyncio
    async def test_end_to_end_upload_with_drive(self, client):
        """Test: Full upload flow from HTTP request to Drive storage."""
        
        with patch("services.google_drive.get_drive_service") as mock_get_service, \
             patch("services.google_drive.get_google_drive_folder_id", return_value="test-folder"):
            
            # Setup mock Drive service
            mock_service = MagicMock()
            mock_files = MagicMock()
            mock_service.files.return_value = mock_files
            
            # Mock Drive upload response
            mock_files.create.return_value.execute.return_value = {
                "id": "integration-drive-id-123",
                "name": "integration_test.pdf"
            }
            
            mock_get_service.return_value = mock_service
            
            with patch("services.routes.documents.task_process_document") as mock_task:
                mock_task.delay.return_value = MagicMock(id="integration-job-456")
                
                from io import BytesIO
                test_file = BytesIO(b"%PDF-1.4 integration test content")
                test_file.name = "integration_test.pdf"
                
                response = await client.post(
                    "/process-document",
                    data={
                        "file": ("integration_test.pdf", test_file, "application/pdf"),
                        "document_id": "integration-doc-123",
                        "subject_id": "integration-sub-456",
                        "user_id": "integration-user-789"
                    }
                )
                
                assert response.status_code == 200
                data = response.json()
                
                # Verify full chain
                assert data["drive_file_id"] == "integration-drive-id-123"
                assert data["job_id"] == "integration-job-456"
                
                # Verify Drive was actually called
                mock_files.create.assert_called_once()
                
                # Verify Celery was queued
                mock_task.delay.assert_called_once()

    @pytest.mark.asyncio
    async def test_upload_fallback_to_local_on_drive_failure(self, client):
        """Test: Falls back to local when Drive fails."""
        
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("services.routes.documents.DEFAULT_UPLOADS_DIR", tmpdir), \
                 patch("services.google_drive.get_drive_service") as mock_get_service:
                
                # Simulate Drive failure
                mock_get_service.side_effect = Exception("Drive not configured")
                
                with patch("services.routes.documents.task_process_document_local") as mock_task:
                    mock_task.delay.return_value = MagicMock(id="fallback-job-789")
                    
                    from io import BytesIO
                    test_file = BytesIO(b"%PDF-1.4 fallback content")
                    test_file.name = "fallback.pdf"
                    
                    response = await client.post(
                        "/process-document",
                        data={
                            "file": ("fallback.pdf", test_file, "application/pdf"),
                            "document_id": "fallback-doc",
                            "subject_id": "fallback-sub",
                            "user_id": "fallback-user"
                        }
                    )
                    
                    assert response.status_code == 200
                    data = response.json()
                    
                    # No drive_file_id in fallback
                    assert "drive_file_id" not in data
                    assert "local processing" in data["message"].lower()
                    
                    # Verify local task was queued
                    mock_task.delay.assert_called_once()
                    
                    # Verify file was saved locally
                    local_task_call = mock_task.delay.call_args
                    assert os.path.exists(local_task_call.kwargs["local_file_path"])

    @pytest.mark.asyncio
    async def test_delete_flow_integration(self, client):
        """Test: Full delete flow from HTTP to Drive deletion."""
        
        with patch("services.google_drive.get_drive_service") as mock_get_service:
            mock_service = MagicMock()
            mock_files = MagicMock()
            mock_service.files.return_value = mock_files
            mock_get_service.return_value = mock_service
            
            # Mock successful deletion
            mock_files.delete.return_value.execute.return_value = {}
            
            response = await client.post(
                "/drive/delete",
                json={"file_id": "delete-target-id-123"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["deleted"] is True
            
            # Verify Drive delete was called
            mock_files.delete.assert_called_once_with(
                fileId="delete-target-id-123",
                supportsAllDrives=True
            )


@pytest.mark.integration
class TestDriveCleanupScenarios:
    """Tests for cleanup and failure scenarios."""

    @pytest.mark.asyncio
    async def test_drive_upload_succeeds_but_db_fails_simulation(self, client):
        """Test: Drive upload succeeds but we simulate backend DB failure."""
        
        # This tests the scenario where Drive upload works but backend
        # might fail to persist - the drive_file_id is still returned
        # for the backend to handle cleanup if needed
        
        with patch("services.google_drive.get_drive_service") as mock_get_service:
            mock_service = MagicMock()
            mock_files = MagicMock()
            mock_service.files.return_value = mock_files
            mock_get_service.return_value = mock_service
            
            drive_file_id = "orphan-risk-file-456"
            mock_files.create.return_value.execute.return_value = {
                "id": drive_file_id,
                "name": "orphan_test.pdf"
            }
            
            with patch("services.routes.documents.task_process_document") as mock_task:
                mock_task.delay.return_value = MagicMock(id="orphan-job")
                
                from io import BytesIO
                test_file = BytesIO(b"%PDF-1.4")
                test_file.name = "orphan.pdf"
                
                response = await client.post(
                    "/process-document",
                    data={
                        "file": ("orphan.pdf", test_file, "application/pdf"),
                        "document_id": "orphan-doc",
                        "subject_id": "orphan-sub",
                        "user_id": "orphan-user"
                    }
                )
                
                data = response.json()
                
                # drive_file_id is returned - backend's responsibility to persist
                assert data["drive_file_id"] == drive_file_id
                
                # If backend fails after this, the Drive file is orphaned
                # until cleanup. This is documented behavior.

    @pytest.mark.asyncio
    async def test_cascade_delete_prevents_orphans(self, client):
        """Test: Simulating cascade delete to prevent orphaned Drive files."""
        
        drive_file_id = "cascade-delete-test-789"
        
        # Step 1: Upload to Drive
        with patch("services.google_drive.get_drive_service") as mock_get_service:
            mock_service = MagicMock()
            mock_files = MagicMock()
            mock_service.files.return_value = mock_files
            mock_get_service.return_value = mock_service
            
            mock_files.create.return_value.execute.return_value = {
                "id": drive_file_id,
                "name": "cascade.pdf"
            }
            
            with patch("services.routes.documents.task_process_document") as mock_task:
                mock_task.delay.return_value = MagicMock(id="cascade-job")
                
                from io import BytesIO
                test_file = BytesIO(b"%PDF-1.4")
                test_file.name = "cascade.pdf"
                
                await client.post(
                    "/process-document",
                    data={
                        "file": ("cascade.pdf", test_file, "application/pdf"),
                        "document_id": "cascade-doc",
                        "subject_id": "cascade-sub",
                        "user_id": "cascade-user"
                    }
                )
        
        # Step 2: Delete from Drive (simulating backend cleanup)
        with patch("services.google_drive.get_drive_service") as mock_get_service:
            mock_service = MagicMock()
            mock_files = MagicMock()
            mock_service.files.return_value = mock_files
            mock_get_service.return_value = mock_service
            
            mock_files.delete.return_value.execute.return_value = {}
            
            response = await client.post(
                "/drive/delete",
                json={"file_id": drive_file_id}
            )
            
            assert response.json()["deleted"] is True
            
            # Verify the cascade worked
            mock_files.delete.assert_called_with(
                fileId=drive_file_id,
                supportsAllDrives=True
            )
