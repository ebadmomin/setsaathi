# SetSaathi exercise library

## Current catalogue

SetSaathi contains its original exercises plus every record currently published
by Free Exercise DB. The 19 November 2026 import contained 876 source records,
giving the local database 884 exercises after deduplication and preservation of
the original SetSaathi records.

Each imported record stores:

- exercise name, category, difficulty, and equipment;
- primary and secondary muscles;
- the complete source-provided, step-by-step performance technique;
- movement force and mechanic when supplied;
- a demonstration image when supplied;
- source name, record URL, and licence URL;
- SetSaathi safety, posture, breathing, and common-error guidance.

Source-provided facts and SetSaathi guidance are stored separately. The UI also
links back to the exact source record and licence. Missing source information is
labelled honestly rather than invented.

## Refreshing the catalogue

From the repository root, run:

```powershell
.venv\Scripts\python backend\scripts\import_free_exercise_db.py
```

For an offline or audited import, download `dist/exercises.json` from the source
repository and run:

```powershell
.venv\Scripts\python backend\scripts\import_free_exercise_db.py --input C:\path\to\exercises.json
```

The importer upserts by source ID and then by normalized exercise name. It is
safe to re-run. A refresh never deletes SetSaathi-created exercises.

## Source and licensing

- Dataset: Free Exercise DB by yuhonas
- Repository: https://github.com/yuhonas/free-exercise-db
- Licence: The Unlicense / public domain
- Licence text: https://github.com/yuhonas/free-exercise-db/blob/main/LICENSE.md

Do not bulk-copy exercises or media from arbitrary fitness websites. Additional
sources should only be imported after confirming record-level commercial-use
rights, attribution requirements, provenance, and a deduplication strategy.

## Safety review

This library is educational and is not a substitute for diagnosis, treatment,
or individual coaching. Before production release, high-risk movements should
be reviewed by a qualified strength and conditioning or physiotherapy
professional. Keep visible warnings for sharp pain, spinal loading, pregnancy,
recent surgery, and existing medical conditions.
