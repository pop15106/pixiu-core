#!/usr/bin/env python3
"""匯入已核對 commit 的 Git archive，更新母體快照與按需索引。"""
import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import tarfile
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
            "scripts/router/resolve-capabilities.js", "scripts/critical-relay/risk-review.js"}

def sha(data):
    return hashlib.sha256(data).hexdigest()

def safe_name(name):
    parts = PurePosixPath(name).parts
    if not name or name.startswith("/") or "\\" in name or ":" in name or ".." in parts:
        raise ValueError("封存包含無效路徑")
    return name

def text_member(archive, name):
    return archive.extractfile(name).read().decode("utf-8-sig")

def cell(text):
    return str(text).replace("|", "／").replace("\n", " ")

def import_snapshot(archive_path, commit):
    if not re.fullmatch(r"[a-f0-9]{40}", commit):
        raise ValueError("需要完整來源 commit")
    with tarfile.open(archive_path, "r:*") as archive:
        if archive.pax_headers.get("comment", "").strip() != commit:
            raise ValueError("Git archive 的 commit 與指定來源不一致")
        capability = json.loads(text_member(archive, "vault/capabilities/capability-manifest.json"))
        private = set(capability.get("resourcePolicy", {}).get("localPrivate", {}))
        records, data_by_path, excluded, adapter_files = [], {}, [], []
        for item in archive.getmembers():
            name = safe_name(item.name)
            if item.isdir():
                continue
            if not item.isfile():
                raise ValueError("封存包含非一般檔案：" + name)
            prefix = "scripts/chatgpt-core/template/"
            if name.startswith(prefix):
                relative = safe_name(name[len(prefix):])
                data = archive.extractfile(item).read()
                installed = ROOT / relative
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
            if name in data_by_path or item.size > 8 * 1024 * 1024:
                raise ValueError("檔案重複或超出匯入限制：" + name)
            data = archive.extractfile(item).read()
            if re.search(rb"-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----", data):
                raise ValueError("來源含私人憑證：" + name)
            data_by_path[name] = data
            records.append({"path": name, "bytes": len(data), "sha256": sha(data)})
    if not REQUIRED.issubset(data_by_path):
        raise ValueError("快照缺少必要母體內容")
    missing = sorted({p for c in capability["capabilities"] for group in c.get("load", {}).values()
                      for p in group if p not in data_by_path and p not in private})
    if missing:
        raise ValueError("路由依賴未納入快照：" + ", ".join(missing))
    # 只替換可核對的既有來源；意外改動留給維護者處理。
    manifest_path = REF / "snapshot.json"
    if CORE.exists() and any(CORE.iterdir()):
        previous = json.loads(manifest_path.read_text(encoding="utf-8"))
        expected = {item["path"]: item for item in previous["files"]}
        actual = {p.relative_to(CORE).as_posix(): p for p in CORE.rglob("*") if p.is_file()}
        if set(expected) != set(actual) or any(p.is_symlink() for p in CORE.rglob("*")):
            raise ValueError("既有快照含未登錄檔案或連結")
        for name, item in expected.items():
            if sha(actual[name].read_bytes()) != item["sha256"]:
                raise ValueError("既有快照有未保存修改：" + name)
        shutil.rmtree(CORE)
    CORE.mkdir(parents=True, exist_ok=True)
    for name, data in data_by_path.items():
        target = CORE / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
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
            links.append("[" + cell(p) + "](core/" + p + ")" if p in data_by_path else cell(p) + "（外部資料）")
        rows.append("| " + cell(c["id"]) + " | " + cell("、".join(triggers[:7])) + " | " + "、".join(links) + " |")
    (REF / "capabilities.md").write_text("\n".join(rows) + "\n", encoding="utf-8")
    rows = ["# 原始 Workflow 索引", "", "依主 Skill 將流程步驟當成指令使用；工具及服務需實際可用。", "",
            "| 流程 | 說明 |", "| --- | --- |"]
    for p in workflows:
        text = data_by_path[p].decode("utf-8-sig")
        match = re.search(r"^description:\s*(.+)$", text, re.M)
        desc = match.group(1).strip() if match else "依名稱與任務範圍選取原文。"
        rows.append("| [" + Path(p).stem + "](core/" + p + ") | " + cell(desc[:180]) + " |")
    (REF / "workflows.md").write_text("\n".join(rows) + "\n", encoding="utf-8")
    version = ["# PixiuCore 版本紀錄", "", "母體 commit：" + commit,
               "來源：https://github.com/pop15106/pixiu-core/commit/" + commit,
               "能力：" + str(manifest["capabilityCount"]), "技能規格：" + str(len(skills)),
               "Workflow：" + str(len(workflows)), "", "這是固定版本快照。原始規格及流程按需載入。",
               "snapshot.json 的完整檔案清單由程式驗證，不需要全文送入對話。"]
    for name in ("critical-relay", "critical-relay-lifecycle"):
        body = data_by_path["skills/" + name + "/SKILL.md"].decode("utf-8-sig")
        match = re.search(r"^version:\s*(.+)$", body, re.M)
        version.append(name + "：" + (match.group(1).strip() if match else "未標示"))
    (REF / "version.md").write_text("\n".join(version) + "\n", encoding="utf-8")
    manifest["generatedFiles"] = []
    for name in ("capabilities.md", "workflows.md", "version.md"):
        data = (REF / name).read_bytes()
        manifest["generatedFiles"].append({"path": "references/" + name,
                                           "bytes": len(data), "sha256": sha(data)})
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {k: manifest[k] for k in ("sourceCommit", "capabilityCount", "skillCount", "workflowCount")}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", required=True)
    parser.add_argument("--commit", required=True)
    args = parser.parse_args()
    print(json.dumps(import_snapshot(args.archive, args.commit), ensure_ascii=False))
