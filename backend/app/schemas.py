import re
from datetime import date, datetime
from pydantic import BaseModel, EmailStr, Field, computed_field, field_validator

MOBILE_PATTERN = re.compile(r"^\+[1-9]\d{7,14}$")


def normalize_mobile(value: str) -> str:
    compact = re.sub(r"[\s()-]", "", value)
    return "+" + compact[2:] if compact.startswith("00") else compact


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    username: str = Field(min_length=3, max_length=80, pattern=r"^[a-zA-Z0-9_.-]+$")
    email: EmailStr
    mobile: str
    password: str = Field(min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        return " ".join(value.split())

    @field_validator("username")
    @classmethod
    def clean_username(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("email")
    @classmethod
    def clean_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, value: str) -> str:
        normalized = normalize_mobile(value)
        if not MOBILE_PATTERN.fullmatch(normalized):
            raise ValueError("Enter a valid mobile with country code, e.g. +919876543210")
        return normalized


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=128)
    expected_role: str = Field(pattern="^(member|staff|admin|staff_admin)$")

    @field_validator("identifier")
    @classmethod
    def clean_identifier(cls, value: str) -> str:
        candidate = value.strip()
        return normalize_mobile(candidate) if candidate.startswith(("+", "00")) else candidate.lower()


class AdminUserStatusRequest(BaseModel):
    status: str = Field(pattern="^(active|blocked)$")
    reason: str | None = Field(default=None, max_length=500)


class UserResponse(BaseModel):
    id: int
    name: str
    username: str | None
    email: EmailStr
    mobile: str
    role: str
    gym_name: str
    membership_plan: str
    membership_started_at: datetime | None
    membership_expires_at: datetime | None
    height_cm: float | None
    weight_kg: float | None
    bmi: float | None
    created_at: datetime
    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class AdminGymRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    address: str = Field(min_length=5, max_length=300)
    phone: str = Field(default="", max_length=30)


class AdminMemberRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    mobile: str = Field(default="", max_length=30)
    email: str = Field(default="", max_length=320)
    plan_name: str = Field(min_length=2, max_length=60)
    started_at: date
    expires_at: date
    notes: str = Field(default="", max_length=500)
    archived: bool = False


class MembershipSubscriptionRequest(BaseModel):
    event_type: str = Field(pattern="^(new|renewed|updated)$")
    gym_name: str = Field(min_length=2, max_length=120)
    membership_plan: str = Field(min_length=2, max_length=60)
    started_at: date
    expires_at: date

    @field_validator("gym_name", "membership_plan")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return " ".join(value.split())


class MembershipSubscriptionResponse(UserResponse):
    event_type: str


class ProfileUpdateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    username: str = Field(min_length=3, max_length=80, pattern=r"^[a-zA-Z0-9_.-]+$")
    mobile: str
    email: EmailStr

    @field_validator("name")
    @classmethod
    def clean_profile_name(cls, value: str) -> str:
        return " ".join(value.split())

    @field_validator("username")
    @classmethod
    def clean_profile_username(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("mobile")
    @classmethod
    def validate_profile_mobile(cls, value: str) -> str:
        normalized = normalize_mobile(value)
        if not MOBILE_PATTERN.fullmatch(normalized):
            raise ValueError("Enter a valid mobile with country code, e.g. +919876543210")
        return normalized


class ExerciseResponse(BaseModel):
    id: int
    name: str
    primary_muscle: str
    secondary_muscles: str
    category: str
    equipment: str
    difficulty: str
    instructions: str
    posture: str
    breathing: str
    common_mistake: str
    safety_tips: str
    substitute: str
    media_status: str
    media_url: str | None
    source_name: str
    source_id: str | None
    source_url: str | None
    license_name: str
    license_url: str | None
    movement_force: str | None
    movement_mechanic: str | None

    @computed_field
    @property
    def gym_equipment(self) -> list[str] | None:
        from .equipment_catalog import requirements_for
        required = requirements_for(self)
        return sorted(required) if required is not None else None

    class Config:
        from_attributes = True


class PlanRequest(BaseModel):
    goal: str = Field(pattern="^(Build muscle|Get stronger|Lose fat|Stay active)$")
    experience: str = Field(pattern="^(Beginner|Intermediate|Expert)$")
    days_per_week: int = Field(ge=2, le=6)
    location: str = Field(pattern="^(Gym|Home)$")
    equipment: str = Field(pattern="^(Full gym|Dumbbells|Bodyweight)$")
    split: str = Field(pattern="^(Full body|Upper/lower|Push pull legs|Muscle split)$")
    session_length: int = Field(ge=30, le=90)
    spine_safety: str = Field(default="Standard", pattern="^(Standard|Extra caution|Avoid spinal loading)$")


class PlanTypeRequest(BaseModel):
    split: str = Field(pattern="^(Full body|Upper/lower|Push pull legs|Muscle split)$")


class EquipmentSelection(BaseModel):
    equipment: list[str] = Field(max_length=30)


class GymEquipmentUpdate(EquipmentSelection):
    equipment: list[str] = Field(max_length=60)
    location: str = Field(min_length=2, max_length=300)
    place_token: str | None = None

    @field_validator("location")
    @classmethod
    def clean_location(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if len(cleaned) < 2:
            raise ValueError("Enter a branch or locality.")
        return cleaned


class GymEquipmentResponse(BaseModel):
    gym_name: str
    location: str | None
    equipment: list[str]
    listed_name: str | None = None
    place_ref: str | None = None


class PlanExercise(BaseModel):
    name: str
    phase: str = Field(pattern="^(Warm-up|Main|Finisher)$")
    sets: int
    reps: str
    rest_seconds: int
    substitute: str
    risk_note: str | None = None


class PlanDay(BaseModel):
    day: str
    focus: str
    exercises: list[PlanExercise]


class GeneratedPlan(BaseModel):
    title: str
    rationale: str
    days: list[PlanDay]


class DailyGeneratedPlan(BaseModel):
    workout_date: date
    title: str
    rationale: str
    source: str
    day: PlanDay


class WorkoutEventRequest(BaseModel):
    workout_day: str = Field(min_length=3, max_length=20)
    exercise_name: str = Field(min_length=2, max_length=120)
    event_type: str = Field(pattern="^(skipped|changed)$")
    replacement_name: str | None = Field(default=None, max_length=120)


class WorkoutEventResponse(BaseModel):
    id: int
    event_type: str
    exercise_name: str
    replacement_name: str | None
    class Config:
        from_attributes = True


class WorkoutProgressRequest(BaseModel):
    workout_date: date
    workout_day: str = Field(min_length=3, max_length=20)
    exercise_name: str = Field(min_length=2, max_length=120)
    status: str = Field(pattern="^(pending|completed|skipped|replaced)$")
    replacement_name: str | None = Field(default=None, max_length=120)
    notes: str = Field(default="", max_length=500)


class WorkoutProgressResponse(BaseModel):
    id: int
    workout_date: date
    workout_day: str
    exercise_name: str
    status: str
    replacement_name: str | None
    notes: str
    updated_at: datetime
    class Config:
        from_attributes = True


class WorkoutSetEntry(BaseModel):
    set_number: int = Field(ge=1, le=20)
    reps: int = Field(ge=0, le=1000)
    weight_kg: float | None = Field(default=None, ge=0, le=2000)


class WorkoutSetsRequest(BaseModel):
    workout_date: date
    exercise_name: str = Field(min_length=2, max_length=120)
    sets: list[WorkoutSetEntry] = Field(max_length=20)


class WorkoutSetResponse(WorkoutSetEntry):
    id: int
    workout_date: date
    exercise_name: str
    updated_at: datetime
    class Config:
        from_attributes = True


class BodyMeasurementRequest(BaseModel):
    recorded_at: date = Field(default_factory=date.today)
    height_cm: float = Field(ge=100, le=250)
    weight_kg: float = Field(ge=25, le=350)


class BodyMeasurementResponse(BaseModel):
    id: int
    recorded_at: date
    height_cm: float
    weight_kg: float
    bmi: float


class GymAttendanceRequest(BaseModel):
    workout_date: date
    status: str = Field(pattern="^(completed|skipped|rest)$")


class GymAttendanceResponse(BaseModel):
    id: int
    workout_date: date
    status: str
    source: str
    class Config:
        from_attributes = True


class CoachQuestionRequest(BaseModel):
    question: str = Field(min_length=3, max_length=800)
    context: str = Field(default="", max_length=5000)


class CoachSource(BaseModel):
    id: int
    name: str
    primary_muscle: str
    equipment: str


class CoachAnswerResponse(BaseModel):
    answer: str
    sources: list[CoachSource]
    provider: str
    cached: bool = False
