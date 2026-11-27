"""Gym-owned equipment shown to members and required by library movements."""

GYM_EQUIPMENT_GROUPS = {
    "Strength machines": [
        "Hip Abductor Machine", "Hip Adductor Machine", "Chest Press Machine",
        "Pec Deck / Chest Fly Machine", "Shoulder Press Machine", "Lat Pulldown Machine",
        "Seated Row Machine", "Leg Press Machine", "Leg Extension Machine",
        "Leg Curl Machine", "Hack Squat Machine", "Smith Machine",
        "Assisted Dip Machine", "Biceps Curl Machine", "Triceps Extension Machine",
        "Ab Crunch Machine", "Calf Raise Machine", "Reverse Hyper Machine",
        "T-Bar Row Machine", "Glute Ham Developer", "Plate-loaded Leverage Machine",
    ],
    "Cardio machines": [
        "Treadmill", "Elliptical Trainer", "Stationary Bike", "Rowing Machine",
        "Stair Climber",
    ],
    "Free weights and stations": [
        "Dumbbells", "Barbell", "Kettlebells", "EZ Curl Bar", "Bench",
        "Squat Rack", "Pull-up Bar", "Dip Bars", "Trap Bar",
    ],
    "Training accessories": [
        "Cable Station", "Resistance Bands", "Battle Ropes", "Medicine Ball",
        "Stability Ball", "Foam Roller", "Jump Rope", "Plyo Box", "Sled",
        "Suspension Trainer", "Pool",
    ],
}

GYM_EQUIPMENT_NAMES = frozenset(name for names in GYM_EQUIPMENT_GROUPS.values() for name in names)

SIMPLE_REQUIREMENTS = {
    "Dumbbell": "Dumbbells", "Barbell": "Barbell", "Kettlebells": "Kettlebells",
    "E-Z Curl Bar": "EZ Curl Bar", "Bands": "Resistance Bands",
    "Medicine Ball": "Medicine Ball", "Exercise Ball": "Stability Ball",
    "Foam Roll": "Foam Roller", "Battle Rope": "Battle Ropes",
    "Bench": "Bench", "Pool": "Pool",
}


def machine_requirement(name: str) -> str | None:
    """Map identifiable machine exercises; leave ambiguous machines for review."""
    if "abductor" in name: return "Hip Abductor Machine"
    if "adductor" in name: return "Hip Adductor Machine"
    if "smith" in name: return "Smith Machine"
    if "treadmill" in name: return "Treadmill"
    if "elliptical" in name: return "Elliptical Trainer"
    if "bike" in name or "bicycling" in name: return "Stationary Bike"
    if "rowing, stationary" in name: return "Rowing Machine"
    if "stairmaster" in name or "step mill" in name: return "Stair Climber"
    if "leg press" in name or "calf press on the leg press" in name: return "Leg Press Machine"
    if "leg extension" in name: return "Leg Extension Machine"
    if "leg curl" in name: return "Leg Curl Machine"
    if "hack squat" in name or "lying machine squat" in name: return "Hack Squat Machine"
    if "chest press" in name or "machine bench press" in name: return "Chest Press Machine"
    if "butterfly" in name or "machine fly" in name: return "Pec Deck / Chest Fly Machine"
    if "shoulder press" in name or "shoulder (military) press" in name: return "Shoulder Press Machine"
    if "high row" in name or "iso row" in name: return "Seated Row Machine"
    if "dip machine" in name: return "Assisted Dip Machine"
    if "machine bicep" in name or "machine preacher" in name: return "Biceps Curl Machine"
    if "machine triceps" in name: return "Triceps Extension Machine"
    if "ab crunch machine" in name: return "Ab Crunch Machine"
    if "calf" in name: return "Calf Raise Machine"
    if "reverse hyper" in name: return "Reverse Hyper Machine"
    if "t-bar row" in name: return "T-Bar Row Machine"
    if "glute ham raise" in name: return "Glute Ham Developer"
    if "leverage" in name: return "Plate-loaded Leverage Machine"
    if "chair squat" in name: return "Bench"
    return None


def other_requirement(name: str) -> set[str] | None:
    if "rope jumping" in name: return {"Jump Rope"}
    if "band assisted pull-up" in name: return {"Resistance Bands", "Pull-up Bar"}
    if "pull-up" in name or "pull ups" in name or "chin" in name: return {"Pull-up Bar"}
    if "dips" in name or "dip" in name: return {"Dip Bars"}
    if "box" in name or "depth jump" in name: return {"Plyo Box"}
    if "sled" in name or "prowler" in name: return {"Sled"}
    if ("battle" in name or "battling" in name) and "rope" in name: return {"Battle Ropes"}
    if "suspended" in name or "straps" in name: return {"Suspension Trainer"}
    if "trap bar" in name: return {"Trap Bar"}
    if "bench" in name: return {"Bench"}
    if "band" in name: return {"Resistance Bands"}
    if "plate" in name: return {"Barbell"}
    if "farmer's walk" in name: return {"Dumbbells"}
    return None


def requirements_for(exercise) -> set[str] | None:
    """Return required gym assets, empty for bodyweight, None if not safely mapped."""
    name = exercise.name.casefold()
    label = exercise.equipment
    if name == "bench dips":
        return {"Bench"}
    if label in {"Bodyweight", "Body Only", "None"}:
        return set()
    if label == "Walking Shoes":
        return None
    if label == "Machine":
        machine = machine_requirement(name)
        return {machine} if machine else None
    if label == "Cable":
        if "pulldown" in name and "straight-arm" not in name and "rope" not in name:
            return {"Lat Pulldown Machine"}
        if "seated cable row" in name or "low pulley row" in name:
            return {"Seated Row Machine"}
        return {"Cable Station"}
    if label == "Other":
        return other_requirement(name)
    asset = SIMPLE_REQUIREMENTS.get(label)
    if not asset:
        return None
    required = {asset}
    if label == "Dumbbell" and ("bench" in name or ("incline" in name or "decline" in name) and ("press" in name or "fly" in name)):
        required.add("Bench")
    if label == "Barbell" and "squat" in name:
        required.add("Squat Rack")
    if label == "Barbell" and "bench press" in name:
        required.add("Bench")
    return required
