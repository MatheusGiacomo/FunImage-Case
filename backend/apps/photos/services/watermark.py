"""
apps/photos/services/watermark.py
Watermark service — applies a semi-transparent text watermark to images.

Design decisions:
  - Text watermark in the bottom-right corner with configurable opacity
  - Font scales proportionally to image width (9% by default)
  - Semi-transparent dark pill behind text for contrast on any background
  - Drop shadow with bigger offset for depth on light backgrounds
  - Repeated tiled watermark option for maximum IP protection
  - Preserves EXIF orientation before processing
  - Returns bytes — stateless, no filesystem side effects in the service itself
"""

import io
import logging
from pathlib import Path
from typing import Literal

from PIL import Image, ImageDraw, ImageFont, ExifTags
from django.conf import settings

logger = logging.getLogger(__name__)

WatermarkPosition = Literal["bottom-right", "center", "tiled"]


def _correct_orientation(image: Image.Image) -> Image.Image:
    """Auto-rotate image according to EXIF orientation tag."""
    try:
        exif = image._getexif()
        if exif is None:
            return image
        orientation_key = next(
            (k for k, v in ExifTags.TAGS.items() if v == "Orientation"), None
        )
        if orientation_key is None or orientation_key not in exif:
            return image
        orientation = exif[orientation_key]
        rotations = {3: 180, 6: 270, 8: 90}
        if orientation in rotations:
            image = image.rotate(rotations[orientation], expand=True)
    except Exception:
        pass
    return image


def _get_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """Load a TrueType font, falling back to default if unavailable."""
    font_candidates = [
        Path(__file__).parent.parent.parent / "static" / "fonts" / "Montserrat-SemiBold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]
    for font_path in font_candidates:
        if Path(font_path).exists():
            try:
                return ImageFont.truetype(str(font_path), size)
            except Exception:
                continue
    logger.warning("TrueType font not found, using default PIL font")
    return ImageFont.load_default()


def apply_watermark(
    image_bytes: bytes,
    text: str | None = None,
    opacity: float | None = None,
    position: WatermarkPosition = "bottom-right",
    logo_bytes: bytes | None = None,
) -> bytes:
    """
    Apply a professional watermark to an image.

    Args:
        image_bytes: Raw image bytes (JPEG/PNG/WebP)
        text: Watermark text (defaults to settings.WATERMARK_TEXT)
        opacity: 0.0–1.0 (defaults to settings.WATERMARK_OPACITY)
        position: Placement strategy
        logo_bytes: Optional logo PNG to use instead of text

    Returns:
        JPEG bytes of the watermarked image.
    """
    text = text or settings.WATERMARK_TEXT
    opacity = opacity if opacity is not None else settings.WATERMARK_OPACITY
    alpha = int(255 * opacity)

    # ── Load image ──────────────────────────────────────────────────────
    image = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    image = _correct_orientation(image)
    img_w, img_h = image.size

    # ── Create watermark layer ──────────────────────────────────────────
    watermark_layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(watermark_layer)

    if logo_bytes:
        _apply_logo_watermark(watermark_layer, logo_bytes, alpha, position, img_w, img_h)
    else:
        _apply_text_watermark(draw, watermark_layer, text, alpha, position, img_w, img_h)

    # ── Composite ───────────────────────────────────────────────────────
    composited = Image.alpha_composite(image, watermark_layer)
    output = composited.convert("RGB")

    # ── Encode to JPEG ──────────────────────────────────────────────────
    buf = io.BytesIO()
    output.save(buf, format="JPEG", quality=92, optimize=True, progressive=True)
    return buf.getvalue()


def _apply_text_watermark(
    draw: ImageDraw.ImageDraw,
    layer: Image.Image,
    text: str,
    alpha: int,
    position: WatermarkPosition,
    img_w: int,
    img_h: int,
) -> None:
    """Draw semi-transparent text watermark with background pill for contrast."""
    font_size = max(24, int(img_w * settings.WATERMARK_FONT_SCALE))
    font = _get_font(font_size)

    # Measure text
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    # Margin scales with image size — 3% of width, minimum 30px
    margin = max(30, int(img_w * 0.03))

    if position == "tiled":
        _draw_tiled_text(draw, text, font, alpha, img_w, img_h, text_w, text_h)
    elif position == "center":
        x = (img_w - text_w) // 2
        y = (img_h - text_h) // 2
        _draw_pill_background(draw, x, y, text_w, text_h, font_size, alpha)
        _draw_text_with_shadow(draw, (x, y), text, font, alpha)
    else:  # bottom-right
        x = img_w - text_w - margin
        y = img_h - text_h - margin
        _draw_pill_background(draw, x, y, text_w, text_h, font_size, alpha)
        _draw_text_with_shadow(draw, (x, y), text, font, alpha)


def _draw_pill_background(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    text_w: int,
    text_h: int,
    font_size: int,
    text_alpha: int,
) -> None:
    """
    Draw a rounded-rectangle (pill) behind the watermark text.
    Makes the text legible on both dark and light backgrounds.
    Background opacity is 55% of the text opacity so it never overpowers.
    """
    pad_x = int(font_size * 0.55)
    pad_y = int(font_size * 0.30)
    radius = int(font_size * 0.35)
    bg_alpha = int(text_alpha * 0.55)

    rect = [
        x - pad_x,
        y - pad_y,
        x + text_w + pad_x,
        y + text_h + pad_y,
    ]
    draw.rounded_rectangle(rect, radius=radius, fill=(0, 0, 0, bg_alpha))


def _draw_text_with_shadow(
    draw: ImageDraw.ImageDraw,
    position: tuple[int, int],
    text: str,
    font,
    alpha: int,
) -> None:
    """
    Draw text with a stronger drop shadow for legibility on any background.
    Shadow offset is 3px (up from 2px) and shadow opacity is higher.
    """
    x, y = position
    # Shadow is fully opaque so it always punches through the background
    shadow_alpha = min(alpha + 100, 255)

    # Multi-pass shadow for a softer, deeper look
    draw.text((x + 3, y + 3), text, font=font, fill=(0, 0, 0, shadow_alpha))
    draw.text((x + 2, y + 2), text, font=font, fill=(0, 0, 0, shadow_alpha - 30))
    # Main text — white
    draw.text((x, y), text, font=font, fill=(255, 255, 255, alpha))


def _draw_tiled_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    font,
    alpha: int,
    img_w: int,
    img_h: int,
    text_w: int,
    text_h: int,
) -> None:
    """
    Tile watermark across the entire image in a diagonal grid.
    Tighter spacing (was +80/+60 gap, now +50/+40) and each tile
    gets the pill background so tiles remain readable everywhere.
    """
    step_x = text_w + 50
    step_y = text_h + 40
    for y in range(-text_h, img_h + step_y, step_y):
        for x in range(-text_w, img_w + step_x, step_x):
            _draw_pill_background(draw, x, y, text_w, text_h, int(text_h * 0.8), alpha)
            _draw_text_with_shadow(draw, (x, y), text, font, alpha)


def _apply_logo_watermark(
    layer: Image.Image,
    logo_bytes: bytes,
    alpha: int,
    position: WatermarkPosition,
    img_w: int,
    img_h: int,
) -> None:
    """Paste a logo PNG as watermark — scaled to 22% of image width (up from 15%)."""
    logo = Image.open(io.BytesIO(logo_bytes)).convert("RGBA")

    # Scale logo to 22% of image width for better visibility
    logo_target_w = max(100, int(img_w * 0.22))
    ratio = logo_target_w / logo.width
    logo = logo.resize(
        (logo_target_w, int(logo.height * ratio)),
        Image.Resampling.LANCZOS,
    )

    # Apply opacity
    r, g, b, a = logo.split()
    a = a.point(lambda p: int(p * alpha / 255))
    logo = Image.merge("RGBA", (r, g, b, a))

    margin = max(30, int(img_w * 0.03))
    if position == "bottom-right":
        x = img_w - logo.width - margin
        y = img_h - logo.height - margin
    elif position == "center":
        x = (img_w - logo.width) // 2
        y = (img_h - logo.height) // 2
    else:
        x, y = margin, margin

    layer.paste(logo, (x, y), logo)


def generate_thumbnail(image_bytes: bytes, max_size: tuple[int, int] = None) -> bytes:
    """
    Generate an optimized thumbnail from image bytes.
    Maintains aspect ratio, strips EXIF, progressive JPEG.
    """
    max_size = max_size or settings.THUMBNAIL_SIZE
    image = Image.open(io.BytesIO(image_bytes))
    image = _correct_orientation(image)

    # Convert RGBA/P to RGB for JPEG
    if image.mode in ("RGBA", "P"):
        background = Image.new("RGB", image.size, (255, 255, 255))
        if image.mode == "RGBA":
            background.paste(image, mask=image.split()[3])
        else:
            background.paste(image)
        image = background
    elif image.mode != "RGB":
        image = image.convert("RGB")

    image.thumbnail(max_size, Image.Resampling.LANCZOS)

    buf = io.BytesIO()
    image.save(
        buf,
        format="JPEG",
        quality=settings.THUMBNAIL_QUALITY,
        optimize=True,
        progressive=True,
    )
    return buf.getvalue()


def extract_image_dimensions(image_bytes: bytes) -> tuple[int, int]:
    """Return (width, height) of an image without full decode."""
    image = Image.open(io.BytesIO(image_bytes))
    image = _correct_orientation(image)
    return image.size
