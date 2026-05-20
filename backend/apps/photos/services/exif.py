"""
apps/photos/services/exif.py
EXIF metadata extraction — stores results in MongoDB (schemaless, flexible).
"""

import io
import logging
from datetime import datetime
from typing import Any

from PIL import Image, ExifTags
# ALTERADO: Importa TiffImagePlugin para acessar o tipo IFDRational de forma segura
from PIL.TiffImagePlugin import IFDRational

from apps.core.mongo import get_photo_metadata_collection

logger = logging.getLogger(__name__)

# Friendly EXIF tag names we care about
EXIF_TAGS_OF_INTEREST = {
    "Make": "camera_make",
    "Model": "camera_model",
    "LensModel": "lens",
    "ISOSpeedRatings": "iso",
    "FNumber": "aperture",
    "ExposureTime": "shutter_speed",
    "FocalLength": "focal_length",
    "DateTimeOriginal": "taken_at",
    "GPSInfo": "gps",
    "Flash": "flash",
    "WhiteBalance": "white_balance",
    "ExposureMode": "exposure_mode",
    "MeteringMode": "metering_mode",
    "Software": "software",
    "Orientation": "orientation",
}


def _convert_value(value: Any) -> Any:
    """Convert PIL EXIF types to JSON-serializable Python types."""
    # O IFDRational no Pillow moderno pode ser comparado assim
    if isinstance(value, IFDRational):
        try:
            return float(value) if value.denominator != 0 else None
        except Exception:
            return None

    # Tratamento para frações do Pillow (comum em ExposureTime)
    if hasattr(value, 'numerator') and hasattr(value, 'denominator'):
        return float(value.numerator) / float(value.denominator) if value.denominator != 0 else None

    if isinstance(value, bytes):
        try:
            return value.decode("utf-8", errors="replace")
        except Exception:
            return None
    if isinstance(value, tuple):
        return [_convert_value(v) for v in value]
    if isinstance(value, dict):
        return {k: _convert_value(v) for k, v in value.items()}
    return value


def _extract_gps(gps_data: dict) -> dict[str, float]:
    """Parse GPS IFD into lat/lng decimal degrees."""
    result = {}
    try:
        def to_degrees(values):
            d, m, s = [float(v) for v in values]
            return d + m / 60 + s / 3600

        if 2 in gps_data and 4 in gps_data:
            lat = to_degrees(gps_data[2])
            lng = to_degrees(gps_data[4])
            lat_ref = gps_data.get(1, b"N")
            lng_ref = gps_data.get(3, b"E")
            if isinstance(lat_ref, bytes):
                lat_ref = lat_ref.decode()
            if isinstance(lng_ref, bytes):
                lng_ref = lng_ref.decode()
            result["lat"] = lat if lat_ref == "N" else -lat
            result["lng"] = lng if lng_ref == "E" else -lng
    except Exception as e:
        logger.debug("GPS parsing failed: %s", e)
    return result


def extract_exif(image_bytes: bytes) -> dict:
    """
    Extract EXIF metadata from image bytes.
    Returns a clean dict with only the fields we track.
    """
    exif_data: dict[str, Any] = {}

    try:
        image = Image.open(io.BytesIO(image_bytes))
        raw_exif = image._getexif()
        if raw_exif is None:
            return exif_data

        # Build tag name → value map
        tag_map = {ExifTags.TAGS.get(tag_id, str(tag_id)): value for tag_id, value in raw_exif.items()}

        for tag_name, friendly_name in EXIF_TAGS_OF_INTEREST.items():
            value = tag_map.get(tag_name)
            if value is None:
                continue

            if tag_name == "GPSInfo":
                gps = _extract_gps(value)
                if gps:
                    exif_data["gps_lat"] = gps.get("lat")
                    exif_data["gps_lng"] = gps.get("lng")
            elif tag_name == "DateTimeOriginal":
                try:
                    exif_data[friendly_name] = datetime.strptime(str(value), "%Y:%m:%d %H:%M:%S")
                except ValueError:
                    exif_data[friendly_name] = str(value)
            elif tag_name == "FNumber":
                v = _convert_value(value)
                exif_data[friendly_name] = f"f/{v:.1f}" if v else None
            elif tag_name == "ExposureTime":
                v = _convert_value(value)
                if v:
                    if v < 1:
                        exif_data[friendly_name] = f"1/{int(round(1/v))}s"
                    else:
                        exif_data[friendly_name] = f"{v}s"
            elif tag_name == "FocalLength":
                v = _convert_value(value)
                exif_data[friendly_name] = f"{v:.0f}mm" if v else None
            else:
                exif_data[friendly_name] = _convert_value(value)

        # Combine make + model
        make = exif_data.pop("camera_make", None)
        model = exif_data.get("camera_model")
        if make and model and not model.startswith(make):
            exif_data["camera_model"] = f"{make} {model}"

    except Exception as e:
        logger.warning("EXIF extraction failed: %s", e)

    return exif_data


def save_photo_metadata(
    photo_id: str,
    exif: dict,
    processing_info: dict,
) -> None:
    """
    Persist photo metadata to MongoDB.
    Upserts on photo_id — safe to call multiple times.
    """
    col = get_photo_metadata_collection()
    doc = {
        "photo_id": photo_id,
        "exif": exif,
        "processing": processing_info,
        "updated_at": datetime.utcnow(),
    }
    col.update_one(
        {"photo_id": photo_id},
        {
            "$set": doc,
            "$setOnInsert": {"created_at": datetime.utcnow()},
        },
        upsert=True,
    )
    logger.debug("Photo metadata saved to MongoDB: %s", photo_id)


def get_photo_metadata(photo_id: str) -> dict | None:
    """Retrieve photo metadata from MongoDB."""
    col = get_photo_metadata_collection()
    doc = col.find_one({"photo_id": photo_id}, {"_id": 0})
    return doc
