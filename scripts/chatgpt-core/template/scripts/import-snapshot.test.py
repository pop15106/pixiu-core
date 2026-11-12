#!/usr/bin/env python3
"""以隔離資料驗證匯入範圍、失敗保留與目錄交換。"""
import importlib.util
import io
import json
from pathlib import Path
import sys
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location("snapshot_importer", Path(__file__).with_name("import-snapshot.py"))
IMPORTER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(IMPORTER)
COMMIT = "a" * 40


class ImportSnapshotTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="pixiu-import-test-")
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.root = self.base / "owned-fixture"
        self.root.mkdir()
        self.references = self.root / "references"
        self.original = (IMPORTER.ROOT, IMPORTER.REF, IMPORTER.CORE)
        IMPORTER.ROOT, IMPORTER.REF, IMPORTER.CORE = self.root, self.references, self.references / "core"
        self.addCleanup(self.restore_module)
        self.data = {name: b"fixture\n" for name in IMPORTER.REQUIRED}
        self.data["vault/capabilities/capability-manifest.json"] = json.dumps(
            {"capabilities": [], "resourcePolicy": {"localPrivate": {}}}).encode()
        for name in ("critical-relay", "critical-relay-lifecycle"):
            self.data["skills/" + name + "/SKILL.md"] = b"version: 0.1.0\n"

    def restore_module(self):
        IMPORTER.ROOT, IMPORTER.REF, IMPORTER.CORE = self.original

    def archive(self, data=None):
        target = self.base / "source.tar"
        with tarfile.open(target, "w", format=tarfile.PAX_FORMAT, pax_headers={"comment": COMMIT}) as archive:
            for name, body in (data if data is not None else self.data).items():
                item = tarfile.TarInfo(name)
                item.size = len(body)
                archive.addfile(item, io.BytesIO(body))
        return target

    def install(self, data=None):
        return IMPORTER.import_snapshot(self.archive(data), COMMIT)

    def contents(self):
        return {p.relative_to(self.references).as_posix(): p.read_bytes()
                for p in self.references.rglob("*") if p.is_file()}

    def link(self, target, destination):
        try:
            if sys.platform == "win32":
                # Windows 以一般使用者可建立的 junction 驗證相同目的地邊界。
                subprocess.run(["node", "-e", "require('node:fs').symlinkSync(process.argv[1],process.argv[2],'junction')",
                                str(target), str(destination)], check=True, capture_output=True)
            else:
                destination.symlink_to(target, target_is_directory=True)
        except (OSError, subprocess.CalledProcessError) as error:
            self.skipTest("目前環境不允許建立測試用連結：" + str(error))

    def test_valid_update_preserves_other_reference_files(self):
        self.references.mkdir()
        (self.references / "usage.md").write_text("保留既有操作說明", encoding="utf-8")
        self.install()
        data = dict(self.data, **{"user_rules.md": b"updated\n"})
        self.install(data)
        self.assertEqual((self.references / "core/user_rules.md").read_bytes(), b"updated\n")
        self.assertEqual((self.references / "usage.md").read_text(encoding="utf-8"), "保留既有操作說明")
        self.assertEqual(list(self.root.glob(".pixiu-import-*")), [])

    def test_empty_core_link_never_writes_to_external_directory(self):
        self.references.mkdir()
        outside = self.base / "outside"
        outside.mkdir()
        self.link(outside, self.references / "core")
        with self.assertRaisesRegex(ValueError, "連結"):
            self.install()
        self.assertEqual(list(outside.iterdir()), [])

    def test_reference_directory_link_is_rejected(self):
        outside = self.base / "outside"
        outside.mkdir()
        self.link(outside, self.references)
        with self.assertRaisesRegex(ValueError, "連結"):
            self.install()
        self.assertEqual(list(outside.iterdir()), [])

    def test_mapped_name_collision_preserves_existing_snapshot(self):
        self.install()
        before = self.contents()
        data = dict(self.data)
        data.update({"skills/example/SKILL.md": b"first", "skills/example/SKILL.reference.md": b"second"})
        with self.assertRaisesRegex(ValueError, "重複儲存路徑"):
            self.install(data)
        self.assertEqual(self.contents(), before)

    def test_noncanonical_archive_path_preserves_existing_snapshot(self):
        self.install()
        before = self.contents()
        data = dict(self.data, **{"skills/example/./source.md": b"alias"})
        with self.assertRaisesRegex(ValueError, "無效路徑"):
            self.install(data)
        self.assertEqual(self.contents(), before)

    def test_generation_error_preserves_existing_snapshot(self):
        self.install()
        before = self.contents()
        data = dict(self.data, **{"skills/critical-relay/SKILL.md": b"\xff"})
        with self.assertRaises(UnicodeDecodeError):
            self.install(data)
        self.assertEqual(self.contents(), before)

    def test_publish_failure_restores_previous_directory(self):
        self.install()
        before = self.contents()
        original_rename = Path.rename

        def interrupted_rename(source, target):
            if source.name == "new":
                raise OSError("模擬目錄交換失敗")
            return original_rename(source, target)

        with patch.object(Path, "rename", interrupted_rename):
            with self.assertRaisesRegex(OSError, "模擬"):
                self.install(dict(self.data, **{"user_rules.md": b"new content"}))
        self.assertEqual(self.contents(), before)
        self.assertEqual(list(self.root.glob(".pixiu-import-*")), [])

    def test_uncommitted_source_changes_are_preserved(self):
        self.install()
        target = self.references / "core/user_rules.md"
        target.write_bytes(b"local edit")
        with self.assertRaisesRegex(ValueError, "未保存修改"):
            self.install()
        self.assertEqual(target.read_bytes(), b"local edit")


if __name__ == "__main__":
    unittest.main()
