from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


class DefectDetection(BaseModel):
    class_id: int
    class_name: str
    confidence: float = Field(ge=0.0, le=1.0)
    confidence_percent: float = Field(ge=0.0, le=100.0)
    bbox: BoundingBox


class ImageReport(BaseModel):
    image_name: str
    image_width: int
    image_height: int
    total_defects: int
    defect_counts: Dict[str, int]
    detections: List[DefectDetection]
    annotated_image: str
    annotated_image_url: Optional[str] = None


class BatchSummary(BaseModel):
    source_folder: str
    images_found: int
    images_processed: int
    images_failed: int
    total_defects: int
    defect_counts: Dict[str, int]
    errors: list
    image_reports: List[ImageReport]
    summary_file: str