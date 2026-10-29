from pathlib import Path
from collections import Counter
import json

import cv2
import torch
from ultralytics import YOLO

# کاهش مصرف CPU/حافظه روی پلن Free
torch.set_num_threads(1)

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_PATH = BASE_DIR / "models" / "best.pt"

OUTPUT_DIR = BASE_DIR / "outputs"
IMAGE_OUTPUT_DIR = OUTPUT_DIR / "images"
REPORT_OUTPUT_DIR = OUTPUT_DIR / "reports"

IMAGE_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
REPORT_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# حداکثر ضلع بلند تصویر قبل از استنتاج (برای صرفه‌جویی در RAM)
MAX_SIDE = 1280


class DefectDetector:
    def __init__(self, model_path=MODEL_PATH):
        model_path = Path(model_path)

        if not model_path.exists():
            raise FileNotFoundError(
                f"Model file not found: {model_path}"
            )

        self.model = YOLO(str(model_path))

    def predict(
        self,
        image_path,
        conf=0.25,
        original_filename=None
    ):
        image_path = Path(image_path)

        if not image_path.is_file():
            raise FileNotFoundError(
                f"Image file not found: {image_path}"
            )

        if not 0.0 <= conf <= 1.0:
            raise ValueError(
                "Confidence threshold must be between 0 and 1."
            )

        image = cv2.imread(str(image_path))

        if image is None:
            raise ValueError("Invalid or unreadable image file.")

        orig_h, orig_w = image.shape[:2]

        # کوچک کردن تصویر بزرگ فقط برای استنتاج
        scale = MAX_SIDE / max(orig_h, orig_w)
        if scale < 1:
            image = cv2.resize(
                image,
                (int(orig_w * scale), int(orig_h * scale)),
                interpolation=cv2.INTER_AREA
            )
        else:
            scale = 1.0

        with torch.inference_mode():
            results = self.model.predict(
                source=image,
                conf=conf,
                imgsz=640,
                device="cpu",
                verbose=False
            )

        result = results[0]
        defects = []

        for box in result.boxes:
            class_id = int(box.cls.item())
            confidence = float(box.conf.item())
            x1, y1, x2, y2 = box.xyxy[0].tolist()

            # برگرداندن مختصات به اندازه‌ی تصویر اصلی
            x1, y1, x2, y2 = (
                x1 / scale, y1 / scale, x2 / scale, y2 / scale
            )

            defects.append({
                "class_id": class_id,
                "class_name": self.model.names[class_id],
                "confidence": round(confidence, 4),
                "confidence_percent": round(
                    confidence * 100, 2
                ),
                "bbox": {
                    "x1": round(x1, 2),
                    "y1": round(y1, 2),
                    "x2": round(x2, 2),
                    "y2": round(y2, 2)
                }
            })

        counts = Counter(
            defect["class_name"] for defect in defects
        )

        annotated_image = result.plot()

        output_image = (
            IMAGE_OUTPUT_DIR
            / f"{image_path.stem}_detected.jpg"
        )

        saved = cv2.imwrite(
            str(output_image),
            annotated_image
        )

        if not saved:
            raise OSError(
                f"Could not save annotated image: {output_image}"
            )

        report = {
            "image_name": original_filename or image_path.name,
            "image_width": orig_w,
            "image_height": orig_h,
            "total_defects": len(defects),
            "defect_counts": dict(counts),
            "detections": defects,
            "annotated_image": str(output_image.resolve())
        }

        output_json = (
            REPORT_OUTPUT_DIR
            / f"{image_path.stem}_report.json"
        )

        with output_json.open("w", encoding="utf-8") as file:
            json.dump(
                report,
                file,
                ensure_ascii=False,
                indent=4
            )

        return report


if __name__ == "__main__":
    detector = DefectDetector()

    test_image = (
        BASE_DIR
        / "data"
        / "images"
        / "test"
        / "img_01_3436789500_00004.jpg"
    )

    report = detector.predict(test_image)

    print("\n===== Defect Detection Report =====")
    print(json.dumps(report, ensure_ascii=False, indent=4))
    print("\nDetection completed successfully.")