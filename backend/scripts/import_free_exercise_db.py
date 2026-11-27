r"""Import the public-domain Free Exercise DB catalogue into SetSaathi.

Run from the repository root:
    .venv\Scripts\python backend\scripts\import_free_exercise_db.py

The application never needs to call the source API at runtime. Re-running this
script updates existing source records and adds new ones without duplicating
them. Source and licence metadata remain attached to every imported exercise.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from urllib.request import Request, urlopen


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPOSITORY_ROOT / "backend"))

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import migrate_exercise_library  # noqa: E402
from app.models import Exercise  # noqa: E402
from sqlalchemy import select  # noqa: E402


DATA_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json"
IMAGE_BASE_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/"
SOURCE_URL = "https://github.com/yuhonas/free-exercise-db"
LICENSE_URL = "https://github.com/yuhonas/free-exercise-db/blob/main/LICENSE.md"
SOURCE_NAME = "Free Exercise DB"


def title(value: str | None, fallback: str) -> str:
    return (value or fallback).replace("_", " ").strip().title()


def load_catalogue(input_path: Path | None) -> list[dict]:
    if input_path:
        return json.loads(input_path.read_text(encoding="utf-8"))
    request = Request(DATA_URL, headers={"User-Agent": "SetSaathi exercise importer"})
    with urlopen(request, timeout=60) as response:
        return json.load(response)


def import_catalogue(records: list[dict]) -> tuple[int, int, int]:
    Base.metadata.create_all(bind=engine)
    migrate_exercise_library()
    added = updated = skipped = 0
    with SessionLocal() as db:
        existing_by_source = {
            item.source_id: item
            for item in db.scalars(select(Exercise).where(Exercise.source_name == SOURCE_NAME))
            if item.source_id
        }
        existing_by_name = {item.name.casefold(): item for item in db.scalars(select(Exercise))}

        for record in records:
            source_id = str(record.get("id") or "").strip()
            name = str(record.get("name") or "").strip()
            primary = record.get("primaryMuscles") or []
            instructions = record.get("instructions") or []
            if not source_id or not name:
                skipped += 1
                continue

            primary = primary or ["full body"]
            instructions = instructions or ["Detailed instructions are not available in the source record."]

            exercise = existing_by_source.get(source_id) or existing_by_name.get(name.casefold())
            is_new = exercise is None
            if is_new:
                exercise = Exercise(
                    name=name,
                    primary_muscle=title(primary[0], "Full Body"),
                    equipment=title(record.get("equipment"), "Bodyweight"),
                    difficulty=title(record.get("level"), "Not Specified"),
                    instructions="\n".join(f"{index}. {step.strip()}" for index, step in enumerate(instructions, 1)),
                    common_mistake="Use controlled form and avoid compensating with unrelated joints.",
                    substitute="See related exercises for the same primary muscle.",
                )

            images = record.get("images") or []
            exercise.primary_muscle = title(primary[0], "Full Body")
            exercise.secondary_muscles = ", ".join(title(muscle, "") for muscle in record.get("secondaryMuscles") or [])
            exercise.category = title(record.get("category"), "General")
            exercise.equipment = title(record.get("equipment"), "Bodyweight")
            exercise.difficulty = title(record.get("level"), "Not Specified")
            exercise.instructions = "\n".join(f"{index}. {step.strip()}" for index, step in enumerate(instructions, 1))
            exercise.posture = "Follow each setup cue and keep the movement controlled through a pain-free range."
            exercise.breathing = "Breathe continuously; exhale during the effort and inhale during the controlled return unless the instructions specify otherwise."
            exercise.safety_tips = "Use an appropriate load and stop for sharp, radiating, or worsening pain. Seek qualified guidance when unsure."
            exercise.media_status = "public-domain-source"
            exercise.media_url = f"{IMAGE_BASE_URL}{images[0]}" if images else None
            exercise.source_name = SOURCE_NAME
            exercise.source_id = source_id
            exercise.source_url = f"{SOURCE_URL}/blob/main/exercises/{source_id}.json"
            exercise.license_name = "The Unlicense / Public Domain"
            exercise.license_url = LICENSE_URL
            exercise.movement_force = record.get("force")
            exercise.movement_mechanic = record.get("mechanic")

            if is_new:
                db.add(exercise)
                existing_by_source[source_id] = exercise
                existing_by_name[name.casefold()] = exercise
                added += 1
            else:
                updated += 1

        db.commit()
    return added, updated, skipped


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Free Exercise DB into SetSaathi")
    parser.add_argument("--input", type=Path, help="Use a previously downloaded exercises.json file")
    args = parser.parse_args()
    records = load_catalogue(args.input)
    added, updated, skipped = import_catalogue(records)
    print(f"Imported {len(records)} source records: {added} added, {updated} updated, {skipped} skipped.")


if __name__ == "__main__":
    main()
