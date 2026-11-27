import { describe, expect, it } from "vitest";
import { buildGeneratedPlan, type LibraryItem, type TemplateRow } from "../src/plans";
import { PlanRequest } from "../src/schemas";

// A small library where only one finisher is bodyweight-friendly. Home + Bodyweight must still
// produce two finishers by broadening finisher-only equipment, while main lifts stay strict.
const library: LibraryItem[] = [
  { name: "Cat Cow", primary_muscle: "Lower Back", category: "stretching", equipment: "bodyweight", difficulty: "beginner", substitute: "Child's Pose" },
  { name: "Arm Circles", primary_muscle: "Shoulders", category: "stretching", equipment: "bodyweight", difficulty: "beginner", substitute: "Band Pull-Apart" },
  { name: "Hip Circles", primary_muscle: "Hips", category: "stretching", equipment: "bodyweight", difficulty: "beginner", substitute: "Hip Opener" },
  { name: "Push-Up", primary_muscle: "Chest", category: "strength", equipment: "bodyweight", difficulty: "beginner", substitute: "Incline Push-Up" },
  { name: "Bodyweight Squat", primary_muscle: "Quadriceps", category: "strength", equipment: "bodyweight", difficulty: "beginner", substitute: "Glute Bridge" },
  // Only one bodyweight finisher exists, so the fallback must broaden finishers to find the rest.
  { name: "Jumping Jacks", primary_muscle: "Full Body", category: "cardio", equipment: "bodyweight", difficulty: "beginner", substitute: "Step Jacks" },
  { name: "Barbell Complex", primary_muscle: "Full Body", category: "cardio", equipment: "barbell", difficulty: "beginner", substitute: "See related exercise" },
  { name: "Sled Push", primary_muscle: "Full Body", category: "strongman", equipment: "sled", difficulty: "beginner", substitute: "Bodyweight Sprint" },
  { name: "Kettlebell Swing", primary_muscle: "Full Body", category: "cardio", equipment: "kettlebell", difficulty: "beginner", substitute: "Hip Hinge" },
];

const template: TemplateRow = {
  id: 1,
  version: 1,
  structure_json: JSON.stringify({ warmup: 1, main: 1, finisher: 2, main_sets: 3 }),
  pools_json: JSON.stringify({
    "Full body": {
      "Warm-up": ["Cat Cow", "Arm Circles", "Hip Circles"],
      Main: ["Push-Up", "Bodyweight Squat"],
      Finisher: [],
    },
  }),
};

const payload = PlanRequest.parse({
  goal: "Build muscle",
  experience: "Beginner",
  days_per_week: 2,
  location: "Home",
  equipment: "Bodyweight",
  split: "Full body",
  session_length: 45,
});

describe("finisher fallback", () => {
  it("fills every finisher slot even when bodyweight options are scarce", () => {
    const plan = buildGeneratedPlan(payload, library, template, null, null);
    for (const day of plan.days) {
      const finishers = day.exercises.filter(exercise => exercise.phase === "Finisher");
      expect(finishers).toHaveLength(2);
      expect(new Set(finishers.map(exercise => exercise.name)).size).toBe(2);
    }
  });

  it("keeps main lifts within the member's equipment", () => {
    const plan = buildGeneratedPlan(payload, library, template, null, null);
    const byName = new Map(library.map(item => [item.name, item]));
    for (const day of plan.days) {
      const mains = day.exercises.filter(exercise => exercise.phase === "Main");
      expect(mains).toHaveLength(1);
      expect(byName.get(mains[0].name)?.equipment).toBe("bodyweight");
    }
  });

  it("is repeatable for the same inputs", () => {
    const first = buildGeneratedPlan(payload, library, template, null, null);
    const second = buildGeneratedPlan(payload, library, template, null, null);
    expect(second).toEqual(first);
  });
});
