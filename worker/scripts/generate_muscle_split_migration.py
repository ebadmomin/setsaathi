"""Build the D1 migration for muscle-split templates from the shared catalogue."""
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / "backend"))
from app.template_catalog import FOCUSES, POOLS, STRUCTURES  # noqa: E402


def sql(value):
    return "'" + json.dumps(value, ensure_ascii=False).replace("'", "''") + "'"


lines = ["-- Muscle split templates and 24 rotating variants for each experience level."]
for index, (experience, structure) in enumerate(STRUCTURES.items(), start=10):
    pools = {focus: POOLS[focus] for focus in FOCUSES["Muscle split"]}
    lines.append(
        "INSERT INTO plan_templates (id,experience,split,version,structure_json,pools_json,published) "
        f"VALUES ({index},'{experience}','Muscle split',1,{sql(structure)},{sql(pools)},1);"
    )
    for number in range(1, 25):
        rotated = {focus: {phase: names[(number - 1) % len(names):] + names[:(number - 1) % len(names)]
                           for phase, names in phases.items()} for focus, phases in pools.items()}
        lines.append(
            "INSERT INTO plan_variants (template_id,number,pools_json,published) "
            f"VALUES ({index},{number},{sql(rotated)},1);"
        )

(root / "migrations" / "0006_muscle_split_templates.sql").write_text("\n".join(lines) + "\n", encoding="utf-8")
