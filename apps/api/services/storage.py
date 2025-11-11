"""Local filesystem storage service for managing PDF files"""

import os
from pathlib import Path

import aiofiles
import structlog

from config import settings

logger = structlog.get_logger()


class StorageService:
    """Service for interacting with local filesystem storage"""

    def __init__(self):
        self.storage_path = Path(settings.storage_path)
        # Create storage directory if it doesn't exist
        self.storage_path.mkdir(parents=True, exist_ok=True)

    def _get_file_path(self, path: str) -> Path:
        """Get full filesystem path for a file"""
        return self.storage_path / path

    async def get_file_url(self, path: str) -> str:
        """Get path for accessing a file (returns local path)"""
        return str(self._get_file_path(path))

    async def download_file(self, path: str) -> bytes:
        """Download a file from storage"""
        file_path = self._get_file_path(path)

        try:
            async with aiofiles.open(file_path, "rb") as f:
                content = await f.read()
                logger.info("File downloaded successfully", path=path, size=len(content))
                return content
        except FileNotFoundError:
            logger.error("File not found", path=path)
            raise
        except Exception as e:
            logger.error("Failed to download file", path=path, error=str(e))
            raise

    async def delete_file(self, path: str) -> bool:
        """Delete a file from storage"""
        file_path = self._get_file_path(path)

        try:
            if file_path.exists():
                os.remove(file_path)
                logger.info("File deleted successfully", path=path)
                return True
            else:
                logger.warning("File not found for deletion", path=path)
                return False
        except Exception as e:
            logger.error("Failed to delete file", path=path, error=str(e))
            return False

    async def get_file_metadata(self, path: str) -> dict | None:
        """Get metadata for a file"""
        file_path = self._get_file_path(path)

        try:
            if not file_path.exists():
                return None

            stat = file_path.stat()
            return {
                "size": stat.st_size,
                "created_at": stat.st_ctime,
                "modified_at": stat.st_mtime,
            }
        except Exception as e:
            logger.error("Failed to get file metadata", path=path, error=str(e))
            return None

    async def upload_file(
        self, path: str, file_content: bytes, content_type: str = "application/pdf"
    ) -> bool:
        """Upload a file to local storage"""
        file_path = self._get_file_path(path)

        try:
            # Create parent directories if they don't exist
            file_path.parent.mkdir(parents=True, exist_ok=True)

            # Write file
            async with aiofiles.open(file_path, "wb") as f:
                await f.write(file_content)

            logger.info("File uploaded successfully", path=path, size=len(file_content))
            return True
        except Exception as e:
            logger.error("Failed to upload file", path=path, error=str(e))
            raise
