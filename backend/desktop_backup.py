"""Consistent SQLite backup and verification for the standalone desktop edition.

Only the Electron main process should invoke these functions.  Backups are
created with SQLite's online backup API; copying billing.db while open is unsafe.
"""
from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path

FORMAT_VERSION = 1
MAX_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _integrity(path: Path) -> None:
    connection = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
    try:
        result = connection.execute("PRAGMA integrity_check").fetchone()
        if not result or result[0] != "ok":
            raise ValueError(f"SQLite integrity check failed: {result}")
    finally:
        connection.close()


def create_backup(database_path: str, destination: str) -> dict:
    source = Path(database_path).resolve()
    target = Path(destination).resolve()
    if not source.is_file():
        raise FileNotFoundError("Desktop database does not exist")
    if source == target:
        raise ValueError("Backup destination cannot overwrite the database")
    target.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="resolvent-backup-") as temp:
        snapshot = Path(temp) / "database.sqlite"
        with sqlite3.connect(str(source), timeout=30) as original:
            with sqlite3.connect(str(snapshot)) as copy:
                original.backup(copy, pages=256, sleep=0.05)
        _integrity(snapshot)
        manifest = {
            "format": "resolvent-desktop-backup",
            "version": FORMAT_VERSION,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "database_sha256": _sha256(snapshot),
            "database_bytes": snapshot.stat().st_size,
        }
        fd, temp_name = tempfile.mkstemp(prefix=".resolvent-", suffix=".tmp", dir=target.parent)
        os.close(fd)
        try:
            with zipfile.ZipFile(temp_name, "w", compression=zipfile.ZIP_DEFLATED, allowZip64=True) as archive:
                archive.write(snapshot, "database.sqlite")
                archive.writestr("manifest.json", json.dumps(manifest, indent=2))
            os.replace(temp_name, target)
        finally:
            if os.path.exists(temp_name):
                os.unlink(temp_name)
    return {"path": str(target), **manifest}


def inspect_backup(archive_path: str) -> dict:
    path = Path(archive_path).resolve()
    if not path.is_file() or path.stat().st_size > MAX_ARCHIVE_BYTES:
        raise ValueError("Backup missing or exceeds supported archive size")
    with tempfile.TemporaryDirectory(prefix="resolvent-verify-") as temp:
        with zipfile.ZipFile(path) as archive:
            if sorted(archive.namelist()) != ["database.sqlite", "manifest.json"]:
                raise ValueError("Backup contains unexpected files")
            manifest = json.loads(archive.read("manifest.json"))
            if manifest.get("format") != "resolvent-desktop-backup" or manifest.get("version") != FORMAT_VERSION:
                raise ValueError("Unsupported backup format")
            if archive.getinfo("database.sqlite").file_size > MAX_ARCHIVE_BYTES:
                raise ValueError("Database exceeds supported size")
            db = Path(temp) / "database.sqlite"
            with archive.open("database.sqlite") as src, db.open("wb") as dst:
                import shutil
                shutil.copyfileobj(src, dst, length=1024 * 1024)
        if _sha256(db) != manifest.get("database_sha256"):
            raise ValueError("Backup checksum mismatch")
        if db.stat().st_size != manifest.get("database_bytes"):
            raise ValueError("Backup database size mismatch")
        _integrity(db)
        return manifest
