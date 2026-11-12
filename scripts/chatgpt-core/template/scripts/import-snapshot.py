#!/usr/bin/env python3
"""匯入已核對 commit 的 Git archive，更新母體快照與按需索引。"""
import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import tarfile
import tempfile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / "references"
CORE = REF / "core"
ALLOWED = ("vault/bootstrap/", "vault/capabilities/", "vault/governance/", "vault/context/",
           "vault/sop/", "vault/templates/", "rules/", ".agent/workflows/", "commands/",
           "skills/", "scripts/router/", "scripts/critical-relay/", "scripts/codex-native-core/")
TOP = {"AGENTS.md", "CODEX.md", "CLAUDE.md", "GEMINI.md", "user_rules.md", "LICENSE", "LICENSE.md"}
REQUIRED = {"user_rules.md", "vault/bootstrap/SESSION-BOOTSTRAP.md",
            "vault/capabilities/capability-manifest.json", "vault/governance/cr-risk-review.md",
            "scripts/router/resolve-capabilities.js", "scripts/critical-relay/risk-review.js", "skills/INDEX.md"}

def sha(data):
    return hashlib.sha256(data).hexdigest()

def safe_name(name):
    parts = PurePosixPath(name).parts
    if (not name or name.startswith("/") or "\\" in name or ":" in name or "\0" in name or
        ".." in parts or PurePosixPath(name).as_posix() != name or name == "."):
        raise ValueError("封存包含無效路徑")
    return name

def stored_name(name):
    return name[:-8] + "SKILL.reference.md" if name.endswith("SKILL.md") else name

def text_member(archive, name):
    return archive.extractfile(name).read().decode("utf-8-sig")

def cell(text):
    return str(text).replace("|", "／").replace("\n", " ")

def linked(target):
    """同時辨識符號連結與 Windows 重新解析點。"""
    try:
        details = target.lstat()
    except FileNotFoundError:
        return False
    return (stat.S_ISLNK(details.st_mode) or
            bool(getattr(details, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0)))

def plain_tree(directory):
    """檢查既有目的地；目錄本身、子目錄與檔案都不跟隨連結。"""
    if linked(directory):
        raise ValueError("匯入目的地含連結：" + str(directory))
    if not directory.exists():
        return
    if not directory.is_dir():
        raise ValueError("匯入目的地不是目錄：" + str(directory))
    for target in directory.rglob("*"):
        mode = target.lstat().st_mode
        if linked(target) or not (stat.S_ISDIR(mode) or stat.S_ISREG(mode)):
            raise ValueError("匯入目的地含連結或特殊檔案：" + str(target))

def publish_references(data_by_path, generated, manifest):
    """先完成新副本，再交換目錄；失敗時保留原有快照。"""
    plain_tree(REF)
    workspace = Path(tempfile.mkdtemp(prefix=".pixiu-import-", dir=ROOT))
    staged, backup = workspace / "new", workspace / "previous"
    cleanup = True
    try:
        if REF.exists():
            shutil.copytree(REF, staged)
        else:
            staged.mkdir()
        staged_core = staged / "core"
        if staged_core.exists():
            shutil.rmtree(staged_core)
        staged_core.mkdir()
        for name, data in data_by_path.items():
            target = staged_core / stored_name(name)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        for name, text in generated.items():
            (staged / name).write_text(text, encoding="utf-8")
        (staged / "snapshot.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        if REF.exists():
            REF.rename(backup)
        try:
            staged.rename(REF)
        except BaseException:
            if backup.exists():
                try:
                    backup.rename(REF)
                except OSError as error:
                    cleanup = False
                    raise RuntimeError("還原失敗，已保留備份：" + str(backup)) from error
            raise
    finally:
        if cleanup:
            shutil.rmtree(workspace)

def import_snapshot(archive_path, commit):
    if not re.fullmatch(r"[a-f0-9]{40}", commit):
        raise ValueError("需要完整來源 commit")
    if linked(ROOT) or not ROOT.is_dir():
        raise ValueError("Skill 根目錄含連結或不存在")
    plain_tree(REF)
    with tarfile.open(archive_path, "r:*") as archive:
        if archive.pax_headers.get("comment", "").strip() != commit:
            raise ValueError("Git archive 的 commit 與指定來源不一致")
        members, seen = [], set()
        for item in archive.getmembers():
            name = safe_name(item.name.rstrip("/") if item.isdir() else item.name)
            if item.isdir():
                continue
            if not item.isfile() or item.size > 8 * 1024 * 1024 or name in seen:
                raise ValueError("封存檔案型別、大小或重複路徑無效：" + name)
            seen.add(name)
            members.append((name, item))
        capability = json.loads(text_member(archive, "vault/capabilities/capability-manifest.json"))
        private = set(capability.get("resourcePolicy", {}).get("localPrivate", {}))
        records, data_by_path, excluded, adapter_files = [], {}, [], []
        storage_names = set()
        for name, item in members:
            prefix = "scripts/chatgpt-core/template/"
            if name.startswith(prefix):
                relative = safe_name(name[len(prefix):])
                data = archive.extractfile(item).read()
                installed = ROOT / relative
                current = ROOT
                for part in PurePosixPath(relative).parts:
                    current = current / part
                    if linked(current):
                        raise ValueError("適配範本含連結：" + relative)
                if not installed.is_file() or installed.read_bytes() != data:
                    raise ValueError("請先更新 ChatGPT 適配範本：" + relative)
                adapter_files.append({"path": relative, "sourcePath": name,
                                      "bytes": len(data), "sha256": sha(data)})
                continue
            if (name in private or name.startswith(("vault/memory/", "skills/cybersecurity-library/")) or
                not (name in TOP or name.startswith(ALLOWED))):
                excluded.append(name)
                continue
            if Path(name).name.startswith(".env") or re.search(r"\.(pem|key|pfx|p12|log)$", name):
                excluded.append(name)
                continue
            stored = stored_name(name).casefold()
            if stored in storage_names:
                raise ValueError("來源映射到重複儲存路徑：" + name)
            storage_names.add(stored)
            data = archive.extractfile(item).read()
            if re.search(rb"-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----", data):
                raise ValueError("來源含私人憑證：" + name)
            data_by_path[name] = data
            records.append({"path": name, "storagePath": stored_name(name), "bytes": len(data), "sha256": sha(data)})
    for name in storage_names:
        if any(parent.as_posix() in storage_names for parent in PurePosixPath(name).parents):
            raise ValueError("來源檔案與目錄路徑衝突：" + name)
    if not REQUIRED.issubset(data_by_path):
        raise ValueError("快照缺少必要母體內容")
    missing = sorted({p for c in capability["capabilities"] for group in c.get("load", {}).values()
                      for p in group if p not in data_by_path and p not in private})
    if missing:
        raise ValueError("路由依賴未納入快照：" + ", ".join(missing))
    # 只替換可核對的既有來源；意外改動留給維護者處理。
    manifest_path = REF / "snapshot.json"
    if manifest_path.exists() or (CORE.exists() and any(CORE.iterdir())):
        previous = json.loads(manifest_path.read_text(encoding="utf-8"))
        expected = {item.get("storagePath", item["path"]): item for item in previous["files"]}
        actual = {p.relative_to(CORE).as_posix(): p for p in CORE.rglob("*") if p.is_file()}
        if set(expected) != set(actual) or any(linked(p) for p in CORE.rglob("*")):
            raise ValueError("既有快照含未登錄檔案或連結")
        for name, item in expected.items():
            if sha(actual[name].read_bytes()) != item["sha256"]:
                raise ValueError("既有快照有未保存修改：" + name)
    skills = sorted(p for p in data_by_path if re.fullmatch(r"skills/[^/]+/SKILL.md", p))
    workflows = sorted(p for p in data_by_path if p.startswith(".agent/workflows/") and p.endswith(".md"))
    manifest = {
        "schemaVersion": 1, "sourceRepository": "https://github.com/pop15106/pixiu-core",
        "sourceCommit": commit, "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourcePolicy": "Git archive 位元組快照；核心文件按需載入，正式執行回到目標專案。",
        "capabilityCount": len(capability["capabilities"]), "skillCount": len(skills),
        "workflowCount": len(workflows), "externalReferences": sorted(private),
        "excludedArchivePaths": sorted(excluded), "adapterFiles": adapter_files,
        "files": sorted(records, key=lambda x: x["path"])
    }
    rows = ["# 能力與觸發索引", "", "來源：" + commit, "",
            "一次選擇最多三個能力；純文字分支依主 Skill 專用入口處理。", "",
            "| 能力 | 觸發範例 | 對應規格 |", "| --- | --- | --- |"]
    for c in capability["capabilities"]:
        triggers = c.get("aliases", []) + c.get("keywords", [])
        links = []
        for p in [p for group in c.get("load", {}).values() for p in group]:
            links.append("[" + cell(p) + "](core/" + stored_name(p) + ")" if p in data_by_path else cell(p) + "（外部資料）")
        rows.append("| " + cell(c["id"]) + " | " + cell("、".join(triggers[:7])) + " | " + "、".join(links) + " |")
    generated = {"capabilities.md": "\n".join(rows) + "\n"}
    rows = ["# 原始 Workflow 索引", "", "依主 Skill 將流程步驟當成指令使用；工具及服務需實際可用。", "",
            "| 流程 | 說明 |", "| --- | --- |"]
    for p in workflows:
        text = data_by_path[p].decode("utf-8-sig")
        match = re.search(r"^description:\s*(.+)$", text, re.M)
        desc = match.group(1).strip() if match else "依名稱與任務範圍選取原文。"
        rows.append("| [" + Path(p).stem + "](core/" + p + ") | " + cell(desc[:180]) + " |")
    skill_rows = ["# 母體技能索引", "", "原始技能保留為參考規格，由單一 PixiuCore 入口按需載入。", ""]
    skill_rows.extend("- [" + p.split("/")[1] + "](core/" + stored_name(p) + ")" for p in skills)
    generated["skills.md"] = "\n".join(skill_rows) + "\n"
    generated["workflows.md"] = "\n".join(rows) + "\n"
    version = ["# PixiuCore 版本紀錄", "", "母體 commit：" + commit,
               "來源：https://github.com/pop15106/pixiu-core/commit/" + commit,
               "能力：" + str(manifest["capabilityCount"]), "技能規格：" + str(len(skills)),
               "Workflow：" + str(len(workflows)), "", "這是固定版本快照。原始規格及流程按需載入。",
               "snapshot.json 的完整檔案清單由程式驗證，不需要全文送入對話。"]
    for name in ("critical-relay", "critical-relay-lifecycle"):
        body = data_by_path["skills/" + name + "/SKILL.md"].decode("utf-8-sig")
        match = re.search(r"^version:\s*(.+)$", body, re.M)
        version.append(name + "：" + (match.group(1).strip() if match else "未標示"))
    generated["version.md"] = "\n".join(version) + "\n"
    manifest["generatedFiles"] = []
    for name in ("capabilities.md", "workflows.md", "skills.md", "version.md"):
        data = generated[name].encode("utf-8")
        manifest["generatedFiles"].append({"path": "references/" + name,
                                           "bytes": len(data), "sha256": sha(data)})
    publish_references(data_by_path, generated, manifest)
    return {k: manifest[k] for k in ("sourceCommit", "capabilityCount", "skillCount", "workflowCount")}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", required=True)
    parser.add_argument("--commit", required=True)
    args = parser.parse_args()
    print(json.dumps(import_snapshot(args.archive, args.commit), ensure_ascii=False))
