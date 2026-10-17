"""Tests for standalone SQLite backup consistency and tamper detection."""
import json
import sqlite3
import zipfile

import pytest

from desktop_backup import create_backup, inspect_backup


def test_backup_preserves_live_sqlite_data(tmp_path):
    database = tmp_path / "billing.db"
    with sqlite3.connect(database) as connection:
        connection.execute("CREATE TABLE invoices (id INTEGER PRIMARY KEY, total INTEGER)")
        connection.execute("INSERT INTO invoices(total) VALUES (580)")
        connection.commit()

        archive = tmp_path / "shop.rbackup"
        created = create_backup(str(database), str(archive))
        inspected = inspect_backup(str(archive))
        assert created["database_sha256"] == inspected["database_sha256"]

        with zipfile.ZipFile(archive) as bundle:
            snapshot = tmp_path / "snapshot.sqlite"
            snapshot.write_bytes(bundle.read("database.sqlite"))
        with sqlite3.connect(snapshot) as restored:
            assert restored.execute("SELECT total FROM invoices").fetchone()[0] == 580


def test_modified_backup_is_rejected(tmp_path):
    database = tmp_path / "billing.db"
    with sqlite3.connect(database) as connection:
        connection.execute("CREATE TABLE example (id INTEGER)")
    original = tmp_path / "original.rbackup"
    create_backup(str(database), str(original))
    altered = tmp_path / "altered.rbackup"
    with zipfile.ZipFile(original) as src, zipfile.ZipFile(altered, "w") as dst:
        dst.writestr("database.sqlite", b"tampered")
        dst.writestr("manifest.json", src.read("manifest.json"))
    with pytest.raises(ValueError, match="checksum"):
        inspect_backup(str(altered))
