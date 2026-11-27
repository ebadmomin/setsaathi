"""Versioned seed data for reviewed workout slots; persisted to plan_templates."""

STRUCTURES = {
    "Beginner": {"warmup": 2, "main": 5, "finisher": 2, "main_sets": 3},
    "Intermediate": {"warmup": 3, "main": 6, "finisher": 3, "main_sets": 4},
    "Expert": {"warmup": 3, "main": 8, "finisher": 4, "main_sets": 4},
}

FOCUSES = {
    "Full body": ["Full body"],
    "Upper/lower": ["Upper", "Lower"],
    "Push pull legs": ["Push", "Pull", "Legs"],
    "Muscle split": ["Chest", "Back", "Legs", "Shoulders", "Arms"],
}

POOLS = {
    "Full body": {
        "Warm-up": ["Jumping Jack", "Inchworm", "World's Greatest Stretch"],
        "Main": ["Goblet Squat", "Push-up", "Lat Pulldown", "Dumbbell Romanian Deadlift", "Dumbbell Shoulder Press", "Dumbbell Row", "Reverse Lunge", "Plank"],
        "Finisher": ["Bodyweight Burpee", "High Knees", "Rowing, Stationary", "Jumping Jack"],
    },
    "Upper": {
        "Warm-up": ["Arm Circles", "Band Pull Apart", "Shoulder Circles"],
        "Main": ["Push-up", "Lat Pulldown", "Dumbbell Shoulder Press", "Dumbbell Row", "Dumbbell Bicep Curl", "Dumbbell Tricep Extension -Pronated Grip", "Incline Dumbbell Press", "Face Pull"],
        "Finisher": ["Battle Rope Alternating Waves", "Shadow Boxing", "Mountain Climbers", "Rowing, Stationary"],
    },
    "Lower": {
        "Warm-up": ["Bodyweight Squat", "Front Leg Raises", "Glute Bridge"],
        "Main": ["Barbell Back Squat", "Dumbbell Romanian Deadlift", "Reverse Lunge", "Standing Calf Raise", "Glute Bridge", "Leg Press", "Lying Leg Curls", "Split Squats"],
        "Finisher": ["High Knees", "Skater Hop", "Rope Jumping", "Stairmaster"],
    },
    "Push": {
        "Warm-up": ["Arm Circles", "Dynamic Chest Stretch", "Shoulder Circles"],
        "Main": ["Push-up", "Dumbbell Shoulder Press", "Incline Dumbbell Press", "Side Lateral Raise", "Bench Dips", "Dumbbell Tricep Extension -Pronated Grip", "Cable Crossover", "Cable Rope Overhead Triceps Extension"],
        "Finisher": ["Battle Rope Alternating Waves", "Shadow Boxing", "Mountain Climbers", "Jumping Jack"],
    },
    "Pull": {
        "Warm-up": ["Band Pull Apart", "Cat Stretch", "Scapular Pull-Up"],
        "Main": ["Lat Pulldown", "Dumbbell Romanian Deadlift", "Dumbbell Row", "Dumbbell Bicep Curl", "Face Pull", "Band Assisted Pull-Up", "Hammer Curls", "Seated Cable Rows"],
        "Finisher": ["Rowing, Stationary", "Farmer's Walk", "Battle Rope Alternating Waves", "Mountain Climbers"],
    },
    "Legs": {
        "Warm-up": ["Bodyweight Squat", "Front Leg Raises", "Glute Bridge"],
        "Main": ["Barbell Back Squat", "Dumbbell Romanian Deadlift", "Reverse Lunge", "Standing Calf Raise", "Glute Bridge", "Leg Press", "Lying Leg Curls", "Split Squats"],
        "Finisher": ["High Knees", "Skater Hop", "Rope Jumping", "Stairmaster"],
    },
    "Chest": {
        "Warm-up": ["Dynamic Chest Stretch", "Arm Circles", "Jumping Jack"],
        "Main": ["Push-up", "Incline Dumbbell Press", "Cable Crossover", "Dumbbell Bench Press", "Chest Press", "Dips - Chest Version"],
        "Finisher": ["Battle Rope Alternating Waves", "Mountain Climbers", "Shadow Boxing"],
    },
    "Back": {
        "Warm-up": ["Band Pull Apart", "Scapular Pull-Up", "Cat Stretch"],
        "Main": ["Lat Pulldown", "Dumbbell Row", "Seated Cable Rows", "Band Assisted Pull-Up", "Face Pull", "Bent Over Two-Dumbbell Row"],
        "Finisher": ["Rowing, Stationary", "Farmer's Walk", "High Knees"],
    },
    "Shoulders": {
        "Warm-up": ["Shoulder Circles", "Arm Circles", "Band Pull Apart"],
        "Main": ["Dumbbell Shoulder Press", "Side Lateral Raise", "Front Dumbbell Raise", "Arnold Dumbbell Press", "Face Pull", "Reverse Flyes"],
        "Finisher": ["Battle Rope Alternating Waves", "Shadow Boxing", "Jumping Jack"],
    },
    "Arms": {
        "Warm-up": ["Arm Circles", "Band Pull Apart", "Jumping Jack"],
        "Main": ["Dumbbell Bicep Curl", "Hammer Curls", "Bench Dips", "Dumbbell Tricep Extension -Pronated Grip", "Cable Rope Overhead Triceps Extension", "Close-Grip Barbell Bench Press"],
        "Finisher": ["Mountain Climbers", "Rope Jumping", "Battle Rope Alternating Waves"],
    },
}
