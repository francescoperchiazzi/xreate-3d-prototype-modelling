#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX_HTML = ROOT / "index.html"


RE_FUNC = re.compile(r"^(\s*)(async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{")
RE_VAR_ARROW = re.compile(r"^(\s*)(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(async\s*)?\(([^)]*)\)\s*=>\s*\{")
RE_VAR_FUNC = re.compile(r"^(\s*)(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(async\s*)?function\s*\(([^)]*)\)\s*\{")


def humanize_name(name: str) -> str:
    s = re.sub(r"[_\-]+", " ", name).strip()
    s = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", s)
    s = s.lower()
    return s


def build_jsdoc(indent: str, name: str, params: str) -> list[str]:
    words = humanize_name(name)
    summary = f"{name}: {words}."
    p = [x.strip() for x in params.split(",")] if params.strip() else []
    pnames: list[str] = []
    for raw in p:
        if not raw:
            continue
        token = raw.split("=")[0].strip()
        token = token.split(":")[0].strip()
        token = token.replace("{", "").replace("}", "").strip()
        token = token.replace("[", "").replace("]", "").strip()
        if token.startswith("..."):
            token = token[3:].strip()
        if not token:
            continue
        pnames.append(token)

    lines: list[str] = []
    lines.append(f"{indent}/** ")
    lines.append(f"{indent} * {summary}")
    for pn in pnames:
        lines.append(f"{indent} * @param {{*}} {pn}")
    lines.append(f"{indent} */")
    return lines


def has_jsdoc_above(lines: list[str], i: int) -> bool:
    j = i - 1
    while j >= 0 and lines[j].strip() == "":
        j -= 1
    if j < 0:
        return False
    # If we're directly under an existing comment block, walk up to detect a JSDoc opener.
    k = j
    steps = 0
    while k >= 0 and steps < 40:
        s = lines[k].lstrip()
        if s.startswith("/**"):
            return True
        if s.startswith("*/"):
            k -= 1
            steps += 1
            continue
        if s.startswith("*") or s.startswith("/*"):
            k -= 1
            steps += 1
            continue
        break
    return False


def main() -> int:
    ap = argparse.ArgumentParser(description="Insert minimal JSDoc blocks above function declarations in index.html.")
    ap.add_argument("--start", type=int, default=1, help="1-based start line (inclusive).")
    ap.add_argument("--end", type=int, default=10**9, help="1-based end line (inclusive).")
    ap.add_argument("--apply", action="store_true", help="Write changes (default: dry-run).")
    args = ap.parse_args()

    raw = INDEX_HTML.read_text("utf-8").splitlines(True)
    out: list[str] = []
    inserted = 0

    for idx, line in enumerate(raw, start=1):
        if args.start <= idx <= args.end:
            m = RE_FUNC.match(line) or RE_VAR_ARROW.match(line) or RE_VAR_FUNC.match(line)
            if m:
                if RE_FUNC.match(line):
                    indent, _, name, params = m.group(1), m.group(2), m.group(3), m.group(4)
                else:
                    indent, name, _, params = m.group(1), m.group(2), m.group(3), m.group(4)
                if not has_jsdoc_above(out, len(out)):
                    jsdoc_lines = build_jsdoc(indent, name, params)
                    out.extend([l + "\n" for l in jsdoc_lines])
                    inserted += 1
        out.append(line)

    if not args.apply:
        print(f"Dry-run: would insert {inserted} JSDoc blocks.")
        return 0

    if inserted:
        INDEX_HTML.write_text("".join(out), "utf-8")
        print(f"Updated index.html: inserted {inserted} JSDoc blocks.")
    else:
        print("No changes needed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
