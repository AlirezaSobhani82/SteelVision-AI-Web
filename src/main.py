from pathlib import Path
from uuid import uuid4
import logging
import os
import sys
import time

from PIL import Image, UnidentifiedImageError

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from fastapi.staticfiles import StaticFiles

from src.detector import DefectDetector
from src.schemas import ImageReport

logging.basicConfig(level=logging.INFO, stream=sys.stdout)
log = logging.getLogger("sv")


def rss_mb():
    """مصرف RAM پروسه (فقط روی لینوکس/Render)."""
    try:
        with open("/proc/self/status") as f:
            for line in f:
                if line.startswith("VmRSS"):
                    return int(line.split()[1]) / 1024
    except OSError:
        pass
    return -1.0


BASE_DIR = Path(__file__).resolve().parent.parent

OUTPUT_DIR = BASE_DIR / "outputs"
UPLOAD_DIR = OUTPUT_DIR / "uploads"
IMAGE_OUTPUT_DIR = OUTPUT_DIR / "images"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
IMAGE_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"
}

MAX_FILE_SIZE = 20 * 1024 * 1024

app = FastAPI(
    title="Metal Defect Detection API",
    description="API for detecting surface defects in metal images.",
    version="1.0.0"
)

frontend_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")

allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

if frontend_url:
    allowed_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    "/outputs/images",
    StaticFiles(directory=str(IMAGE_OUTPUT_DIR)),
    name="annotated-images"
)

detector = DefectDetector()
log.info("startup: model loaded, rss=%.0fMB", rss_mb())


@app.get("/")
def root():
    return {
        "service": "Metal Defect Detection API",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model_loaded": detector.model is not None
    }


@app.post("/predict", response_model=ImageReport)
async def predict(
    file: UploadFile = File(...),
    conf: float = Query(default=0.25, ge=0.0, le=1.0)
):
    t0 = time.time()
    log.info("predict: received %s, rss=%.0fMB", file.filename, rss_mb())

    filename = Path(file.filename or "").name
    extension = Path(filename).suffix.lower()

    if not filename or extension not in ALLOWED_EXTENSIONS:
        await file.close()
        raise HTTPException(
            status_code=400,
            detail="Unsupported image format."
        )

    temp_path = UPLOAD_DIR / f"{uuid4().hex}{extension}"

    try:
        size = 0

        with temp_path.open("wb") as destination:
            while True:
                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                size += len(chunk)

                if size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="Image exceeds the 20 MB limit."
                    )

                destination.write(chunk)

        log.info("predict: saved %d bytes, rss=%.0fMB", size, rss_mb())

        if size == 0:
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty."
            )

        try:
            with Image.open(temp_path) as image:
                image.verify()

        except (UnidentifiedImageError, OSError, ValueError):
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is not a valid image or is corrupted."
            )

        log.info("predict: starting YOLO, rss=%.0fMB", rss_mb())

        report = await run_in_threadpool(
            detector.predict,
            temp_path,
            conf,
            filename
        )

        log.info(
            "predict: done in %.1fs, rss=%.0fMB",
            time.time() - t0, rss_mb()
        )

        annotated_filename = Path(
            report["annotated_image"]
        ).name

        report["annotated_image_url"] = (
            f"/outputs/images/{annotated_filename}"
        )

        return report

    except HTTPException:
        raise

    except Exception as exc:
        log.exception("predict: failed")
        raise HTTPException(
            status_code=500,
            detail=f"Image processing failed: {exc}"
        ) from exc

    finally:
        await file.close()

        if temp_path.exists():
            temp_path.unlink()