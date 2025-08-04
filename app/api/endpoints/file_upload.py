import asyncio
import logging
import os
import tempfile
from typing import List, Optional, Dict, Any
from pathlib import Path
import aiofiles
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Form
from fastapi.responses import JSONResponse
import PyPDF2
import docx
import markdown
from pydantic import BaseModel

from ...core.config import settings
from ...security.auth import get_current_user, require_permission
from ...security.models import Permission
from ...services.rag_engine import rag_engine
from ...services.advanced_rag_engine import advanced_rag_engine

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/upload", tags=["File Upload"])

class FileUploadResponse(BaseModel):
    success: bool
    message: str
    document_ids: List[str]
    file_name: str
    file_size: int
    processing_time: float
    extracted_text_length: int

class BulkUploadResponse(BaseModel):
    success: bool
    message: str
    total_files: int
    successful_uploads: int
    failed_uploads: int
    document_ids: List[str]
    errors: List[str]
    processing_time: float

def validate_file_type(filename: str) -> bool:
    """Validate if file type is supported"""
    allowed_extensions = settings.allowed_file_types.split(',')
    file_extension = Path(filename).suffix.lower().lstrip('.')
    return file_extension in allowed_extensions

def validate_file_size(file_size: int) -> bool:
    """Validate file size"""
    max_size = settings.max_request_size_mb * 1024 * 1024  # Convert MB to bytes
    return file_size <= max_size

async def extract_text_from_file(file_path: str, file_extension: str) -> str:
    """Extract text from different file formats"""
    try:
        if file_extension == 'pdf':
            return await extract_text_from_pdf(file_path)
        elif file_extension == 'txt':
            return await extract_text_from_txt(file_path)
        elif file_extension == 'docx':
            return await extract_text_from_docx(file_path)
        elif file_extension == 'md':
            return await extract_text_from_md(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_extension}")
    except Exception as e:
        logger.error(f"Error extracting text from {file_path}: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to extract text from file: {str(e)}")

async def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from PDF file with enhanced error handling"""
    try:
        async with aiofiles.open(file_path, 'rb') as file:
            content = await file.read()
        
        # Use PyPDF2 to extract text
        import io
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
        text = ""
        total_pages = len(pdf_reader.pages)
        logger.info(f"PDF has {total_pages} pages")
        
        # Try to extract text from each page
        for i, page in enumerate(pdf_reader.pages):
            try:
                page_text = page.extract_text()
                logger.info(f"Page {i+1} extracted {len(page_text)} characters")
                if page_text:
                    text += page_text + "\n"
                else:
                    logger.warning(f"Page {i+1} returned empty text - may contain images or complex layout")
            except Exception as page_error:
                logger.warning(f"Error extracting text from page {i+1}: {page_error}")
                continue
        
        extracted_text = text.strip()
        logger.info(f"Total extracted text length: {len(extracted_text)} characters")
        
        # If no text was extracted, try alternative extraction methods
        if not extracted_text:
            logger.warning("No text content extracted from PDF with primary method")
            logger.info("This PDF may be:")
            logger.info("- Image-based (scanned document)")
            logger.info("- Contains text only in images/charts/graphs")
            logger.info("- Has complex layout that PyPDF2 cannot handle")
            logger.info("- Password protected or corrupted")
            
            # Try to get some basic info about the PDF
            try:
                if pdf_reader.metadata:
                    logger.info(f"PDF metadata: {pdf_reader.metadata}")
                logger.info(f"PDF has {total_pages} pages")
                logger.info(f"PDF file size: {len(content)} bytes")
            except Exception as meta_error:
                logger.warning(f"Could not read PDF metadata: {meta_error}")
            
            # Try alternative extraction method - extract raw text objects
            try:
                logger.info("Attempting alternative text extraction method...")
                alternative_text = ""
                for i, page in enumerate(pdf_reader.pages):
                    try:
                        # Try to extract text with different parameters
                        page_text = page.extract_text(
                            orientations=(0, 90, 180, 270),
                            space_width=200.0
                        )
                        if page_text:
                            alternative_text += page_text + "\n"
                            logger.info(f"Alternative method: Page {i+1} extracted {len(page_text)} characters")
                    except Exception as alt_error:
                        logger.warning(f"Alternative method failed for page {i+1}: {alt_error}")
                        continue
                
                if alternative_text.strip():
                    logger.info("Alternative extraction method succeeded!")
                    return alternative_text.strip()
                else:
                    logger.warning("Alternative extraction method also failed")
                    
            except Exception as alt_error:
                logger.warning(f"Alternative extraction method failed: {alt_error}")
            
            # If all methods fail, provide detailed error
            raise HTTPException(
                status_code=400, 
                detail="No text content found in PDF. This PDF appears to be image-based or contains text only in images/charts. Consider using OCR tools or manually extracting the text content."
            )
        
        return extracted_text
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {e}")
        logger.error(f"Exception type: {type(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=400, 
            detail=f"Failed to extract text from PDF: {str(e)}"
        )

async def extract_text_from_txt(file_path: str) -> str:
    """Extract text from TXT file"""
    try:
        async with aiofiles.open(file_path, 'r', encoding='utf-8') as file:
            content = await file.read()
        return content.strip()
    except UnicodeDecodeError:
        # Try with different encoding
        try:
            async with aiofiles.open(file_path, 'r', encoding='latin-1') as file:
                content = await file.read()
            return content.strip()
        except Exception as e:
            logger.error(f"Error extracting text from TXT: {e}")
            raise HTTPException(status_code=400, detail=f"Failed to extract text from TXT file: {str(e)}")

async def extract_text_from_docx(file_path: str) -> str:
    """Extract text from DOCX file"""
    try:
        doc = docx.Document(file_path)
        text = ""
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
        return text.strip()
    except Exception as e:
        logger.error(f"Error extracting text from DOCX: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to extract text from DOCX file: {str(e)}")

async def extract_text_from_md(file_path: str) -> str:
    """Extract text from Markdown file"""
    try:
        async with aiofiles.open(file_path, 'r', encoding='utf-8') as file:
            content = await file.read()
        return content.strip()
    except Exception as e:
        logger.error(f"Error extracting text from MD: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to extract text from Markdown file: {str(e)}")

@router.post("/file", response_model=FileUploadResponse)
async def upload_single_file(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    source: Optional[str] = Form("file_upload"),
    metadata: Optional[str] = Form("{}"),
    _: bool = Depends(require_permission(Permission.WRITE_DOCUMENTS))
):
    """
    Upload a single file (PDF, TXT, DOCX, MD) and extract text for RAG processing
    """
    import time
    start_time = time.time()
    try:
        # Validate file type
        if not validate_file_type(file.filename):
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported file type. Allowed types: {settings.allowed_file_types}"
            )
        # Validate file size
        if not validate_file_size(file.size):
            max_size_mb = settings.max_request_size_mb
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {max_size_mb}MB"
            )
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{Path(file.filename).suffix}") as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        try:
            # Extract text from file
            file_extension = Path(file.filename).suffix.lower().lstrip('.')
            extracted_text = await extract_text_from_file(temp_file_path, file_extension)
            if not extracted_text.strip():
                raise HTTPException(status_code=400, detail="No text content found in file")
            # Parse metadata
            try:
                metadata_dict = eval(metadata) if metadata else {}
            except:
                metadata_dict = {}
            # Prepare document data
            document_data = {
                "content": extracted_text,
                "title": title or file.filename,
                "source": source,
                "metadata": {
                    **metadata_dict,
                }
            }
            # Add document using base rag_engine
            document_id = await rag_engine.add_document(
                title=document_data["title"],
                content=document_data["content"],
                metadata=document_data["metadata"]
            )
            processing_time = time.time() - start_time
            return FileUploadResponse(
                success=True,
                message="File uploaded and processed successfully",
                document_ids=[document_id] if document_id else [],
                file_name=file.filename,
                file_size=file.size,
                processing_time=processing_time,
                extracted_text_length=len(extracted_text)
            )
        finally:
            os.unlink(temp_file_path)
    except Exception as e:
        logger.error(f"File upload failed: {e}")
        raise

@router.post("/files/bulk", response_model=BulkUploadResponse)
async def upload_multiple_files(
    files: List[UploadFile] = File(...),
    source: Optional[str] = Form("bulk_file_upload"),
    metadata: Optional[str] = Form("{}"),
    _: bool = Depends(require_permission(Permission.BULK_IMPORT_DOCUMENTS))
):
    """
    Bulk upload multiple files and extract text for RAG processing
    """
    import time
    start_time = time.time()
    document_ids = []
    errors = []
    successful_uploads = 0
    failed_uploads = 0
    try:
        for file in files:
            try:
                if not validate_file_type(file.filename):
                    errors.append(f"Unsupported file type: {file.filename}")
                    failed_uploads += 1
                    continue
                if not validate_file_size(file.size):
                    errors.append(f"File too large: {file.filename}")
                    failed_uploads += 1
                    continue
                with tempfile.NamedTemporaryFile(delete=False, suffix=f".{Path(file.filename).suffix}") as temp_file:
                    content = await file.read()
                    temp_file.write(content)
                    temp_file_path = temp_file.name
                try:
                    file_extension = Path(file.filename).suffix.lower().lstrip('.')
                    extracted_text = await extract_text_from_file(temp_file_path, file_extension)
                    if not extracted_text.strip():
                        errors.append(f"No text content found in file: {file.filename}")
                        failed_uploads += 1
                        continue
                    try:
                        metadata_dict = eval(metadata) if metadata else {}
                    except:
                        metadata_dict = {}
                    document_data = {
                        "content": extracted_text,
                        "title": file.filename,
                        "source": source,
                        "metadata": {
                            **metadata_dict,
                        }
                    }
                    document_id = await rag_engine.add_document(
                        title=document_data["title"],
                        content=document_data["content"],
                        metadata=document_data["metadata"]
                    )
                    if document_id:
                        document_ids.append(document_id)
                        successful_uploads += 1
                    else:
                        errors.append(f"Failed to add document for file: {file.filename}")
                        failed_uploads += 1
                finally:
                    os.unlink(temp_file_path)
            except Exception as e:
                errors.append(f"Error processing file {file.filename}: {e}")
                failed_uploads += 1
        processing_time = time.time() - start_time
        return BulkUploadResponse(
            success=successful_uploads > 0,
            message=f"Bulk upload completed: {successful_uploads} succeeded, {failed_uploads} failed",
            total_files=len(files),
            successful_uploads=successful_uploads,
            failed_uploads=failed_uploads,
            document_ids=document_ids,
            errors=errors,
            processing_time=processing_time
        )
    except Exception as e:
        logger.error(f"Bulk file upload failed: {e}")
        raise

@router.get("/supported-formats")
async def get_supported_formats():
    """Get supported file formats for upload"""
    return {
        "supported_formats": settings.allowed_file_types.split(',')
    } 