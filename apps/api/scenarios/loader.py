"""Load scenario definitions from YAML fixture files."""
from __future__ import annotations
import os
import yaml
from pathlib import Path
from typing import Optional


FIXTURES_DIR = Path(__file__).parent.parent.parent.parent / "fixtures"


def _load_yaml(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_all_scenarios() -> list[dict]:
    scenarios = []
    if not FIXTURES_DIR.exists():
        return scenarios
    for scenario_dir in sorted(FIXTURES_DIR.iterdir()):
        yaml_file = scenario_dir / "scenario.yaml"
        if yaml_file.exists():
            data = _load_yaml(yaml_file)
            scenarios.append(data)
    return scenarios


def load_scenario(scenario_id: str) -> Optional[dict]:
    try:
        resolved = (FIXTURES_DIR / scenario_id).resolve()
        if not resolved.is_relative_to(FIXTURES_DIR.resolve()):
            return None
        yaml_file = resolved / "scenario.yaml"
        if not yaml_file.exists():
            return None
        with open(yaml_file, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    except Exception:
        return None


def load_hardened_config() -> dict:
    hardened_file = FIXTURES_DIR / "hardened" / "hardened.yaml"
    if hardened_file.exists():
        return _load_yaml(hardened_file)
    return {}
