from pathlib import Path
from uuid import uuid4
from PIL import Image, UnidentifiedImageError

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from fastapi.staticfiles import StaticFiles

from src.detector import DefectDetector
from src.schemas import ImageReport


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
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

        report = await run_in_threadpool(
            detector.predict,
            temp_path,
            conf,
            filename
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
        raise HTTPException(
            status_code=500,
            detail=f"Image processing failed: {exc}"
        ) from exc

    finally:
        await file.close()

        if temp_path.exists():
            temp_path.unlink()

#python -m uvicorn src.main:app --host 127.0.0.1 --port 8000