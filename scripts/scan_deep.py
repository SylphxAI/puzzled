#!/usr/bin/env python3
"""Deep-scan live teaching of banned house slang.

Scope (verification plan): binding docs + operator/CLI/public serializers +
Connect/operator-facing comments + ADR bodies that still teach a name as live.
Exclude: node_modules, target, docs/evidence, archive, hygiene scripts,
retire-named ADR files, and retire-only / forbid-the-name lines.

This scan must fail on:
  platform .../04_product_project_deploy.rs  "ADR dens freeze" / "dens≠promote"
  spiron .../agent-event-live.ts             "product densify"
  luzzy .../plan-player-authority.ts         "Polaris hard-cut"
  luzzy .../ADR-polaris-operating-model-hard-cut.md  "The running system is Polariss"
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

SKIP_DIR_NAMES = {
    "node_modules",
    "target",
    ".git",
    "dist",
    "build",
    ".next",
    "vendor",
    "externals",
    "__pycache__",
    ".venv",
}
ALLOW_NAMES = {
    "check-language-hygiene.sh",
    "language-hygiene-vocabulary.md",
    "language-jargon-inventory.md",
    "scan_living_speech.py",
    "scan_deep.py",
    "rewrite_living.py",
    "scrub-dens-jargon.py",
}

DENS_RE = re.compile(
    r"(?i)(?<![A-Za-z0-9_])(dens|densed|undensed|not_densed|densify)(?![A-Za-z0-9_])"
)
POLAR_RE = re.compile(r"(?i)(?<![A-Za-z0-9_])(polariss|polaris|polar)(?![A-Za-z0-9_])")
HOUSE_RE = re.compile(
    r"(?i)(?<![A-Za-z0-9_])(vav|qrr|werh|wmccu|gwc|tku|nbc|vccr|vcy|uhda|nite|drc|dfc|pqlc)(?![A-Za-z0-9_])"
    r"|(?<![A-Za-z0-9_])bcp(?![A-Za-z0-9_]|\s*47)"
)
IC_PHRASE_RE = re.compile(r"(?i)infectious[_\s-]*completions|infectiousCompletions")
SMASH_RE = re.compile(r"(?<=[A-Za-z0-9_])`docs/adr/`")

RETIRE_OR_FORBID = re.compile(
    r"(?i)("
    r"retired|retire-|do not (restore|invent|use|teach|emit|treat)"
    r"|predecessor|historical|superseded|filename is historical"
    r"|house brand|house acronym|house[- ]score|coined"
    r"|demoted|was wrong|amends"
    r"|assert!\(\s*!"
    r"|!\s*\w*\.contains\("
    r"|must not (contain|emit|teach)"
    r"|does not emit|banned|forbid"
    r")"
)
IETF_BCP = re.compile(
    r"(?i)(bcp[-\s]*47|ietf|rfc\s*\d+|oauth|best current practice|browser-based apps)"
)

DEEP_SUFFIXES = {".md", ".rs", ".ts", ".tsx", ".js", ".jsx", ".json", ".proto", ".txt", ".toml"}
SPEECH_HINTS = (
    "doctor",
    "cli",
    "operator",
    "status",
    "overview",
    "connect",
)


def is_excluded(rel: Path) -> bool:
    parts = rel.parts
    if any(p in SKIP_DIR_NAMES for p in parts):
        return True
    if "evidence" in parts and "docs" in parts:
        return True
    if "archive" in parts:
        return True
    name = rel.name
    if name in ALLOW_NAMES:
        return True
    if re.search(
        r"(?i)(house-acronym|not-polar|english-public|language-hygiene|language-jargon|retire-|retired)",
        name,
    ):
        return True
    return False


def is_deep_path(root: Path, path: Path) -> bool:
    try:
        rel = path.relative_to(root)
    except ValueError:
        return False
    if is_excluded(rel):
        return False
    name = path.name
    parts = rel.parts
    suffix = path.suffix.lower()
    low = "/".join(parts).lower()
    if name in {"PROJECT.md", "AGENTS.md", "PRODUCT.md", "README.md"}:
        return True
    if name.upper().startswith("NORTH") and suffix == ".md":
        return True
    if (
        "north-star" in {p.lower() for p in parts} or "north_star" in {p.lower() for p in parts}
    ) and suffix in {".md", ".json"}:
        return True
    if suffix == ".proto":
        return True
    if name.endswith((".openapi.json", ".swagger.json")):
        return True
    if "public" in parts and suffix in {".json", ".ts", ".rs"}:
        return True
    if suffix in DEEP_SUFFIXES and any(h in low for h in SPEECH_HINTS):
        return True
    # Living product-authority modules (skeptic: plan-player-authority.ts).
    if suffix in DEEP_SUFFIXES and re.search(
        r"(plan-player-authority|product-authority|player-authority)", low
    ):
        return True
    # Operator-facing management deploy JSON (skeptic: 04_product_project_deploy.rs).
    if suffix == ".rs" and "project_deploy" in name.lower():
        return True
    if suffix == ".rs" and "product" in low and "deploy" in name.lower() and "/imp/" in low:
        return True
    # Operator/CLI freeze errors (skeptic: dual-write + emergency promote/SQL).
    if suffix in DEEP_SUFFIXES and any(
        h in low
        for h in (
            "dual-write",
            "emergency-platform-promote",
            "emergency-platform-promotion",
        )
    ):
        return True
    # Binding ADRs that can still teach a name as live law.
    if "adr" in {p.lower() for p in parts} and suffix == ".md":
        return True
    return False


def classify(line: str) -> list[tuple[str, str]]:
    hits: list[tuple[str, str]] = []
    if SMASH_RE.search(line):
        hits.append(("smash", "docs/adr/"))
    for m in DENS_RE.finditer(line):
        hits.append(("dens", m.group(0)))
    for m in POLAR_RE.finditer(line):
        hits.append(("polar", m.group(0)))
    for m in HOUSE_RE.finditer(line):
        hits.append(("house", m.group(0)))
    for m in IC_PHRASE_RE.finditer(line):
        hits.append(("ic", m.group(0)))
    return hits


CURRENT_TEACH = re.compile(
    r"(?i)("
    r"(running system|the system)\s+\*?\*?is\*?\*?"
    r"|\bis polariss\b"
    r"|product densify"
    r"|ADR dens freeze"
    r")"
)


def is_retire_or_forbid_line(line: str) -> bool:
    if CURRENT_TEACH.search(line):
        return False
    return bool(RETIRE_OR_FORBID.search(line))


def is_impl_identifier_line(line: str) -> bool:
    """Module-path leftovers (*-densify.ts) are identifiers, not taught speech."""
    stripped = line.lstrip()
    if stripped.startswith("import ") and "densify" in line:
        return True
    if re.search(r"from ['\"][^'\"]*densify", line):
        return True
    if re.search(r"(?i)^\s*slug:\s+", line):
        return True
    if "dens-web" in line:
        return True
    if re.search(r"\bgwc\s*=", line):
        return True
    if "crate::polar::" in line or "use crate::polar" in line:
        return True
    # Historical ADR/evidence filenames cited as archaeology, not living names.
    if re.search(
        r"(?i)(`|/|adr[-_])[^\s`]*(polariss?|polar|qrr|nite|wmccu|vav|vccr|vcy|uhda|pqlc)",
        line,
    ) and re.search(r"(?i)(adr|docs/)", line):
        return True
    return False


def scan_tree(root: Path) -> list[tuple[str, int, str, str, str]]:
    rows: list[tuple[str, int, str, str, str]] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIR_NAMES]
        for fn in filenames:
            path = Path(dirpath) / fn
            if not is_deep_path(root, path):
                continue
            try:
                text = path.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            for i, line in enumerate(text.splitlines(), 1):
                for kind, tok in classify(line):
                    if kind != "smash" and is_retire_or_forbid_line(line):
                        continue
                    if kind != "smash" and is_impl_identifier_line(line):
                        continue
                    if kind == "house" and tok.lower() == "bcp" and IETF_BCP.search(line):
                        continue
                    rows.append((str(path), i, kind, tok, line.strip()[:200]))
    return rows


def self_test() -> int:
    """Oracle: leftover current-teaching from the skeptic panel must fail."""
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        deploy = root / "crates" / "api" / "src" / "capabilities" / "product" / "imp"
        connect = root / "src" / "lib" / "connect"
        auth = root / "src" / "server"
        adr = root / "docs" / "adr"
        deploy.mkdir(parents=True)
        connect.mkdir(parents=True)
        auth.mkdir(parents=True)
        adr.mkdir(parents=True)
        (deploy / "04_product_project_deploy.rs").write_text(
            '                "message": "ADR dens freeze: dens≠promote; Pass densUnlock=true",\n',
            encoding="utf-8",
        )
        (connect / "agent-event-live.ts").write_text(
            " * Live StreamEvents product densify — native createClient server-stream.\n",
            encoding="utf-8",
        )
        (auth / "plan-player-authority.ts").write_text(
            " * Plan/Player product authority (Polaris hard-cut).\n",
            encoding="utf-8",
        )
        (adr / "ADR-polaris-operating-model-hard-cut.md").write_text(
            "The running system is Polariss. Predecessor dating concepts are deleted.\n",
            encoding="utf-8",
        )
        dual = root / "packages" / "core" / "src" / "lib" / "deployments"
        promo = root / "scripts"
        sql = root / "packages" / "core" / "src" / "lib" / "pipeline"
        dual.mkdir(parents=True)
        promo.mkdir(parents=True)
        sql.mkdir(parents=True)
        (dual / "dual-write.ts").write_text(
            'super(`ADR dens freeze: environment protection=${params.protection} blocks tip motion`)\n',
            encoding="utf-8",
        )
        (promo / "emergency-platform-promote-live.ts").write_text(
            "`ADR dens freeze: protection=locked blocks emergency-platform-promote (dens≠promote)`\n",
            encoding="utf-8",
        )
        (sql / "emergency-platform-promotion-sql.ts").write_text(
            "'ADR dens freeze: protection=locked blocks emergency-platform-promote (dens≠promote).'\n",
            encoding="utf-8",
        )
        rows = scan_tree(root)
        joined = "\n".join(f"{p}:{tok}" for p, _i, _k, tok, _l in rows)
        missing = [
            name
            for name in (
                "04_product_project_deploy.rs",
                "agent-event-live.ts",
                "plan-player-authority.ts",
                "ADR-polaris-operating-model-hard-cut.md",
                "dual-write.ts",
                "emergency-platform-promote-live.ts",
                "emergency-platform-promotion-sql.ts",
            )
            if name not in joined
        ]
        if missing or not rows:
            print(f"SELFTEST FAIL missing={missing} rows={len(rows)}", file=sys.stderr)
            print(joined, file=sys.stderr)
            return 1
        print(f"OK: scan_deep self-test ({len(rows)} leftover hits required)")
        return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("root", nargs="?", default="")
    ap.add_argument("--name", default="")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()
    if args.self_test:
        return self_test()
    root = Path(args.root)
    if not root.is_dir():
        print(f"MISSING {root}", file=sys.stderr)
        return 2
    rows = scan_tree(root)
    name = args.name or root.name
    print(f"PRODUCT {name} ROOT {root} HITS {len(rows)}")
    for path, i, kind, tok, line in rows:
        print(f"{path}:{i}:{kind}:{tok}:{line}")
    return 1 if rows else 0


if __name__ == "__main__":
    raise SystemExit(main())
