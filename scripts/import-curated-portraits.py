#!/usr/bin/env python3
"""Normalize manually curated portraits without changing their source files."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageOps


TARGET_SIZE = (1200, 1500)


def load_manifest(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("The manifest must contain a JSON list.")
    return data


def normalize(source: Path, destination: Path, focal_point: list[float]) -> None:
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original).convert("RGB")
        fitted = ImageOps.fit(
            image,
            TARGET_SIZE,
            method=Image.Resampling.LANCZOS,
            centering=(float(focal_point[0]), float(focal_point[1])),
        )
        destination.parent.mkdir(parents=True, exist_ok=True)
        fitted.save(destination, "JPEG", quality=90, optimize=True, progressive=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("source_dir", type=Path)
    parser.add_argument("portrait_dir", type=Path)
    parser.add_argument("reserve_dir", type=Path)
    args = parser.parse_args()

    for item in load_manifest(args.manifest):
        source = args.source_dir / item["source"]
        if not source.exists():
            raise FileNotFoundError(source)

        if item.get("personId"):
            destination = args.portrait_dir / f'{int(item["personId"]):03d}.jpg'
        else:
            destination = args.reserve_dir / f'{item["id"]}.jpg'

        normalize(source, destination, item.get("focalPoint", [0.5, 0.5]))
        print(f"{item['name']}: {destination}")


if __name__ == "__main__":
    main()
