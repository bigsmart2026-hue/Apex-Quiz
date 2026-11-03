"""PDF processing service with multi-strategy extraction and AI structuring."""
import time
import io
from typing import Optional, List, Dict, Any
from dataclasses import dataclass

import pdfplumber
import fitz  # PyMuPDF
from pdfminer.high_level import extract_text as pdfminer_extract_text

from app.config.settings import get_settings
from app.schemas.pdf_structure import (
    StructuredContent,
    RawExtraction,
    QuestionBlock,
    DocumentMetadata,
    QuestionType,
    ExtractionMethod,
)
from app.services.gemini_client import gemini_client


settings = get_settings()


@dataclass
class ExtractionResult:
    """Result of a single extraction attempt."""
    text: str
    tables: List[Dict[str, Any]]
    images: List[Dict[str, Any]]
    method: ExtractionMethod
    page_count: int
    success: bool
    error: Optional[str] = None


class PDFProcessor:
    """Multi-strategy PDF processor with AI-powered structuring."""
    
    def __init__(self):
        self.max_file_size = settings.pdf_max_bytes
        self.quality_threshold = settings.STRUCTURE_QUALITY_THRESHOLD
    
    async def process(self, file_bytes: bytes, filename: str) -> StructuredContent:
        """Process PDF through extraction and structuring pipeline."""
        start_time = time.time()
        
        # Validate
        await self._validate(file_bytes, filename)
        
        # Extract with fallback chain
        extraction = await self._extract_with_fallback(file_bytes)
        
        # Structure with AI
        structured = await self._structure_with_ai(extraction, filename)
        
        # Final metadata
        processing_time = int((time.time() - start_time) * 1000)
        structured.metadata.processing_time_ms = processing_time
        structured.metadata.extraction_method = extraction.method
        
        return structured

    async def extract_text_only(self, file_bytes: bytes, filename: str) -> str:
        """Validate and extract raw text without AI structuring.

        Used by the study aid pipeline, which performs its own grounded
        generation and does not need quiz-oriented question extraction.
        """
        await self._validate(file_bytes, filename)
        extraction = await self._extract_with_fallback(file_bytes)
        return extraction.text

    async def _validate(self, file_bytes: bytes, filename: str) -> None:
        """Validate PDF file."""
        if len(file_bytes) > self.max_file_size:
            raise ValueError(f"File too large: {len(file_bytes)} bytes (max {self.max_file_size})")
        
        if not filename.lower().endswith('.pdf'):
            raise ValueError("File must be a PDF")
        
        # Quick corruption check using PyMuPDF (faster than pdfplumber)
        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            page_count = len(doc)
            doc.close()
            if page_count == 0:
                raise ValueError("PDF has no pages")
        except Exception as e:
            raise ValueError(f"Corrupted or invalid PDF: {str(e)}")
    
    async def _extract_with_fallback(self, file_bytes: bytes) -> RawExtraction:
        """Try extraction methods and pick the best result by text quantity."""
        import asyncio
        
        # Run pdfplumber (limited pages) and PyMuPDF in parallel (fastest two)
        plumber_task = asyncio.create_task(self._extract_pdfplumber(file_bytes))
        pymupdf_task = asyncio.create_task(self._extract_pymupdf(file_bytes))
        
        plumber_result = await plumber_task
        pymupdf_result = await pymupdf_task
        
        # Collect all text-based results
        candidates = []
        if plumber_result.success and plumber_result.text.strip():
            candidates.append(plumber_result)
        if pymupdf_result.success and pymupdf_result.text.strip():
            candidates.append(pymupdf_result)
        
        # Pick the candidate with the most text
        best = max(candidates, key=lambda r: len(r.text.strip())) if candidates else None
        
        # If best text is too short, try pdfminer as fallback
        if not best or len(best.text.strip()) < 200:
            pdfminer_result = await asyncio.to_thread(self._extract_pdfminer_sync, file_bytes)
            if pdfminer_result.success and pdfminer_result.text.strip():
                candidates.append(pdfminer_result)
                best = max(candidates, key=lambda r: len(r.text.strip()))
        
        # If all text methods yielded almost nothing, try Gemini Vision as last resort
        has_any_text = any(c.text.strip() for c in candidates)
        if not has_any_text or (best and len(best.text.strip()) < 50):
            vision_result = await self._extract_gemini_vision(file_bytes)
            if vision_result.success and vision_result.text.strip():
                # Only use vision if it has more text than our best text method
                if not best or len(vision_result.text.strip()) > len(best.text.strip()):
                    best = vision_result
        
        if best:
            return RawExtraction(
                text=best.text,
                tables=best.tables,
                images=best.images,
                method=best.method,
                page_count=best.page_count,
            )
        
        # All failed
        raise ValueError("All extraction methods failed. PDF may be empty, corrupted, or password-protected.")
    
    def _extract_pdfminer_sync(self, file_bytes: bytes) -> ExtractionResult:
        """Synchronous pdfminer extraction for thread pool."""
        try:
            text = pdfminer_extract_text(io.BytesIO(file_bytes))
            
            # Estimate page count
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            page_count = len(doc)
            doc.close()
            
            return ExtractionResult(
                text=text,
                tables=[],
                images=[],
                method=ExtractionMethod.PDFMINER,
                page_count=page_count,
                success=bool(text.strip()),
            )
        except Exception as e:
            return ExtractionResult(
                text="", tables=[], images=[],
                method=ExtractionMethod.PDFMINER,
                page_count=0, success=False, error=str(e)
            )
    
    async def _extract_pdfplumber(self, file_bytes: bytes) -> ExtractionResult:
        """Extract using pdfplumber (best for tables). Limited to first 30 pages for speed."""
        try:
            text_parts = []
            tables = []
            images = []
            
            MAX_PAGES = 30  # Limit pages for speed
            
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                total_page_count = len(pdf.pages)
                pages_to_process = min(total_page_count, MAX_PAGES)
                
                for i in range(pages_to_process):
                    page = pdf.pages[i]
                    
                    # Extract text
                    page_text = page.extract_text()
                    if page_text:
                        text_parts.append(f"[Page {i+1}]\n{page_text}")
                    
                    # Extract tables
                    page_tables = page.extract_tables()
                    for j, table in enumerate(page_tables):
                        if table:
                            tables.append({
                                "page": i + 1,
                                "table_index": j,
                                "data": table,
                                "bbox": page.bbox,
                            })
                    
                    # Note images
                    if page.images:
                        for img in page.images:
                            images.append({
                                "page": i + 1,
                                "bbox": img.get("bbox"),
                                "width": img.get("width"),
                                "height": img.get("height"),
                            })
            
            return ExtractionResult(
                text="\n\n".join(text_parts),
                tables=tables,
                images=images,
                method=ExtractionMethod.PDFPLUMBER,
                page_count=total_page_count,
                success=True,
            )
        except Exception as e:
            return ExtractionResult(
                text="", tables=[], images=[],
                method=ExtractionMethod.PDFPLUMBER,
                page_count=0, success=False, error=str(e)
            )
    
    async def _extract_pymupdf(self, file_bytes: bytes) -> ExtractionResult:
        """Extract using PyMuPDF (fast)."""
        try:
            text_parts = []
            tables = []
            images = []
            
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            page_count = len(doc)
            
            for i in range(page_count):
                page = doc[i]
                
                # Extract text
                page_text = page.get_text()
                if page_text.strip():
                    text_parts.append(f"[Page {i+1}]\n{page_text}")
                
                # Extract images info
                image_list = page.get_images(full=True)
                for img in image_list:
                    images.append({
                        "page": i + 1,
                        "xref": img[0],
                        "width": img[2],
                        "height": img[3],
                    })
            
            doc.close()
            
            return ExtractionResult(
                text="\n\n".join(text_parts),
                tables=tables,
                images=images,
                method=ExtractionMethod.PYMUPDF,
                page_count=page_count,
                success=True,
            )
        except Exception as e:
            return ExtractionResult(
                text="", tables=[], images=[],
                method=ExtractionMethod.PYMUPDF,
                page_count=0, success=False, error=str(e)
            )
    
    async def _extract_gemini_vision(self, file_bytes: bytes) -> ExtractionResult:
        """Extract using Gemini Vision (for scanned PDFs)."""
        try:
            # Convert PDF pages to images
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            page_count = len(doc)
            
            all_images = []
            
            for i in range(min(page_count, 8)):  # Limit to 8 pages for vision (was 20)
                page = doc[i]
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x zoom
                img_bytes = pix.tobytes("png")
                
                all_images.append({
                    "page": i + 1,
                    "data": img_bytes,
                    "width": pix.width,
                    "height": pix.height,
                })
            
            doc.close()
            
            if not all_images:
                return ExtractionResult(
                    text="", tables=[], images=[],
                    method=ExtractionMethod.GEMINI_VISION,
                    page_count=page_count, success=False, error="No pages to process"
                )
            
            # Use Gemini to extract text from images
            extracted_text = await gemini_client.extract_text_from_images(all_images)
            
            return ExtractionResult(
                text=extracted_text,
                tables=[],  # Vision doesn't extract structured tables well
                images=all_images,
                method=ExtractionMethod.GEMINI_VISION,
                page_count=page_count,
                success=bool(extracted_text.strip()),
            )
        except Exception as e:
            return ExtractionResult(
                text="", tables=[], images=[],
                method=ExtractionMethod.GEMINI_VISION,
                page_count=0, success=False, error=str(e)
            )
    
    def _extract_questions_from_text_fallback(self, text: str) -> List[QuestionBlock]:
        """Extract multiple-choice blocks from plain text when AI structuring fails.

        Handles wrapped question text and options written as ``(A) ...``,
        ``A) ...`` or ``A. ...``. Open-ended Section B questions are skipped
        because the quiz UI cannot play questions without answer choices.
        """
        import re

        blocks: List[QuestionBlock] = []
        current_question: Optional[str] = None
        current_options: Dict[str, str] = {}

        def flush() -> None:
            nonlocal current_question, current_options
            options = [
                current_options[key]
                for key in sorted(current_options)
                if current_options[key].strip()
            ]
            if current_question and len(options) >= 2:
                blocks.append(QuestionBlock(
                    type=QuestionType.MULTIPLE_CHOICE,
                    question_text=current_question,
                    options=options,
                    correct_answer="",
                    explanation="",
                    source_location={"method": "fallback_regex"},
                    confidence=0.5,
                ))
            current_question = None
            current_options = {}

        for raw_line in text.splitlines():
            line = raw_line.strip()
            if not line:
                continue

            # Section B is open-ended; it has no options the player can use.
            if re.match(r'^SECTION\s+B\b', line, re.IGNORECASE):
                flush()
                break
            if re.match(r'^(SECTION\s+A|INSTRUCTION)\b', line, re.IGNORECASE):
                continue

            # Detect numbered questions: "1. What is..." or "1)..." or "10.What..."
            question_match = re.match(r'^(\d+)\s*[\.\)]\s*(.*)$', line)
            if question_match:
                flush()
                current_question = question_match.group(2).strip() or None
                continue

            if not current_question:
                continue

            # Options may be "(A) 11", "A) 11", or several on one line.
            option_matches = re.findall(r'\(([A-Da-d])\)\s*([^()]*)', line)
            if option_matches:
                for letter, option_text in option_matches:
                    cleaned = option_text.strip()
                    if cleaned:
                        current_options[letter.upper()] = cleaned
                continue

            option_match = re.match(r'^([A-Da-d])[\.\)]\s*(.+)$', line)
            if option_match:
                current_options[option_match.group(1).upper()] = option_match.group(2).strip()
                continue

            # Continuation of wrapped question text. Ignore figure labels and
            # instructions that appear after the options have started.
            if not current_options:
                current_question = f"{current_question} {line}".strip()

        flush()
        return blocks
    
    async def _structure_with_ai(self, extraction: RawExtraction, filename: str) -> StructuredContent:
        """Use Gemini to structure raw extraction into QuestionBlocks."""
        
        # Build structuring prompt
        prompt = self._build_structuring_prompt(extraction)
        
        # Call Gemini
        try:
            response = await gemini_client.structure_content(prompt)
            
            # Parse response into QuestionBlocks
            blocks = self._parse_structured_response(response, extraction)
        except Exception:
            blocks = []
        
        # Fallback: if AI returned no blocks, try simple heuristic extraction from text
        if not blocks and extraction.text and len(extraction.text.strip()) > 50:
            blocks = self._extract_questions_from_text_fallback(extraction.text)
        
        # Calculate quality
        quality = self._calculate_quality(blocks, extraction)
        
        # Create metadata
        metadata = DocumentMetadata(
            filename=filename,
            file_size_bytes=len(extraction.text.encode()),
            page_count=extraction.page_count,
            extraction_method=extraction.method,
            processing_time_ms=0,  # Will be set by caller
        )
        
        warnings = []
        if quality < self.quality_threshold:
            warnings.append(f"Low extraction quality ({quality:.1%}). Some questions may be inaccurate.")
        if not blocks:
            warnings.append("No questions could be extracted from this PDF.")
        warnings.extend(extraction.raw_metadata.get("warnings", []))
        
        return StructuredContent(
            blocks=blocks,
            metadata=metadata,
            extraction_quality=quality,
            warnings=warnings,
        )
    
    def _build_structuring_prompt(self, extraction: RawExtraction) -> str:
        """Build prompt for AI structuring (free-tier optimized)."""
        tables_text = ""
        if extraction.tables:
            tables_text = "\n\n=== EXTRACTED TABLES ===\n"
            for t in extraction.tables:
                tables_text += f"\nPage {t['page']}, Table {t['table_index']}:\n"
                for row in t['data']:
                    tables_text += " | ".join(str(cell) if cell else "" for cell in row) + "\n"
        
        # Truncate for free-tier speed (was 50000, reduced to 15000, now 25000 for better context)
        content_preview = extraction.text[:25000]
        
        return f"""You are an expert at extracting quiz questions from educational documents.
Analyze the following extracted PDF content and identify all quiz questions.

EXTRACTED TEXT:
{content_preview}

{tables_text}

Extract ALL questions and format as JSON array with this exact schema:
[
  {{
    "type": "multiple_choice|true_false|short_answer|table_based",
    "question_text": "Full question text",
    "options": ["A", "B", "C", "D"] or null,
    "correct_answer": "A" or ["A", "B"] or "answer text",
    "explanation": "Optional explanation",
    "source_location": {{"page": 1, "method": "pdfplumber"}},
    "confidence": 0.95
  }}
]

Rules:
- For multiple_choice: must have 2-6 options, correct_answer is the option letter/text
- For true_false: options is null, correct_answer is "True" or "False"
- For short_answer: options is null, correct_answer is the expected answer
- For table_based: question references table data, options from table columns
- confidence: 0.0-1.0 based on how clear the question is in source
- Only extract actual questions, not headings, captions, or explanations
- If uncertain, set confidence lower

Return ONLY the JSON array, no extra text."""
    
    def _parse_structured_response(self, response: str, extraction: RawExtraction) -> List[QuestionBlock]:
        """Parse AI response into QuestionBlocks."""
        import json
        
        try:
            # Try to extract JSON from response
            start = response.find('[')
            end = response.rfind(']') + 1
            if start >= 0 and end > start:
                json_str = response[start:end]
                data = json.loads(json_str)
            else:
                data = json.loads(response)
            
            blocks = []
            for item in data:
                try:
                    block = QuestionBlock(
                        type=QuestionType(item.get("type", "multiple_choice")),
                        question_text=item.get("question_text", "").strip(),
                        options=item.get("options"),
                        correct_answer=item.get("correct_answer", ""),
                        explanation=item.get("explanation"),
                        source_location=item.get("source_location", {}),
                        confidence=float(item.get("confidence", 0.5)),
                    )
                    blocks.append(block)
                except Exception:
                    continue  # Skip invalid blocks
            
            return blocks
        except Exception:
            return []
    
    def _calculate_quality(self, blocks: List[QuestionBlock], extraction: RawExtraction) -> float:
        """Calculate overall extraction quality score."""
        # Base score from successful text extraction (0.3 max)
        text_score = 0.0
        if extraction.text and len(extraction.text.strip()) > 100:
            text_score = 0.3  # Text extraction succeeded
        elif extraction.text and len(extraction.text.strip()) > 0:
            text_score = 0.1  # Minimal text extracted
        
        if not blocks:
            return text_score  # Return partial credit for text extraction
        
        # Average confidence of extracted blocks
        avg_confidence = sum(b.confidence for b in blocks) / len(blocks)
        
        # Bonus for having tables extracted
        table_bonus = 0.1 if extraction.tables else 0.0
        
        # Bonus for using better extraction method
        method_bonus = {
            ExtractionMethod.PDFPLUMBER: 0.15,
            ExtractionMethod.PYMUPDF: 0.1,
            ExtractionMethod.PDFMINER: 0.05,
            ExtractionMethod.GEMINI_VISION: 0.0,
        }.get(extraction.method, 0.0)
        
        # Combine: text extraction base + block confidence, capped at 1.0
        return min(1.0, text_score + avg_confidence * 0.6 + table_bonus + method_bonus)


# Singleton instance
pdf_processor = PDFProcessor()