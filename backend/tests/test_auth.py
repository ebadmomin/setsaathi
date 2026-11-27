import os
import sqlite3
from pathlib import Path
from datetime import date, datetime, timedelta

os.environ["SECRET_KEY"] = "test-secret-only-should-be-at-least-thirty-two-characters"
os.environ["INITIAL_ADMIN_EMAIL"] = "admin@example.com"
os.environ["INITIAL_ADMIN_MOBILE"] = "+919999999999"
os.environ["INITIAL_ADMIN_PASSWORD"] = "AdminPass123!"
os.environ["DATABASE_URL"] = "sqlite:///backend/test_setsaathi.db"

from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.equipment_catalog import requirements_for
from app.main import app, build_generated_plan, plan_exercise_signature, selected_equipment, selected_template
from app.models import DailyWorkoutPlan, Exercise, PlanAssignment, PlanVariant, User
from app.schemas import DailyGeneratedPlan, GeneratedPlan, PlanDay, PlanExercise, PlanRequest


def setup_function():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def test_member_registration_login_and_admin_protection():
    with TestClient(app) as client:
        registration = client.post("/api/auth/register", json={
            "name": "Test Member",
            "username": "testmember",
            "email": "member@example.com",
            "mobile": "+919876543210",
            "password": "MemberPass123!",
        })
        assert registration.status_code == 201
        assert registration.json()["user"]["role"] == "member"
        assert "MemberPass123!" not in registration.text

        login = client.post("/api/auth/login", json={
            "identifier": "testmember",
            "password": "MemberPass123!",
            "expected_role": "member",
        })
        assert login.status_code == 200
        member_token = login.json()["access_token"]

        protected = client.get("/api/admin/health", headers={"Authorization": f"Bearer {member_token}"})
        assert protected.status_code == 403


def test_platform_admin_can_block_and_unblock_member():
    with TestClient(app) as client:
        member = {"name": "Test Member", "username": "testmember", "email": "member@example.com", "mobile": "+919876543210", "password": "MemberPass123!"}
        registered = client.post("/api/auth/register", json=member)
        member_id = registered.json()["user"]["id"]
        member_headers = {"Authorization": f"Bearer {registered.json()['access_token']}"}
        admin_login = client.post("/api/auth/login", json={"identifier": "administrator", "password": "AdminPass123!", "expected_role": "admin"})
        admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}
        path = f"/api/admin/users/{member_id}/status"

        assert client.put(path, json={"status": "blocked"}, headers=member_headers).status_code == 403
        assert client.put(path, json={"status": "blocked"}, headers=admin_headers).json()["status"] == "blocked"
        assert client.get("/api/auth/session", headers=member_headers).status_code == 403
        blocked_login = client.post("/api/auth/login", json={"identifier": member["username"], "password": member["password"], "expected_role": "member"})
        assert blocked_login.status_code == 403
        assert "blocked from using SetSaathi" in blocked_login.json()["detail"]
        assert client.post("/api/auth/login", json={"identifier": member["username"], "password": "wrong-password", "expected_role": "member"}).status_code == 401
        assert client.put(path, json={"status": "active"}, headers=admin_headers).json()["status"] == "active"
        assert client.get("/api/auth/session", headers=member_headers).status_code == 200


def test_duplicate_member_and_admin_role_rules():
    with TestClient(app) as client:
        payload = {"name": "Test Member", "username": "testmember", "email": "member@example.com", "mobile": "+919876543210", "password": "MemberPass123!"}
        assert client.post("/api/auth/register", json=payload).status_code == 201
        assert client.post("/api/auth/register", json=payload).status_code == 409

        member_as_admin = client.post("/api/auth/login", json={"identifier": "member@example.com", "password": "MemberPass123!", "expected_role": "admin"})
        assert member_as_admin.status_code == 403

        admin_login = client.post("/api/auth/login", json={"identifier": "administrator", "password": "AdminPass123!", "expected_role": "admin"})
        assert admin_login.status_code == 200
        admin_token = admin_login.json()["access_token"]
        assert client.get("/api/admin/health", headers={"Authorization": f"Bearer {admin_token}"}).status_code == 200


def test_admin_gym_workspace_and_private_roster():
    with TestClient(app) as client:
        registration = client.post("/api/auth/register", json={"name": "App Member", "username": "appmember", "email": "appmember@example.com", "mobile": "+919811111111", "password": "MemberPass123!"})
        assert registration.status_code == 201
        member_login = client.post("/api/auth/login", json={"identifier": "appmember", "password": "MemberPass123!", "expected_role": "member"})
        assert member_login.status_code == 200
        member_headers = {"Authorization": f"Bearer {member_login.json()['access_token']}"}
        assert client.get("/api/admin/users", headers=member_headers).status_code == 403
        login = client.post("/api/auth/login", json={"identifier": "administrator", "password": "AdminPass123!", "expected_role": "admin"})
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        accounts = client.get("/api/admin/users", headers=headers)
        assert accounts.status_code == 200
        assert len(accounts.json()["users"]) == 1
        assert accounts.json()["users"][0]["username"] == "appmember"
        assert accounts.json()["users"][0]["last_login_at"] is not None
        assert "password_hash" not in accounts.text
        with SessionLocal() as db:
            original = db.query(User).filter_by(role="admin").first()
            db.add(User(name="Gym Manager", username="manager2", email="manager2@example.com", mobile="+919822222222", password_hash=original.password_hash, role="admin", membership_plan="Administrator"))
            db.commit()
        manager_login = client.post("/api/auth/login", json={"identifier": "manager2", "password": "AdminPass123!", "expected_role": "admin"})
        assert manager_login.status_code == 200
        manager_headers = {"Authorization": f"Bearer {manager_login.json()['access_token']}"}
        assert client.get("/api/admin/users", headers=manager_headers).status_code == 200
        assert client.get("/api/admin/workspace", headers=headers).json() == {"gym": None, "members": []}
        gym = {"name": "Sample Gym", "address": "Main Street, Mumbai", "phone": ""}
        assert client.put("/api/admin/gym", json=gym, headers=headers).status_code == 200
        member = {"full_name": "Sample Member", "mobile": "+919876543210", "email": "", "plan_name": "Monthly", "started_at": "2026-11-24", "expires_at": "2026-12-24", "notes": "", "archived": False}
        added = client.post("/api/admin/members", json=member, headers=headers)
        assert added.status_code == 201
        member_id = added.json()["id"]
        roster = client.get("/api/admin/workspace", headers=headers).json()
        assert roster["gym"] == gym
        assert roster["members"][0]["full_name"] == "Sample Member"
        updated = client.put(f"/api/admin/members/{member_id}", json={**member, "plan_name": "Quarterly"}, headers=headers)
        assert updated.status_code == 200
        assert client.get("/api/admin/workspace", headers=headers).json()["members"][0]["plan_name"] == "Quarterly"
        assert client.post("/api/admin/members", json={**member, "expires_at": "2026-11-24"}, headers=headers).status_code == 422


def test_plan_type_stays_selected_until_explicitly_changed():
    with sqlite3.connect("backend/test_setsaathi.db") as seeded:
        seeded.executescript(Path("migrations/0002_seed_exercises.sql").read_text(encoding="utf-8"))
    with TestClient(app) as client:
        registered = client.post("/api/auth/register", json={"name": "Plan Member", "username": "planmember", "email": "planmember@example.com", "mobile": "+919833333333", "password": "MemberPass123!"})
        assert registered.status_code == 201
        headers = {"Authorization": f"Bearer {registered.json()['access_token']}"}
        first = client.put("/api/plans/type", json={"split": "Push pull legs"}, headers=headers)
        assert first.status_code == 200, first.text
        assert "Push pull legs" in first.json()["title"]
        assert client.get("/api/plans/settings", headers=headers).json()["split"] == "Push pull legs"
        today = client.post("/api/plans/today/from-current", headers=headers)
        assert today.status_code == 200
        assert today.json()["day"]["focus"] in {"Push", "Pull", "Legs"}
        other = {"goal": "Build muscle", "experience": "Beginner", "days_per_week": 3, "location": "Gym", "equipment": "Full gym", "split": "Full body", "session_length": 45}
        assert client.post("/api/plans/generate", json=other, headers=headers).status_code == 409
        assert client.post("/api/plans/today", json=other, headers=headers).status_code == 409
        changed = client.put("/api/plans/type", json={"split": "Muscle split"}, headers=headers)
        assert changed.status_code == 200, changed.text
        assert [day["focus"] for day in changed.json()["days"]] == ["Chest", "Back", "Legs", "Shoulders", "Arms"]
        assert client.get("/api/plans/settings", headers=headers).json()["days_per_week"] == 5
        assert client.post("/api/plans/regenerate", headers=headers).status_code == 200
        assert client.get("/api/plans/settings", headers=headers).json()["split"] == "Muscle split"


def test_guests_can_browse_and_filter_seeded_exercises():
    with TestClient(app) as client:
        response = client.get("/api/exercises", params={"equipment": "Bodyweight"})
        assert response.status_code == 200
        exercises = response.json()
        assert exercises
        assert all(item["equipment"] == "Bodyweight" for item in exercises)
        assert all(item["media_status"] == "licensed-media-pending" for item in exercises)
        pulldown = next(item for item in client.get("/api/exercises").json() if item["name"] == "Lat Pulldown")
        assert pulldown["gym_equipment"] == ["Lat Pulldown Machine"]


def test_authenticated_member_receives_repeatable_plan():
    with TestClient(app) as client:
        with SessionLocal() as db:
            for category, count in (("Stretching", 15), ("Strength", 35), ("Cardio", 15)):
                for index in range(count):
                    db.add(Exercise(name=f"Test {category} {index}", primary_muscle="Chest" if category == "Strength" else "Full Body", equipment="Bodyweight", difficulty="Beginner", category=category, instructions="Move with control.", common_mistake="Rushing.", substitute="Choose another movement"))
            db.commit()
        client.post("/api/auth/register", json={"name": "Planner", "username": "planner", "email": "planner@example.com", "mobile": "+919123456789", "password": "PlannerPass123!"})
        login = client.post("/api/auth/login", json={"identifier": "planner", "password": "PlannerPass123!", "expected_role": "member"})
        token = login.json()["access_token"]
        payload = {"goal": "Build muscle", "experience": "Beginner", "days_per_week": 3, "location": "Gym", "equipment": "Full gym", "split": "Full body", "session_length": 45}
        plan = client.post("/api/plans/generate", json=payload, headers={"Authorization": f"Bearer {token}"})
        assert plan.status_code == 200, plan.text
        assert len(plan.json()["days"]) == 3
        assert "Template v1" in plan.json()["rationale"]
        weekly_names = [item["name"] for day in plan.json()["days"] for item in day["exercises"]]
        assert len(weekly_names) == len(set(weekly_names))
        exercises = plan.json()["days"][0]["exercises"]
        assert len(exercises) == 9
        assert [item["phase"] for item in exercises].count("Warm-up") == 2
        assert [item["phase"] for item in exercises].count("Main") == 5
        assert [item["phase"] for item in exercises].count("Finisher") == 2
        assert all(item["sets"] == 3 for item in exercises if item["phase"] == "Main")
        next_plan = client.post("/api/plans/generate", json=payload, headers={"Authorization": f"Bearer {token}"})
        assert next_plan.status_code == 200, next_plan.text
        assert plan_exercise_signature(GeneratedPlan.model_validate(plan.json()).days) != plan_exercise_signature(GeneratedPlan.model_validate(next_plan.json()).days)
        with SessionLocal() as db:
            assert db.query(PlanAssignment).count() == 2
        long_plan = client.post("/api/plans/generate", json={**payload, "session_length": 90}, headers={"Authorization": f"Bearer {token}"})
        assert len(long_plan.json()["days"][0]["exercises"]) == 9
        expert_plan = client.post("/api/plans/generate", json={**payload, "experience": "Expert", "session_length": 90}, headers={"Authorization": f"Bearer {token}"})
        expert_exercises = expert_plan.json()["days"][0]["exercises"]
        expert_weekly_names = [item["name"] for day in expert_plan.json()["days"] for item in day["exercises"]]
        assert len(expert_weekly_names) == len(set(expert_weekly_names))
        assert len(expert_exercises) == 15
        assert [item["phase"] for item in expert_exercises].count("Warm-up") == 3
        assert [item["phase"] for item in expert_exercises].count("Main") == 8
        assert [item["phase"] for item in expert_exercises].count("Finisher") == 4
        current = client.get("/api/plans/current", headers={"Authorization": f"Bearer {token}"})
        assert current.status_code == 200
        assert current.json()["title"] == expert_plan.json()["title"]
        assert len(current.json()["days"][0]["exercises"]) == 15
        today_from_week = client.post("/api/plans/today/from-current", headers={"Authorization": f"Bearer {token}"})
        assert today_from_week.status_code == 200
        assert today_from_week.json()["source"] == "weekly-plan"
        assert len(today_from_week.json()["day"]["exercises"]) == 15
        custom_today = client.post("/api/plans/today", json=payload, headers={"Authorization": f"Bearer {token}"})
        assert custom_today.status_code == 200
        assert custom_today.json()["source"] == "custom-today"
        assert len(custom_today.json()["day"]["exercises"]) == 9
        saved_today = client.get(f"/api/plans/today?workout_date={custom_today.json()['workout_date']}", headers={"Authorization": f"Bearer {token}"})
        assert saved_today.status_code == 200
        assert len(saved_today.json()["day"]["exercises"]) == 9
        unchanged_week = client.get("/api/plans/current", headers={"Authorization": f"Bearer {token}"})
        assert len(unchanged_week.json()["days"][0]["exercises"]) == 15
        spine_safe = client.post("/api/plans/today", json={**payload, "spine_safety": "Avoid spinal loading"}, headers={"Authorization": f"Bearer {token}"})
        spine_names = [item["name"] for item in spine_safe.json()["day"]["exercises"]]
        assert "Goblet Squat" not in spine_names
        assert "Dumbbell Romanian Deadlift" not in spine_names
        equipment = client.put("/api/me/equipment", json={"equipment": ["Bodyweight"]}, headers={"Authorization": f"Bearer {token}"})
        assert equipment.status_code == 200
        assert client.get("/api/me/equipment", headers={"Authorization": f"Bearer {token}"}).json()["equipment"] == ["Bodyweight"]
        bodyweight_plan = client.post("/api/plans/generate", json=payload, headers={"Authorization": f"Bearer {token}"})
        assert bodyweight_plan.status_code == 200, bodyweight_plan.text
        with SessionLocal() as db:
            names = {item.name: item.equipment for item in db.query(Exercise).all()}
        assert all(names[item["name"]] in {"Bodyweight", "Body Only", "None"} for day in bodyweight_plan.json()["days"] for item in day["exercises"])
        assert client.post("/api/plans/generate", json={**payload, "split": "Push pull legs", "days_per_week": 2}, headers={"Authorization": f"Bearer {token}"}).status_code == 422
        event = client.post("/api/workout-events", json={"workout_day": "Wednesday", "exercise_name": "Goblet Squat", "event_type": "changed", "replacement_name": "Bodyweight Squat"}, headers={"Authorization": f"Bearer {token}"})
        assert event.status_code == 201
        assert event.json()["replacement_name"] == "Bodyweight Squat"


def test_plan_rotation_refuses_recent_roster_and_releases_it_after_two_weeks():
    with TestClient(app) as client:
        with SessionLocal() as db:
            for category, count in (("Stretching", 15), ("Strength", 25), ("Cardio", 15)):
                for index in range(count):
                    db.add(Exercise(name=f"Rotation {category} {index}", primary_muscle="Chest" if category == "Strength" else "Full Body", equipment="Bodyweight", difficulty="Beginner", category=category, instructions="Move with control.", common_mistake="Rushing.", substitute="Choose another movement"))
            db.commit()
        client.post("/api/auth/register", json={"name": "Rotation Member", "username": "rotation", "email": "rotation@example.com", "mobile": "+919444444444", "password": "MemberPass123!"})
        token = client.post("/api/auth/login", json={"identifier": "rotation", "password": "MemberPass123!", "expected_role": "member"}).json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        payload = PlanRequest(goal="Build muscle", experience="Beginner", days_per_week=2, location="Gym", equipment="Full gym", split="Full body", session_length=45)
        with SessionLocal() as db:
            user = db.query(User).filter(User.username == "rotation").one()
            template = selected_template(db, payload)
            library = db.query(Exercise).all()
            variants = db.query(PlanVariant).filter(PlanVariant.template_id == template.id).all()
            assert len(variants) == 24
            for variant in variants:
                plan = build_generated_plan(payload, library, template, None, variant)
                db.add(PlanAssignment(user_id=user.id, template_id=template.id, variant_id=variant.id,
                    exercise_signature=plan_exercise_signature(plan.days), configuration_json=payload.model_dump_json(), plan_json=plan.model_dump_json()))
            db.commit()
        blocked = client.post("/api/plans/generate", json=payload.model_dump(), headers=headers)
        assert blocked.status_code == 409
        with SessionLocal() as db:
            for assignment in db.query(PlanAssignment).all():
                assignment.assigned_at = datetime.utcnow() - timedelta(days=15)
            db.commit()
        released = client.post("/api/plans/generate", json=payload.model_dump(), headers=headers)
        assert released.status_code == 200, released.text


def test_member_can_save_new_or_renewed_gym_membership():
    with TestClient(app) as client:
        client.post("/api/auth/register", json={"name": "Member", "username": "membership", "email": "membership@example.com", "mobile": "+919123456788", "password": "MembershipPass123!"})
        login = client.post("/api/auth/login", json={"identifier": "membership", "password": "MembershipPass123!", "expected_role": "member"})
        token = login.json()["access_token"]
        response = client.post("/api/membership/subscriptions", json={"event_type": "new", "gym_name": "Anytime Fitness", "membership_plan": "Annual", "started_at": "2026-11-19", "expires_at": "2027-11-19"}, headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 201
        assert response.json()["gym_name"] == "Anytime Fitness"
        assert response.json()["event_type"] == "new"
        edited = client.post("/api/membership/subscriptions", json={"event_type": "updated", "gym_name": "Updated Gym", "membership_plan": "Annual Plus", "started_at": "2026-11-19", "expires_at": "2027-11-19"}, headers={"Authorization": f"Bearer {token}"})
        assert edited.status_code == 201
        assert edited.json()["gym_name"] == "Updated Gym"
        assert edited.json()["event_type"] == "updated"
        invalid = client.post("/api/membership/subscriptions", json={"event_type": "renewed", "gym_name": "Anytime Fitness", "membership_plan": "Annual", "started_at": "2027-11-19", "expires_at": "2027-11-19"}, headers={"Authorization": f"Bearer {token}"})
        assert invalid.status_code == 422


def test_gym_equipment_reports_are_shared_by_branch_and_used_for_planning():
    with TestClient(app) as client:
        def member(username, mobile, location):
            client.post("/api/auth/register", json={"name": username, "username": username, "email": f"{username}@example.com", "mobile": mobile, "password": "MemberPass123!"})
            token = client.post("/api/auth/login", json={"identifier": username, "password": "MemberPass123!", "expected_role": "member"}).json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            response = client.post("/api/membership/subscriptions", json={"event_type": "new", "gym_name": "Shared Gym", "membership_plan": "Monthly", "started_at": "2026-11-19", "expires_at": "2026-12-19"}, headers=headers)
            assert response.status_code == 201
            return headers

        first = member("gymfirst", "+919111111111", "Bandra West")
        second = member("gymsecond", "+919222222222", "Bandra West")
        other_branch = member("gymthird", "+919333333333", "Andheri East")
        assert client.put("/api/gyms/equipment", json={"location": "Bandra West", "equipment": ["Dumbbells"]}, headers=first).status_code == 200
        assert client.get("/api/gyms/equipment?location=Bandra%20West", headers=second).json()["equipment"] == ["Dumbbells"]
        assert client.put("/api/gyms/equipment", json={"location": "Bandra West", "equipment": ["Bench", "Dumbbells"]}, headers=second).status_code == 200
        shared = client.get("/api/gyms/equipment", headers=first).json()
        assert shared["equipment"] == ["Bench", "Dumbbells"]
        with SessionLocal() as db:
            from app.models import User
            first_user = db.query(User).filter(User.username == "gymfirst").one()
            assert selected_equipment(db, first_user) == {"bench", "dumbbells"}
        assert client.put("/api/gyms/equipment", json={"location": "Andheri East", "equipment": ["Cable Station"]}, headers=other_branch).status_code == 200
        assert client.get("/api/gyms/equipment", headers=other_branch).json()["equipment"] == ["Cable Station"]
        assert client.put("/api/gyms/equipment", json={"location": "Bandra West", "equipment": ["Barbell", "Bench"]}, headers=first).status_code == 200
        assert client.get("/api/gyms/equipment", headers=second).json()["equipment"] == ["Barbell", "Bench"]
        assert client.put("/api/gyms/equipment", json={"location": "Bandra West", "equipment": []}, headers=second).status_code == 200
        assert client.get("/api/gyms/equipment", headers=first).json()["equipment"] == []
        assert client.get("/api/gyms/equipment", headers=other_branch).json()["equipment"] == ["Cable Station"]
        assert client.put("/api/gyms/equipment", json={"location": "Bandra West", "equipment": ["Imaginary Machine"]}, headers=first).status_code == 422
        catalog = client.get("/api/gyms/equipment/catalog", headers=first)
        assert catalog.status_code == 200
        items = [name for group in catalog.json().values() for name in group]
        assert "Hip Abductor Machine" in items
        assert "Chest Press Machine" in items
        assert "Walking Shoes" not in items
        assert "Bodyweight" not in items
        assert "Machine" not in items
        assert requirements_for(Exercise(name="Thigh Abductor", equipment="Machine")) == {"Hip Abductor Machine"}
        assert requirements_for(Exercise(name="Leverage Chest Press", equipment="Machine")) == {"Chest Press Machine"}
        assert requirements_for(Exercise(name="Jogging, Treadmill", equipment="Machine")) == {"Treadmill"}
        assert client.put("/api/gyms/equipment", json={"location": "Bandra West", "equipment": ["Walking Shoes"]}, headers=first).status_code == 422
        assert client.get("/api/gyms/equipment").status_code == 401


def test_gym_listing_selection_links_same_branch_and_keeps_manual_fallback(monkeypatch):
    from app import main

    monkeypatch.setattr(main, "search_gym", lambda name, area: [{"ref": "way:12345", "name": "Shared Gym", "address": "Shared Gym, Main Road, Mumbai"}])
    with TestClient(app) as client:
        headers = []
        for index in (1, 2):
            username = f"gymlookup{index}"
            client.post("/api/auth/register", json={"name": username, "username": username, "email": f"{username}@example.com", "mobile": f"+91941111111{index}", "password": "MemberPass123!"})
            token = client.post("/api/auth/login", json={"identifier": username, "password": "MemberPass123!", "expected_role": "member"}).json()["access_token"]
            auth = {"Authorization": f"Bearer {token}"}
            assert client.post("/api/membership/subscriptions", json={"event_type": "new", "gym_name": "Shared Gym", "membership_plan": "Monthly", "started_at": "2026-11-19", "expires_at": "2026-12-19"}, headers=auth).status_code == 201
            headers.append(auth)
        found = client.get("/api/gyms/search?area=Mumbai", headers=headers[0])
        assert found.status_code == 200
        listing = found.json()[0]
        assert listing["name"] == "Shared Gym"
        assert client.put("/api/gyms/equipment", json={"location": "Other Road", "equipment": [], "place_token": listing["token"]}, headers=headers[0]).status_code == 422
        saved = client.put("/api/gyms/equipment", json={"location": listing["address"], "equipment": ["Chest Press Machine"], "place_token": listing["token"]}, headers=headers[0])
        assert saved.status_code == 200
        assert saved.json()["place_ref"] == "way:12345"
        assert client.get("/api/gyms/equipment", headers=headers[0]).json()["equipment"] == ["Chest Press Machine"]
        preview = client.get("/api/gyms/equipment", params={"location": listing["address"], "place_token": listing["token"]}, headers=headers[1])
        assert preview.json()["equipment"] == ["Chest Press Machine"]
        assert client.put("/api/gyms/equipment", json={"location": listing["address"], "equipment": ["Chest Press Machine", "Treadmill"], "place_token": listing["token"]}, headers=headers[1]).status_code == 200
        assert client.get("/api/gyms/equipment", headers=headers[0]).json()["equipment"] == ["Chest Press Machine", "Treadmill"]
        manual = client.put("/api/gyms/equipment", json={"location": "Another Gym, Mumbai", "equipment": ["Dumbbells"]}, headers=headers[1])
        assert manual.json()["place_ref"] is None
        assert client.get("/api/gyms/equipment", headers=headers[0]).json()["equipment"] == ["Chest Press Machine", "Treadmill"]


def test_member_attendance_is_saved_and_sunday_defaults_to_rest():
    with TestClient(app) as client:
        client.post("/api/auth/register", json={"name": "Attendance Member", "username": "attendance", "email": "attendance@example.com", "mobile": "+919123456787", "password": "AttendancePass123!"})
        login = client.post("/api/auth/login", json={"identifier": "attendance", "password": "AttendancePass123!", "expected_role": "member"})
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        saved = client.put("/api/gym-attendance", json={"workout_date": "2026-11-19", "status": "completed"}, headers=headers)
        assert saved.status_code == 200
        assert saved.json()["status"] == "completed"
        records = client.get("/api/gym-attendance?start=2026-11-16&end=2026-11-22", headers=headers)
        assert records.status_code == 200
        by_date = {item["workout_date"]: item["status"] for item in records.json()}
        assert by_date["2026-11-19"] == "completed"
        assert by_date["2026-11-22"] == "rest"


def test_member_body_measurements_create_private_daily_history():
    with TestClient(app) as client:
        client.post("/api/auth/register", json={"name": "Body Member", "username": "bodymember", "email": "body@example.com", "mobile": "+919123456784", "password": "BodyPass123!"})
        login = client.post("/api/auth/login", json={"identifier": "bodymember", "password": "BodyPass123!", "expected_role": "member"})
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        first = client.put("/api/body-measurements", json={"recorded_at": "2026-11-16", "height_cm": 175, "weight_kg": 82.4}, headers=headers)
        latest = client.put("/api/body-measurements", json={"recorded_at": "2026-11-19", "height_cm": 175, "weight_kg": 81.6}, headers=headers)
        assert first.status_code == 200
        assert latest.status_code == 200
        assert latest.json()["bmi"] == 26.6
        account = client.post("/api/auth/login", json={"identifier": "bodymember", "password": "BodyPass123!", "expected_role": "member"})
        assert account.json()["user"]["height_cm"] == 175
        assert account.json()["user"]["weight_kg"] == 81.6
        assert account.json()["user"]["bmi"] == 26.6
        older = client.put("/api/body-measurements", json={"recorded_at": "2026-11-15", "height_cm": 175, "weight_kg": 83}, headers=headers)
        assert older.status_code == 200
        account = client.post("/api/auth/login", json={"identifier": "bodymember", "password": "BodyPass123!", "expected_role": "member"})
        assert account.json()["user"]["weight_kg"] == 81.6
        history = client.get("/api/body-measurements?start=2026-11-01&end=2026-11-30", headers=headers)
        assert [item["weight_kg"] for item in history.json()] == [83, 82.4, 81.6]
        assert client.get("/api/body-measurements").status_code == 401


def test_member_workout_progress_is_saved_updated_and_private():
    with TestClient(app) as client:
        client.post("/api/auth/register", json={"name": "Progress Member", "username": "progress", "email": "progress@example.com", "mobile": "+919123456785", "password": "ProgressPass123!"})
        login = client.post("/api/auth/login", json={"identifier": "progress", "password": "ProgressPass123!", "expected_role": "member"})
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        payload = {"workout_date": "2026-11-19", "workout_day": "Thursday", "exercise_name": "Goblet Squat", "status": "replaced", "replacement_name": "Bodyweight Squat"}
        saved = client.put("/api/workout-progress", json=payload, headers=headers)
        assert saved.status_code == 200
        assert saved.json()["replacement_name"] == "Bodyweight Squat"
        completed = client.put("/api/workout-progress", json={**payload, "status": "completed"}, headers=headers)
        assert completed.status_code == 200
        assert completed.json()["status"] == "completed"
        assert completed.json()["replacement_name"] == "Bodyweight Squat"
        records = client.get("/api/workout-progress?start=2026-11-19&end=2026-11-19", headers=headers)
        assert records.status_code == 200
        assert len(records.json()) == 1
        assert records.json()[0]["status"] == "completed"
        assert client.get("/api/workout-progress?start=2026-11-19&end=2026-11-19").status_code == 401


def test_member_workout_sets_are_saved_replaced_and_private():
    with TestClient(app) as client:
        client.post("/api/auth/register", json={"name": "Set Logger", "username": "setlogger", "email": "sets@example.com", "mobile": "+919123456789", "password": "SetLogger123!"})
        login = client.post("/api/auth/login", json={"identifier": "setlogger", "password": "SetLogger123!", "expected_role": "member"})
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        payload = {"workout_date": "2026-11-19", "exercise_name": "Goblet Squat", "sets": [{"set_number": 1, "reps": 10, "weight_kg": 12.5}, {"set_number": 2, "reps": 8, "weight_kg": None}]}
        saved = client.put("/api/workout-sets", json=payload, headers=headers)
        assert saved.status_code == 200
        assert [(row["reps"], row["weight_kg"]) for row in saved.json()] == [(10, 12.5), (8, None)]
        updated = client.put("/api/workout-sets", json={**payload, "sets": [{"set_number": 1, "reps": 12, "weight_kg": 15}]}, headers=headers)
        assert updated.status_code == 200
        assert len(updated.json()) == 1
        assert updated.json()[0]["weight_kg"] == 15
        assert client.put("/api/workout-sets", json={**payload, "sets": [{"set_number": 1, "reps": 8, "weight_kg": None}, {"set_number": 1, "reps": 9, "weight_kg": None}]}, headers=headers).status_code == 422
        assert len(client.get("/api/workout-sets?start=2026-11-19&end=2026-11-19", headers=headers).json()) == 1
        assert client.get("/api/workout-sets?start=2026-11-19&end=2026-11-19").status_code == 401


def test_registered_member_can_query_grounded_exercise_coach():
    with TestClient(app) as client:
        client.post("/api/auth/register", json={"name": "Coach Member", "username": "coachmember", "email": "coach@example.com", "mobile": "+919123456786", "password": "CoachPass123!"})
        login = client.post("/api/auth/login", json={"identifier": "coachmember", "password": "CoachPass123!", "expected_role": "member"})
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        response = client.post("/api/coach/query", json={"question": "Which beginner exercise trains the back?"}, headers=headers)
        assert response.status_code == 200
        assert response.json()["sources"]
        assert response.json()["provider"] == "local-rag"
        assert "Back" in response.text
        repeated = client.post("/api/coach/query", json={"question": "Which beginner exercise trains the back?"}, headers=headers)
        assert repeated.status_code == 200
        assert repeated.json()["cached"] is True
        assert repeated.json()["provider"] == "cache"
        assert client.post("/api/coach/query", json={"question": "back exercises"}).status_code == 401


def test_coach_switches_from_local_answers_to_openrouter_and_reuses_ai_answer(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "openrouter_api_key", "")
    with TestClient(app) as client:
        client.post("/api/auth/register", json={"name": "AI Member", "username": "aimember", "email": "aimember@example.com", "mobile": "+919123456787", "password": "CoachPass123!"})
        login = client.post("/api/auth/login", json={"identifier": "aimember", "password": "CoachPass123!", "expected_role": "member"})
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        question = {"question": "Which beginner exercise trains the back?"}
        local = client.post("/api/coach/query", json=question, headers=headers)
        assert local.json()["provider"] == "local-rag"

        calls = []

        class FakeResponse:
            def raise_for_status(self):
                return None

            def json(self):
                return {"choices": [{"message": {"content": "Try a controlled beginner back movement from the library."}}]}

        def fake_post(url, **kwargs):
            calls.append((url, kwargs))
            return FakeResponse()

        monkeypatch.setattr(settings, "openrouter_api_key", "sk-or-v1-test-only")
        monkeypatch.setattr("app.main.httpx.post", fake_post)
        ai = client.post("/api/coach/query", json=question, headers=headers)
        assert ai.json()["provider"] == "openrouter-rag"
        assert ai.json()["answer"].startswith("Try a controlled")
        assert len(calls) == 1
        assert calls[0][0] == "https://openrouter.ai/api/v1/chat/completions"
        assert calls[0][1]["json"]["model"] == settings.openrouter_model
        assert calls[0][1]["headers"]["Authorization"] == "Bearer sk-or-v1-test-only"
        assert "Saved workout state" in calls[0][1]["json"]["messages"][1]["content"]

        repeated = client.post("/api/coach/query", json=question, headers=headers)
        assert repeated.json()["cached"] is True
        assert len(calls) == 1


def test_coach_next_exercise_uses_saved_plan_and_progress(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "openrouter_api_key", "")
    with TestClient(app) as client:
        client.post("/api/auth/register", json={"name": "Next Member", "username": "nextmember", "email": "next@example.com", "mobile": "+919123456788", "password": "CoachPass123!"})
        login = client.post("/api/auth/login", json={"identifier": "nextmember", "password": "CoachPass123!", "expected_role": "member"})
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        workout_date = date.today()
        exercises = [PlanExercise(name=name, phase="Main", sets=3, reps="8–12", rest_seconds=60, substitute="") for name in ("Goblet Squat", "Push-up")]
        day = PlanDay(day=workout_date.strftime("%A"), focus="Full body", exercises=exercises)
        daily = DailyGeneratedPlan(workout_date=workout_date, title="Today's session", rationale="Test plan", source="generated", day=day)
        with SessionLocal() as db:
            db.add(DailyWorkoutPlan(user_id=login.json()["user"]["id"], workout_date=workout_date, source="generated", configuration_json="{}", day_json=daily.model_dump_json()))
            db.commit()

        question = {"question": "What is my next exercise?"}
        first = client.post("/api/coach/query", json=question, headers=headers)
        assert first.status_code == 200
        assert "Goblet Squat" in first.json()["answer"]

        completed = client.put("/api/workout-progress", json={"workout_date": workout_date.isoformat(), "workout_day": day.day, "exercise_name": "Goblet Squat", "status": "completed"}, headers=headers)
        assert completed.status_code == 200
        second = client.post("/api/coach/query", json=question, headers=headers)
        assert second.status_code == 200
        assert "Push-up" in second.json()["answer"]
        assert second.json()["cached"] is False
