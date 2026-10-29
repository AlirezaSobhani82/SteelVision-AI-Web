from pathlib import Path
from collections import Counter
import json

from src.detector import DefectDetector


BASE_DIR = Path(__file__).resolve().parent.parent

OUTPUT_DIR = BASE_DIR / "outputs"
BATCH_OUTPUT_DIR = OUTPUT_DIR / "batch"

BATCH_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

SUPPORTED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"
}


class DefectService:
    def __init__(self, detector=None):
        self.detector = detector or DefectDetector()

    def process_image(self, image_path, conf=0.25):
        return self.detector.predict(image_path, conf=conf)

    def process_folder(self, folder_path, conf=0.25):
        folder_path = Path(folder_path)

        if not folder_path.is_dir():
            raise NotADirectoryError(
                f"Folder not found: {folder_path}"
            )

        if not 0.0 <= conf <= 1.0:
            raise ValueError(
                "Confidence threshold must be between 0 and 1."
            )

        image_paths = sorted(
            path
            for path in folder_path.iterdir()
            if path.is_file()
            and path.suffix.lower() in SUPPORTED_EXTENSIONS
        )

        if not image_paths:
            raise ValueError(
                f"No supported images found in: {folder_path}"
            )

        reports = []
        errors = []

        for index, image_path in enumerate(image_paths, start=1):
            print(
                f"[{index}/{len(image_paths)}] "
                f"Processing: {image_path.name}"
            )

            try:
                report = self.process_image(image_path, conf=conf)
                reports.append(report)

            except Exception as exc:
                errors.append({
                    "image_name": image_path.name,
                    "error": str(exc)
                })

                print(f"  ERROR: {exc}")

        total_counts = Counter()

        for report in reports:
            total_counts.update(report["defect_counts"])

        summary = {
            "source_folder": str(folder_path.resolve()),
            "images_found": len(image_paths),
            "images_processed": len(reports),
            "images_failed": len(errors),
            "total_defects": sum(
                report["total_defects"] for report in reports
            ),
            "defect_counts": dict(total_counts),
            "errors": errors,
            "image_reports": reports
        }

        summary_path = BATCH_OUTPUT_DIR / "batch_summary.json"

        with summary_path.open("w", encoding="utf-8") as file:
            json.dump(
                summary,
                file,
                ensure_ascii=False,
                indent=4
            )

        summary["summary_file"] = str(summary_path.resolve())

        print("\n===== Batch Summary =====")
        print(f"Images found:      {summary['images_found']}")
        print(f"Images processed:  {summary['images_processed']}")
        print(f"Images failed:     {summary['images_failed']}")
        print(f"Total defects:     {summary['total_defects']}")
        print(f"Defect counts:     {summary['defect_counts']}")
        print(f"Summary saved to:  {summary_path}")

        return summary


if __name__ == "__main__":
    service = DefectService()

    test_folder = BASE_DIR / "data" / "images" / "test"

    service.process_folder(
        folder_path=test_folder,
        conf=0.25
    )