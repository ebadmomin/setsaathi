// Port of backend/app/equipment_catalog.py.
export const GYM_EQUIPMENT_GROUPS: Record<string, string[]> = {
  "Strength machines": [
    "Hip Abductor Machine", "Hip Adductor Machine", "Chest Press Machine",
    "Pec Deck / Chest Fly Machine", "Shoulder Press Machine", "Lat Pulldown Machine",
    "Seated Row Machine", "Leg Press Machine", "Leg Extension Machine",
    "Leg Curl Machine", "Hack Squat Machine", "Smith Machine",
    "Assisted Dip Machine", "Biceps Curl Machine", "Triceps Extension Machine",
    "Ab Crunch Machine", "Calf Raise Machine", "Reverse Hyper Machine",
    "T-Bar Row Machine", "Glute Ham Developer", "Plate-loaded Leverage Machine",
  ],
  "Cardio machines": ["Treadmill", "Elliptical Trainer", "Stationary Bike", "Rowing Machine", "Stair Climber"],
  "Free weights and stations": ["Dumbbells", "Barbell", "Kettlebells", "EZ Curl Bar", "Bench", "Squat Rack", "Pull-up Bar", "Dip Bars", "Trap Bar"],
  "Training accessories": [
    "Cable Station", "Resistance Bands", "Battle Ropes", "Medicine Ball",
    "Stability Ball", "Foam Roller", "Jump Rope", "Plyo Box", "Sled",
    "Suspension Trainer", "Pool",
  ],
};

export const GYM_EQUIPMENT_NAMES = new Set(Object.values(GYM_EQUIPMENT_GROUPS).flat());

const SIMPLE_REQUIREMENTS: Record<string, string> = {
  Dumbbell: "Dumbbells", Barbell: "Barbell", Kettlebells: "Kettlebells",
  "E-Z Curl Bar": "EZ Curl Bar", Bands: "Resistance Bands",
  "Medicine Ball": "Medicine Ball", "Exercise Ball": "Stability Ball",
  "Foam Roll": "Foam Roller", "Battle Rope": "Battle Ropes",
  Bench: "Bench", Pool: "Pool",
};

function machineRequirement(n: string): string | null {
  const has = (s: string) => n.includes(s);
  if (has("abductor")) return "Hip Abductor Machine";
  if (has("adductor")) return "Hip Adductor Machine";
  if (has("smith")) return "Smith Machine";
  if (has("treadmill")) return "Treadmill";
  if (has("elliptical")) return "Elliptical Trainer";
  if (has("bike") || has("bicycling")) return "Stationary Bike";
  if (has("rowing, stationary")) return "Rowing Machine";
  if (has("stairmaster") || has("step mill")) return "Stair Climber";
  if (has("leg press") || has("calf press on the leg press")) return "Leg Press Machine";
  if (has("leg extension")) return "Leg Extension Machine";
  if (has("leg curl")) return "Leg Curl Machine";
  if (has("hack squat") || has("lying machine squat")) return "Hack Squat Machine";
  if (has("chest press") || has("machine bench press")) return "Chest Press Machine";
  if (has("butterfly") || has("machine fly")) return "Pec Deck / Chest Fly Machine";
  if (has("shoulder press") || has("shoulder (military) press")) return "Shoulder Press Machine";
  if (has("high row") || has("iso row")) return "Seated Row Machine";
  if (has("dip machine")) return "Assisted Dip Machine";
  if (has("machine bicep") || has("machine preacher")) return "Biceps Curl Machine";
  if (has("machine triceps")) return "Triceps Extension Machine";
  if (has("ab crunch machine")) return "Ab Crunch Machine";
  if (has("calf")) return "Calf Raise Machine";
  if (has("reverse hyper")) return "Reverse Hyper Machine";
  if (has("t-bar row")) return "T-Bar Row Machine";
  if (has("glute ham raise")) return "Glute Ham Developer";
  if (has("leverage")) return "Plate-loaded Leverage Machine";
  if (has("chair squat")) return "Bench";
  return null;
}

function otherRequirement(n: string): string[] | null {
  const has = (s: string) => n.includes(s);
  if (has("rope jumping")) return ["Jump Rope"];
  if (has("band assisted pull-up")) return ["Resistance Bands", "Pull-up Bar"];
  if (has("pull-up") || has("pull ups") || has("chin")) return ["Pull-up Bar"];
  if (has("dips") || has("dip")) return ["Dip Bars"];
  if (has("box") || has("depth jump")) return ["Plyo Box"];
  if (has("sled") || has("prowler")) return ["Sled"];
  if ((has("battle") || has("battling")) && has("rope")) return ["Battle Ropes"];
  if (has("suspended") || has("straps")) return ["Suspension Trainer"];
  if (has("trap bar")) return ["Trap Bar"];
  if (has("bench")) return ["Bench"];
  if (has("band")) return ["Resistance Bands"];
  if (has("plate")) return ["Barbell"];
  if (has("farmer's walk")) return ["Dumbbells"];
  return null;
}

/** Required gym assets; empty array for bodyweight, null if not safely mapped. */
export function requirementsFor(exercise: { name: string; equipment: string }): string[] | null {
  const name = exercise.name.toLowerCase();
  const label = exercise.equipment;
  if (name === "bench dips") return ["Bench"];
  if (["Bodyweight", "Body Only", "None"].includes(label)) return [];
  if (label === "Walking Shoes") return null;
  if (label === "Machine") {
    const m = machineRequirement(name);
    return m ? [m] : null;
  }
  if (label === "Cable") {
    if (name.includes("pulldown") && !name.includes("straight-arm") && !name.includes("rope")) return ["Lat Pulldown Machine"];
    if (name.includes("seated cable row") || name.includes("low pulley row")) return ["Seated Row Machine"];
    return ["Cable Station"];
  }
  if (label === "Other") return otherRequirement(name);
  const asset = SIMPLE_REQUIREMENTS[label];
  if (!asset) return null;
  const required = new Set([asset]);
  if (label === "Dumbbell" && (name.includes("bench") || ((name.includes("incline") || name.includes("decline")) && (name.includes("press") || name.includes("fly"))))) required.add("Bench");
  if (label === "Barbell" && name.includes("squat")) required.add("Squat Rack");
  if (label === "Barbell" && name.includes("bench press")) required.add("Bench");
  return [...required];
}
