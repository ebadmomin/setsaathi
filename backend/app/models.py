from datetime import date, datetime
from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    username: Mapped[str | None] = mapped_column(String(80), unique=True, index=True, nullable=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    mobile: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="member", index=True)
    status: Mapped[str] = mapped_column(String(20), default="active")
    is_blocked: Mapped[bool] = mapped_column(default=False)
    blocked_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    blocked_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    blocked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    gym_name: Mapped[str] = mapped_column(String(120), default="Independent member")
    gym_location: Mapped[str | None] = mapped_column(String(300), nullable=True)
    gym_place_ref: Mapped[str | None] = mapped_column(String(80), nullable=True)
    gym_place_name: Mapped[str | None] = mapped_column(String(180), nullable=True)
    membership_plan: Mapped[str] = mapped_column(String(60), default="SetSaathi Starter")
    membership_started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    membership_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    height_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    bmi: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Membership(Base):
    __tablename__ = "memberships"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    billing_tier: Mapped[str] = mapped_column(String(10), default="free")
    status: Mapped[str] = mapped_column(String(20), default="active")
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_balance: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(primary_key=True)
    membership_id: Mapped[int] = mapped_column(ForeignKey("memberships.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    amount: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="pending_review")
    proof_r2_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    receipt_no: Mapped[str | None] = mapped_column(String(80), unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Reminder(Base):
    __tablename__ = "reminders"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    membership_id: Mapped[int | None] = mapped_column(ForeignKey("memberships.id", ondelete="SET NULL"), nullable=True)
    channel: Mapped[str] = mapped_column(String(20))
    trigger_type: Mapped[str] = mapped_column(String(20))
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class AdminGym(Base):
    __tablename__ = "admin_gyms"
    admin_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    address: Mapped[str] = mapped_column(String(300))
    phone: Mapped[str] = mapped_column(String(30), default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AdminMember(Base):
    __tablename__ = "admin_members"
    id: Mapped[int] = mapped_column(primary_key=True)
    admin_user_id: Mapped[int] = mapped_column(ForeignKey("admin_gyms.admin_user_id", ondelete="CASCADE"), index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    mobile: Mapped[str] = mapped_column(String(30), default="")
    email: Mapped[str] = mapped_column(String(320), default="")
    plan_name: Mapped[str] = mapped_column(String(60))
    started_at: Mapped[date] = mapped_column(Date)
    expires_at: Mapped[date] = mapped_column(Date)
    notes: Mapped[str] = mapped_column(String(500), default="")
    archived: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Exercise(Base):
    __tablename__ = "exercises"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    primary_muscle: Mapped[str] = mapped_column(String(60), index=True)
    secondary_muscles: Mapped[str] = mapped_column(String(240), default="")
    category: Mapped[str] = mapped_column(String(80), default="Strength", index=True)
    equipment: Mapped[str] = mapped_column(String(60), index=True)
    difficulty: Mapped[str] = mapped_column(String(30), index=True)
    instructions: Mapped[str] = mapped_column(String(1000))
    posture: Mapped[str] = mapped_column(String(700), default="Maintain a controlled, comfortable range of motion.")
    breathing: Mapped[str] = mapped_column(String(400), default="Exhale during effort; inhale during the controlled return.")
    common_mistake: Mapped[str] = mapped_column(String(500))
    safety_tips: Mapped[str] = mapped_column(String(700), default="Stop if pain is sharp or worsening.")
    substitute: Mapped[str] = mapped_column(String(120))
    media_status: Mapped[str] = mapped_column(String(40), default="licensed-media-pending")
    media_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    source_name: Mapped[str] = mapped_column(String(80), default="SetSaathi")
    source_id: Mapped[str | None] = mapped_column(String(180), nullable=True, index=True)
    source_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    license_name: Mapped[str] = mapped_column(String(80), default="SetSaathi original")
    license_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    movement_force: Mapped[str | None] = mapped_column(String(30), nullable=True)
    movement_mechanic: Mapped[str | None] = mapped_column(String(30), nullable=True)


class WorkoutEvent(Base):
    __tablename__ = "workout_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(index=True)
    workout_day: Mapped[str] = mapped_column(String(20))
    exercise_name: Mapped[str] = mapped_column(String(120))
    event_type: Mapped[str] = mapped_column(String(20))
    replacement_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class WorkoutProgress(Base):
    __tablename__ = "workout_progress"
    __table_args__ = (UniqueConstraint("user_id", "workout_date", "exercise_name", name="uq_workout_progress_user_date_exercise"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(index=True)
    workout_date: Mapped[date] = mapped_column(Date, index=True)
    workout_day: Mapped[str] = mapped_column(String(20))
    exercise_name: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    replacement_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    notes: Mapped[str] = mapped_column(String(500), default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WorkoutSet(Base):
    __tablename__ = "workout_sets"
    __table_args__ = (UniqueConstraint("user_id", "workout_date", "exercise_name", "set_number", name="uq_workout_set"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(index=True)
    workout_date: Mapped[date] = mapped_column(Date, index=True)
    exercise_name: Mapped[str] = mapped_column(String(120))
    set_number: Mapped[int] = mapped_column()
    reps: Mapped[int] = mapped_column()
    weight_kg: Mapped[float | None] = mapped_column(nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WorkoutPlan(Base):
    __tablename__ = "workout_plans"
    __table_args__ = (UniqueConstraint("user_id", name="uq_workout_plan_user"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(index=True)
    configuration_json: Mapped[str] = mapped_column(Text)
    plan_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DailyWorkoutPlan(Base):
    __tablename__ = "daily_workout_plans"
    __table_args__ = (UniqueConstraint("user_id", "workout_date", name="uq_daily_workout_plan_user_date"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(index=True)
    workout_date: Mapped[date] = mapped_column(Date, index=True)
    source: Mapped[str] = mapped_column(String(30), default="generated")
    configuration_json: Mapped[str] = mapped_column(Text)
    day_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MembershipEvent(Base):
    __tablename__ = "membership_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(index=True)
    event_type: Mapped[str] = mapped_column(String(20))
    gym_name: Mapped[str] = mapped_column(String(120))
    membership_plan: Mapped[str] = mapped_column(String(60))
    started_at: Mapped[datetime] = mapped_column(DateTime)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class GymAttendance(Base):
    __tablename__ = "gym_attendance"
    __table_args__ = (UniqueConstraint("user_id", "workout_date", name="uq_gym_attendance_user_date"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(index=True)
    workout_date: Mapped[date] = mapped_column(Date, index=True)
    status: Mapped[str] = mapped_column(String(20))
    source: Mapped[str] = mapped_column(String(20), default="manual")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class BodyMeasurement(Base):
    __tablename__ = "body_measurements"
    __table_args__ = (UniqueConstraint("user_id", "recorded_at", name="uq_body_measurement_user_date"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(index=True)
    recorded_at: Mapped[date] = mapped_column(Date, index=True)
    height_cm: Mapped[float] = mapped_column(Float)
    weight_kg: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserEquipment(Base):
    __tablename__ = "user_equipment"
    __table_args__ = (UniqueConstraint("user_id", "equipment", name="uq_user_equipment"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(index=True)
    equipment: Mapped[str] = mapped_column(String(60))


class GymEquipmentReport(Base):
    __tablename__ = "gym_equipment_reports"
    __table_args__ = (UniqueConstraint("gym_key", "user_id", "equipment", name="uq_gym_equipment_report"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    gym_key: Mapped[str] = mapped_column(String(300), index=True)
    user_id: Mapped[int] = mapped_column(index=True)
    equipment: Mapped[str] = mapped_column(String(60))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PlanTemplate(Base):
    __tablename__ = "plan_templates"
    __table_args__ = (UniqueConstraint("experience", "split", "version", name="uq_plan_template_variant"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    experience: Mapped[str] = mapped_column(String(30), index=True)
    split: Mapped[str] = mapped_column(String(40), index=True)
    version: Mapped[int] = mapped_column(default=1)
    structure_json: Mapped[str] = mapped_column(Text)
    pools_json: Mapped[str] = mapped_column(Text)
    published: Mapped[bool] = mapped_column(default=True)


class PlanVariant(Base):
    __tablename__ = "plan_variants"
    __table_args__ = (UniqueConstraint("template_id", "number", name="uq_plan_variant_number"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    template_id: Mapped[int] = mapped_column(index=True)
    number: Mapped[int] = mapped_column()
    pools_json: Mapped[str] = mapped_column(Text)
    published: Mapped[bool] = mapped_column(default=True)


class PlanAssignment(Base):
    __tablename__ = "plan_assignments"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(index=True)
    template_id: Mapped[int] = mapped_column(index=True)
    variant_id: Mapped[int] = mapped_column(index=True)
    exercise_signature: Mapped[str] = mapped_column(String(64), index=True)
    configuration_json: Mapped[str] = mapped_column(Text)
    plan_json: Mapped[str] = mapped_column(Text)
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class CoachCache(Base):
    __tablename__ = "coach_cache"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(index=True)
    cache_key: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    question: Mapped[str] = mapped_column(String(800))
    answer: Mapped[str] = mapped_column(Text)
    sources_json: Mapped[str] = mapped_column(Text, default="[]")
    provider: Mapped[str] = mapped_column(String(40))
    hit_count: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
