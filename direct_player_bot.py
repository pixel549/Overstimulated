#!/usr/bin/env python3
"""External direct-play runner for Overstimulated.

This script starts the game in a real browser, reads live state through a small
page API, and drives Dad from outside the game loop so the run is easy to
watch and easy to export.
"""

from __future__ import annotations

import argparse
import json
import math
import socket
import subprocess
import sys
import time
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from selenium import webdriver
    from selenium.webdriver.edge.options import Options as EdgeOptions
except ImportError as exc:  # pragma: no cover - dependency check
    raise SystemExit(
        "Selenium is required. Install it with: python -m pip install selenium"
    ) from exc


ROOT = Path(__file__).resolve().parent
REPORT_DIR = ROOT / "playtest_reports"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def choose_port(start: int = 8060, end: int = 8090) -> int:
    for port in range(start, end + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.2)
            if sock.connect_ex(("127.0.0.1", port)) != 0:
                return port
    raise RuntimeError("No free local port found for the direct player bot.")


def wait_for_url(url: str, timeout: float = 12.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1.0) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(0.2)
    raise RuntimeError(f"Timed out waiting for {url}")


class LocalServer:
    def __init__(self, root: Path):
        self.root = root
        self.port = choose_port()
        self.url = f"http://127.0.0.1:{self.port}/"
        self.process: subprocess.Popen[str] | None = None

    def __enter__(self) -> "LocalServer":
        self.process = subprocess.Popen(
            [sys.executable, "-m", "http.server", str(self.port)],
            cwd=str(self.root),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        wait_for_url(self.url)
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        if not self.process:
            return
        self.process.terminate()
        try:
            self.process.wait(timeout=5)
        except Exception:
            self.process.kill()


@dataclass
class Objective:
    type: str
    label: str
    target_x: int
    target_y: int
    task_id: int | None = None
    task_type: str | None = None

    @property
    def key(self) -> str:
        if self.type == "task" and self.task_id is not None:
            return f"task:{self.task_id}"
        return f"{self.type}:{self.label}"


class DirectPlayerBot:
    def __init__(
        self,
        driver: webdriver.Edge,
        url: str,
        runs: int,
        run_timeout: float,
        output_dir: Path,
    ) -> None:
        self.driver = driver
        self.url = url
        self.runs = runs
        self.run_timeout = run_timeout
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.current_objective: Objective | None = None
        self.objective_started_at = 0.0
        self.blocked_until: dict[str, float] = {}
        self.recovery_target: dict[str, int] | None = None
        self.recovery_until = 0.0
        self.last_probe_position: tuple[int, int] | None = None
        self.last_probe_time = 0.0
        self.stuck_counter = 0
        self.known_tasks: dict[int, dict[str, Any]] = {}
        self.last_tasks_completed_total = 0
        self.action_cooldown_until = 0.0
        self.log: list[dict[str, Any]] = []
        self.reports: list[dict[str, Any]] = []
        self.last_controls: dict[str, bool] = {
            "up": False,
            "down": False,
            "left": False,
            "right": False,
            "sprinting": False,
            "actionHeld": False,
        }

    def api_call(self, method: str, *args: Any) -> Any:
        script = """
            const api = window.directPlayerApi;
            if (!api || typeof api[arguments[0]] !== 'function') {
              return null;
            }
            return api[arguments[0]].apply(api, Array.prototype.slice.call(arguments, 1));
        """
        return self.driver.execute_script(script, method, *args)

    def wait_for_api(self) -> None:
        deadline = time.time() + 15
        while time.time() < deadline:
            ready = self.driver.execute_script(
                "return !!(window.directPlayerApi && window.directPlayerApi.getSnapshot);"
            )
            if ready:
                return
            time.sleep(0.2)
        raise RuntimeError("Direct player API never became ready.")

    def get_snapshot(self) -> dict[str, Any]:
        snapshot = self.api_call("getSnapshot")
        if not snapshot:
            raise RuntimeError("Could not read game snapshot from page.")
        return snapshot

    def route_plan(self, target_x: int, target_y: int) -> dict[str, Any]:
        plan = self.api_call("planRoute", int(target_x), int(target_y))
        return plan or {
            "canGoDirect": True,
            "route": [],
            "nextTarget": {"x": target_x, "y": target_y, "waypointName": None, "label": "Direct"},
            "targetDoor": None,
        }

    def recovery_point(self, target_x: int, target_y: int) -> dict[str, int] | None:
        return self.api_call("getRecoveryPoint", int(target_x), int(target_y))

    def set_controls(self, **state: bool) -> None:
        next_state = {
            "up": bool(state.get("up", False)),
            "down": bool(state.get("down", False)),
            "left": bool(state.get("left", False)),
            "right": bool(state.get("right", False)),
            "sprinting": bool(state.get("sprinting", False)),
            "actionHeld": bool(state.get("actionHeld", False)),
        }
        if next_state != self.last_controls:
            self.api_call("setControls", next_state)
            self.last_controls = next_state

    def clear_controls(self) -> None:
        if any(self.last_controls.values()):
            self.api_call("clearControls")
            self.last_controls = {key: False for key in self.last_controls}

    def tap(self, control: str = "action") -> None:
        now = time.monotonic()
        if control == "action" and now < self.action_cooldown_until:
            return
        self.api_call("tapControl", control)
        if control == "action":
            self.action_cooldown_until = now + 0.3

    def log_event(self, event_type: str, **details: Any) -> None:
        entry = {"wallTime": utc_now(), "type": event_type}
        entry.update(details)
        self.log.append(entry)

    def block_objective(self, objective: Objective, snapshot_time: float, duration: float = 25.0) -> None:
        self.blocked_until[objective.key] = snapshot_time + duration
        self.log_event("objective_blocked", label=objective.label, objectiveType=objective.type, until=snapshot_time + duration)

    def is_blocked(self, objective: Objective, snapshot_time: float) -> bool:
        blocked = self.blocked_until.get(objective.key)
        if blocked is None:
            return False
        if blocked <= snapshot_time:
            del self.blocked_until[objective.key]
            return False
        return True

    def objective_distance(self, snapshot: dict[str, Any], objective: Objective) -> float:
        return math.hypot(
            objective.target_x - snapshot["dad"]["centerX"],
            objective.target_y - snapshot["dad"]["centerY"],
        )

    def score_task(self, snapshot: dict[str, Any], task: dict[str, Any]) -> float:
        base = {"fetch": 120.0, "coverage": 95.0, "hold": 80.0}.get(task["type"], 70.0)
        name = task["name"]
        if name == "MOVE SPRINKLER":
            base += 90
        if name == "ROUND UP CHICKENS":
            base += 80
        if name == "GET BEER":
            base += 65
        if name.startswith("Clean poop"):
            base += 36 + task["maxProgress"] * 1.5
        if name.startswith("Collect toys"):
            base += 24 + task["maxProgress"]
        if name == "Straighten coffee table":
            base += 16
        if name == "Straighten armchair":
            base += 15
        if name == "Clear kitchen island":
            base += 14
        if name == "Put groceries away":
            base += 12
        if task["location"] == "Baby":
            base -= 15
        if snapshot["overstimulation"] > 75 and task["type"] == "hold":
            base -= 20
        if len(snapshot["tasks"]) > 4 and task["type"] == "hold":
            base -= 25
        if snapshot["overstimulation"] > 60 and task["location"] == "Baby":
            base -= 15
        return base - (task["distance"] or 0) / 30.0

    def choose_best_task_objective(self, snapshot: dict[str, Any], snapshot_time: float) -> Objective | None:
        tasks = sorted(snapshot["tasks"], key=lambda task: self.score_task(snapshot, task), reverse=True)
        for task in tasks:
            objective = self.make_task_objective(task)
            if not self.is_blocked(objective, snapshot_time):
                return objective
        return None

    def make_task_objective(self, task: dict[str, Any]) -> Objective:
        return Objective(
            type="task",
            label=f"Task: {task['name']}",
            target_x=task["targetX"],
            target_y=task["targetY"],
            task_id=task["id"],
            task_type=task["type"],
        )

    def choose_objective(self, snapshot: dict[str, Any]) -> Objective:
        snapshot_time = snapshot["time"]
        best_task_objective = self.choose_best_task_objective(snapshot, snapshot_time)

        if self.current_objective and self.is_objective_valid(self.current_objective, snapshot):
            if (
                self.current_objective.type == "coffee"
                and snapshot["tasks"]
                and snapshot["coffeeProgress"] < 0.25
            ):
                self.block_objective(self.current_objective, snapshot_time, duration=20.0)
                self.current_objective = None
            elif (
                self.current_objective.type == "coffee"
                and (snapshot_time - self.objective_started_at) > 10.0
                and snapshot["coffeeProgress"] < 0.25
            ):
                self.block_objective(self.current_objective, snapshot_time, duration=35.0)
                self.current_objective = None
            elif self.current_objective.type == "idle":
                if snapshot["tasks"] or (snapshot_time - self.objective_started_at) > 4.0:
                    self.current_objective = None
                else:
                    return self.current_objective
            elif self.current_objective.type == "task":
                current_task = next(
                    (task for task in snapshot["tasks"] if task["id"] == self.current_objective.task_id),
                    None,
                )
                if current_task is None:
                    self.current_objective = None
                else:
                    timeout = 14.0 if self.current_objective.task_type == "fetch" else (
                        24.0 if self.current_objective.task_type == "hold" else 18.0
                    )
                    distance = float(current_task.get("distance") or self.objective_distance(snapshot, self.current_objective))
                    progress = float(current_task.get("progress") or 0.0)
                    if (snapshot_time - self.objective_started_at) > timeout and progress <= 0.25 and distance > 72:
                        self.block_objective(self.current_objective, snapshot_time, duration=22.0)
                        self.current_objective = None
                    elif (
                        best_task_objective
                        and best_task_objective.key != self.current_objective.key
                        and (snapshot_time - self.objective_started_at) > (
                            8.0 if self.current_objective.task_type == "hold" else 5.0
                        )
                        and progress <= 0.1
                        and distance > 110
                    ):
                        self.current_objective = None
                    else:
                        if snapshot["overstimulation"] >= 82 and self.current_objective.type != "toilet":
                            toilet = self.make_static_objective(snapshot, "toilet", "Hide in toilet")
                            if toilet and not self.is_blocked(toilet, snapshot_time):
                                return toilet
                        return self.current_objective
            else:
                if snapshot["overstimulation"] >= 82 and self.current_objective.type != "toilet":
                    toilet = self.make_static_objective(snapshot, "toilet", "Hide in toilet")
                    if toilet and not self.is_blocked(toilet, snapshot_time):
                        return toilet
                return self.current_objective

        if best_task_objective is not None:
            return best_task_objective

        if snapshot["overstimulation"] >= 82:
            toilet = self.make_static_objective(snapshot, "toilet", "Hide in toilet")
            if toilet and not self.is_blocked(toilet, snapshot_time):
                return toilet

        if snapshot["overstimulation"] >= 62:
            relax = self.make_static_objective(snapshot, "relax", "Take a breather")
            if relax and not self.is_blocked(relax, snapshot_time):
                return relax

        if (
            not snapshot["coffeeBuff"]
            and snapshot["time"] < 90
            and snapshot["overstimulation"] < 68
            and len(snapshot["tasks"]) <= 2
        ):
            coffee = self.make_static_objective(snapshot, "coffee", "Brew coffee")
            if (
                coffee
                and not self.is_blocked(coffee, snapshot_time)
                and snapshot["dad"]["roomKey"] == "KITCHEN"
            ):
                return coffee

        idle = snapshot["pois"].get("idle") or snapshot["pois"]["livingRoom"]
        idle_name = idle.get("name", "living room")
        return Objective("idle", f"Stand by in {idle_name}", idle["x"], idle["y"])

    def make_static_objective(self, snapshot: dict[str, Any], kind: str, label: str) -> Objective | None:
        if kind == "toilet":
            poi = snapshot["pois"].get("toilet")
        elif kind == "relax":
            poi = snapshot["pois"].get("relax") or snapshot["pois"].get("couch") or snapshot["pois"].get("bed")
        elif kind == "coffee":
            poi = snapshot["pois"].get("coffee")
        else:
            poi = snapshot["pois"].get("idle") or snapshot["pois"].get("livingRoom")
        if not poi:
            return None
        return Objective(kind, label, int(poi["x"]), int(poi["y"]))

    def is_objective_valid(self, objective: Objective, snapshot: dict[str, Any]) -> bool:
        if self.is_blocked(objective, snapshot["time"]):
            return False
        if objective.type == "task":
            return any(task["id"] == objective.task_id for task in snapshot["tasks"])
        if objective.type == "coffee":
            return not snapshot["coffeeBuff"]
        return True

    def should_exit_special_state(self, snapshot: dict[str, Any]) -> bool:
        if snapshot["isHidingInToilet"]:
            return snapshot["overstimulation"] <= 38 or (snapshot["time"] - self.objective_started_at) > 8
        if snapshot["isRelaxing"]:
            return snapshot["overstimulation"] <= 32 or (
                snapshot["tasks"] and (snapshot["time"] - self.objective_started_at) > 5
            )
        return False

    def move_toward(
        self,
        snapshot: dict[str, Any],
        target_x: int,
        target_y: int,
        *,
        action_held: bool = False,
        door_orient: str | None = None,
    ) -> None:
        dad = snapshot["dad"]
        dx = target_x - dad["centerX"]
        dy = target_y - dad["centerY"]
        distance = math.hypot(dx, dy)
        dead_zone = 6
        align_threshold = 10
        cross_axis_threshold = 8

        move_x = dx
        move_y = dy
        if door_orient == "v" and abs(dy) > align_threshold and abs(dx) > cross_axis_threshold:
            move_x = 0
        elif door_orient == "h" and abs(dx) > align_threshold and abs(dy) > cross_axis_threshold:
            move_y = 0

        self.set_controls(
            up=move_y < -dead_zone,
            down=move_y > dead_zone,
            left=move_x < -dead_zone,
            right=move_x > dead_zone,
            sprinting=door_orient is None and distance > 220 and snapshot["sprintEnergy"] > 25,
            actionHeld=action_held,
        )

    def handle_interactions(self, snapshot: dict[str, Any], objective: Objective) -> bool:
        if snapshot["isHidingInToilet"] or snapshot["isRelaxing"]:
            self.clear_controls()
            if self.should_exit_special_state(snapshot):
                self.tap("action")
            return True

        nearby_task = snapshot.get("nearbyTask")
        if objective.type == "task" and nearby_task and nearby_task["id"] == objective.task_id:
            distance = float(nearby_task.get("distance") or self.objective_distance(snapshot, objective))
            if objective.task_type == "fetch":
                if distance > 72:
                    self.move_toward(snapshot, objective.target_x, objective.target_y)
                else:
                    self.clear_controls()
                    self.tap("action")
            else:
                task_hold_distance = 68 if objective.task_type == "hold" else 60
                if distance > task_hold_distance:
                    self.move_toward(snapshot, objective.target_x, objective.target_y, action_held=True)
                else:
                    self.set_controls(actionHeld=True)
            return True

        if objective.type == "coffee" and snapshot.get("nearCoffee"):
            self.clear_controls()
            self.set_controls(actionHeld=True)
            return True

        toilet_spot = snapshot.get("toiletSpot") or {}
        if objective.type == "toilet" and toilet_spot.get("canHide"):
            self.clear_controls()
            self.tap("action")
            return True

        if objective.type == "relax" and snapshot.get("relaxSpot"):
            self.clear_controls()
            self.tap("action")
            return True

        return False

    def update_stuck_state(self, snapshot: dict[str, Any], objective: Objective) -> None:
        now = time.monotonic()
        position = (snapshot["dad"]["centerX"], snapshot["dad"]["centerY"])
        if self.last_probe_position is None:
            self.last_probe_position = position
            self.last_probe_time = now
            return

        if now - self.last_probe_time < 1.2:
            return

        moved = math.hypot(position[0] - self.last_probe_position[0], position[1] - self.last_probe_position[1])
        distance = self.objective_distance(snapshot, objective)
        if moved < 8 and distance > 50:
            self.stuck_counter += 1
            self.log_event(
                "stuck",
                count=self.stuck_counter,
                label=objective.label,
                room=snapshot["dad"]["roomName"],
                x=position[0],
                y=position[1],
            )
            nearby_door = snapshot.get("nearbyDoor")
            if nearby_door and not nearby_door["open"]:
                self.tap("action")
            if self.stuck_counter >= 2 and now >= self.recovery_until:
                recovery = self.recovery_point(objective.target_x, objective.target_y)
                if recovery:
                    self.recovery_target = recovery
                    self.recovery_until = now + 0.6
                    self.log_event("recovery", x=recovery["x"], y=recovery["y"])
            if self.stuck_counter >= 5:
                self.block_objective(objective, snapshot["time"])
                self.current_objective = None
                self.stuck_counter = 0
                self.recovery_target = None
                self.recovery_until = 0.0
        else:
            self.stuck_counter = 0

        self.last_probe_position = position
        self.last_probe_time = now

    def drive_current_state(self, snapshot: dict[str, Any], objective: Objective) -> None:
        if self.handle_interactions(snapshot, objective):
            return

        now = time.monotonic()
        if self.recovery_target and now < self.recovery_until:
            self.move_toward(snapshot, self.recovery_target["x"], self.recovery_target["y"])
            return

        self.recovery_target = None
        self.recovery_until = 0.0

        plan = self.route_plan(objective.target_x, objective.target_y)
        next_target = plan["nextTarget"]
        target_door = plan.get("targetDoor")
        door_orient = target_door.get("orient") if target_door else None
        self.move_toward(snapshot, next_target["x"], next_target["y"], door_orient=door_orient)

        if target_door and not target_door["open"] and target_door["distance"] <= 84:
            self.tap("action")

    def reset_run_state(self) -> None:
        self.current_objective = None
        self.objective_started_at = 0.0
        self.blocked_until = {}
        self.recovery_target = None
        self.recovery_until = 0.0
        self.last_probe_position = None
        self.last_probe_time = 0.0
        self.stuck_counter = 0
        self.action_cooldown_until = 0.0
        self.known_tasks = {}
        self.last_tasks_completed_total = 0
        self.log = []
        self.clear_controls()

    def record_task_changes(self, snapshot: dict[str, Any]) -> None:
        current_tasks = {task["id"]: task for task in snapshot["tasks"]}
        completed_total = int(snapshot["stats"]["tasksCompleted"])

        if not self.known_tasks:
            self.known_tasks = current_tasks
            self.last_tasks_completed_total = completed_total
            return

        for task_id, task in current_tasks.items():
            if task_id not in self.known_tasks:
                self.log_event("task_spawned", name=task["name"], location=task["location"], taskType=task["type"])

        for task_id, task in self.known_tasks.items():
            if task_id in current_tasks:
                continue
            event_type = "task_completed" if completed_total > self.last_tasks_completed_total else "task_resolved"
            self.log_event(
                event_type,
                name=task["name"],
                location=task["location"],
                taskType=task["type"],
                progress=task.get("progress"),
                maxProgress=task.get("maxProgress"),
            )

        self.known_tasks = current_tasks
        self.last_tasks_completed_total = completed_total

    def run_once(self, run_number: int) -> dict[str, Any]:
        self.reset_run_state()
        if run_number == 1:
            self.driver.get(self.url)
            self.wait_for_api()
        else:
            self.api_call("restartRun")
            time.sleep(0.5)

        started_at = utc_now()
        deadline = time.monotonic() + self.run_timeout
        snapshot = self.get_snapshot()

        while time.monotonic() < deadline:
            snapshot = self.get_snapshot()
            self.record_task_changes(snapshot)
            if not snapshot["isRunning"]:
                break

            objective = self.choose_objective(snapshot)
            if not self.current_objective or objective.key != self.current_objective.key:
                self.current_objective = objective
                self.objective_started_at = snapshot["time"]
                self.stuck_counter = 0
                self.recovery_target = None
                self.recovery_until = 0.0
                self.last_probe_position = (snapshot["dad"]["centerX"], snapshot["dad"]["centerY"])
                self.last_probe_time = time.monotonic()
                self.log_event(
                    "objective",
                    label=objective.label,
                    objectiveType=objective.type,
                    targetX=objective.target_x,
                    targetY=objective.target_y,
                )

            self.drive_current_state(snapshot, objective)
            self.update_stuck_state(snapshot, objective)
            time.sleep(0.08)

        final_snapshot = self.get_snapshot()
        game_telemetry = self.api_call("exportTelemetry")
        self.clear_controls()

        report = {
            "runNumber": run_number,
            "startedAt": started_at,
            "endedAt": utc_now(),
            "url": self.url,
            "result": "success" if final_snapshot["stats"]["daysCompleted"] > 0 else final_snapshot["modal"]["title"] or "ended",
            "snapshot": final_snapshot,
            "events": self.log[:],
            "gameTelemetry": game_telemetry,
        }
        self.reports.append(report)
        return report

    def save_report(self) -> Path:
        output_path = self.output_dir / f"direct-player-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
        payload = {
            "generatedAt": utc_now(),
            "mode": "direct-player-bot",
            "runs": self.reports,
        }
        output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return output_path


def build_driver(headless: bool, mobile: bool) -> webdriver.Edge:
    options = EdgeOptions()
    if headless:
        options.add_argument("--headless=new")
    options.add_argument("--disable-gpu")
    options.add_argument("--force-device-scale-factor=1")
    driver = webdriver.Edge(options=options)
    if mobile:
        driver.set_window_size(430, 932)
    else:
        driver.set_window_size(1400, 900)
    return driver


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the external direct player bot.")
    parser.add_argument("--url", help="Game URL to open. If omitted, a local server is started.")
    parser.add_argument("--runs", type=int, default=1, help="Number of direct-play runs to execute.")
    parser.add_argument("--timeout", type=float, default=180.0, help="Per-run timeout in real seconds.")
    parser.add_argument("--headless", action="store_true", help="Run without showing the browser window.")
    parser.add_argument("--mobile", action="store_true", help="Use a phone-sized viewport instead of desktop.")
    parser.add_argument(
        "--output-dir",
        default=str(REPORT_DIR),
        help="Folder for JSON run reports.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output_dir = Path(args.output_dir)

    if args.url:
        server_ctx = None
        base_url = args.url
    else:
        server_ctx = LocalServer(ROOT)
        base_url = None

    server_cm = server_ctx if server_ctx is not None else _NullContext()
    with server_cm as server:
        url = base_url or server.url
        with build_driver(args.headless, args.mobile) as driver:
            bot = DirectPlayerBot(driver, url, args.runs, args.timeout, output_dir)
            for run_number in range(1, args.runs + 1):
                report = bot.run_once(run_number)
                snapshot = report["snapshot"]
                print(
                    f"[Run {run_number}] result={report['result']} "
                    f"tasks={snapshot['stats']['tasksCompleted']} "
                    f"stress={snapshot['overstimulation']:.1f}% "
                    f"time={snapshot['time']:.1f}s"
                )

            report_path = bot.save_report()
            print(f"Saved direct player report to: {report_path}")

    return 0


class _NullContext:
    def __enter__(self) -> "_NullContext":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        return None


if __name__ == "__main__":
    raise SystemExit(main())
