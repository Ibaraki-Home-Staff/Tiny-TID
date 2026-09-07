"""Ensure the D1 database exists, print its id (Dantalian ci/ port).

Usage: python ci/provision_d1.py
Env: D1_DATABASE_NAME (default "tiny-tid"), CLOUDFLARE_* via wrangler.
Writes `database_id` to GITHUB_OUTPUT when present, else stdout.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys


def fail(message: str) -> None:
    raise SystemExit(message)


def run_wrangler(*args: str) -> str:
    result = subprocess.run(
        ["bunx", "wrangler", *args],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        fail(f"wrangler {' '.join(args)} failed: {result.stderr.strip()}")
    return result.stdout


def parse_json(output: str):
    stripped = output.strip()
    start = min(
        (stripped.find(c) for c in "[{" if stripped.find(c) != -1),
        default=-1,
    )
    if start == -1:
        fail("wrangler returned invalid JSON")
    end_char = "]" if stripped[start] == "[" else "}"
    end = stripped.rfind(end_char) + 1
    try:
        return json.loads(stripped[start:end])
    except json.JSONDecodeError:
        fail("wrangler returned invalid JSON")


def record_id(record: dict) -> str | None:
    for key in ("uuid", "database_id", "id"):
        value = record.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def find_database(name: str) -> str | None:
    payload = parse_json(run_wrangler("d1", "list", "--json"))
    records = payload if isinstance(payload, list) else []
    for record in records:
        if isinstance(record, dict) and record.get("name") == name:
            found = record_id(record)
            if found:
                return found
    return None


def ensure_database(name: str) -> str:
    found = find_database(name)
    if found:
        return found
    # `d1 create` takes no --json flag: create, then resolve via re-list.
    run_wrangler("d1", "create", name)
    found = find_database(name)
    if found:
        return found
    fail(f"could not create or resolve D1 database {name!r}")


def main() -> None:
    name = os.environ.get("D1_DATABASE_NAME", "tiny-tid").strip() or "tiny-tid"
    database_id = ensure_database(name)
    output_path = os.environ.get("GITHUB_OUTPUT")
    if output_path:
        with open(output_path, "a", encoding="utf-8") as output:
            output.write(f"database_id={database_id}\n")
    else:
        print(database_id)


if __name__ == "__main__":
    main()
