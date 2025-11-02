"""Supabase Storage service for managing PDF files"""

import httpx
import structlog

from config import settings

logger = structlog.get_logger()


class StorageService:
    """Service for interacting with Supabase Storage"""

    def __init__(self):
        self.base_url = f"{settings.supabase_url}/storage/v1"
        self.bucket = settings.storage_bucket
        self.service_key = settings.supabase_service_role_key

    def get_headers(self, token: str | None = None) -> dict:
        """Get headers for storage requests"""
        headers = {
            "apikey": self.service_key,
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
        else:
            headers["Authorization"] = f"Bearer {self.service_key}"
        return headers

    async def get_file_url(self, path: str, token: str | None = None) -> str:
        """Get URL for accessing a file"""
        return f"{self.base_url}/object/{self.bucket}/{path}"

    async def download_file(self, path: str) -> bytes:
        """Download a file from storage"""
        url = f"{self.base_url}/object/{self.bucket}/{path}"

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    url,
                    headers=self.get_headers(),
                    timeout=30.0,
                )
                response.raise_for_status()
                return response.content
            except httpx.HTTPError as e:
                logger.error("Failed to download file", path=path, error=str(e))
                raise

    async def delete_file(self, path: str) -> bool:
        """Delete a file from storage"""
        url = f"{self.base_url}/object/{self.bucket}/{path}"

        async with httpx.AsyncClient() as client:
            try:
                response = await client.delete(
                    url,
                    headers=self.get_headers(),
                    timeout=10.0,
                )
                response.raise_for_status()
                return True
            except httpx.HTTPError as e:
                logger.error("Failed to delete file", path=path, error=str(e))
                return False

    async def get_file_metadata(self, path: str) -> dict | None:
        """Get metadata for a file"""
        url = f"{self.base_url}/object/info/{self.bucket}/{path}"

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    url,
                    headers=self.get_headers(),
                    timeout=10.0,
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as e:
                logger.error("Failed to get file metadata", path=path, error=str(e))
                return None

    async def upload_file(
        self, path: str, file_content: bytes, content_type: str = "application/pdf"
    ) -> bool:
        """Upload a file to storage using service role (bypasses RLS)"""
        url = f"{self.base_url}/object/{self.bucket}/{path}"

        async with httpx.AsyncClient() as client:
            try:
                # Use multipart form data for file upload
                # Supabase Storage API expects 'file' field with the file content
                files = {"file": (path.split("/")[-1], file_content, content_type)}

                # Headers for service role (bypasses RLS)
                headers = {
                    "apikey": self.service_key,
                    "Authorization": f"Bearer {self.service_key}",
                }

                # Use multipart form data
                data = {"upsert": "true"}

                response = await client.post(
                    url,
                    headers=headers,
                    files=files,
                    data=data,
                    timeout=60.0,  # Longer timeout for large files
                )
                response.raise_for_status()
                logger.info("File uploaded successfully", path=path, size=len(file_content))
                return True
            except httpx.HTTPError as e:
                error_detail = None
                if e.response:
                    try:
                        error_detail = e.response.json()
                    except Exception:
                        error_detail = e.response.text

                logger.error(
                    "Failed to upload file",
                    path=path,
                    status_code=e.response.status_code if e.response else None,
                    error=str(e),
                    error_detail=error_detail,
                )
                raise
