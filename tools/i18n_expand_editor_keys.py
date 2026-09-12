#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX_HTML = ROOT / "index.html"
TRANSLATIONS_JSON = ROOT / "translations.json"


def extract_en_map_from_index_html(text: str) -> dict[str, str]:
    anchor = "en:"
    start = text.find(anchor)
    if start < 0:
        raise ValueError("Could not find 'en:' in index.html")

    brace_start = text.find("{", start)
    if brace_start < 0:
        raise ValueError("Could not find '{' after 'en:'")

    i = brace_start
    depth = 0
    in_single = False
    in_double = False
    escape = False

    while i < len(text):
        ch = text[i]
        if escape:
            escape = False
            i += 1
            continue
        if ch == "\\":
            escape = True
            i += 1
            continue
        if not in_double and ch == "'":
            in_single = not in_single
            i += 1
            continue
        if not in_single and ch == '"':
            in_double = not in_double
            i += 1
            continue
        if in_single or in_double:
            i += 1
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                obj_text = text[brace_start + 1 : i]
                break
        i += 1
    else:
        raise ValueError("Unterminated EN object in index.html")

    out: dict[str, str] = {}
    for m in re.finditer(r"([A-Za-z_][A-Za-z0-9_]*)\s*:\s*'((?:\\'|[^'])*)'", obj_text):
        k = m.group(1)
        v = m.group(2).replace("\\'", "'")
        out[k] = v
    for m in re.finditer(r'([A-Za-z_][A-Za-z0-9_]*)\s*:\s*"((?:\\"|[^"])*)"', obj_text):
        k = m.group(1)
        v = m.group(2).replace('\\"', '"')
        out.setdefault(k, v)

    if not out:
        raise ValueError("Parsed EN map is empty (unexpected format)")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Expand translations.json with editor keys from index.html (EN map).")
    ap.add_argument("--apply", action="store_true", help="Write changes to translations.json (default: dry-run).")
    ap.add_argument("--report", action="store_true", help="Print per-language coverage report.")
    args = ap.parse_args()

    index_text = INDEX_HTML.read_text("utf-8")
    en_map = extract_en_map_from_index_html(index_text)

    data = json.loads(TRANSLATIONS_JSON.read_text("utf-8"))
    if not isinstance(data, dict):
        raise ValueError("translations.json must be a JSON object")

    langs = [k for k, v in data.items() if isinstance(v, dict)]
    changed = False

    report_rows: list[tuple[str, int, int]] = []
    for lang in sorted(langs):
        d = data.get(lang)
        if not isinstance(d, dict):
            continue
        before = len(d)
        for k, v in en_map.items():
            d.setdefault(k, v)
        after = len(d)
        if after != before:
            changed = True
        missing = sum(1 for k in en_map.keys() if k not in d)
        report_rows.append((lang, after, missing))

    if args.report:
        print("EN keys:", len(en_map))
        for lang, total, missing in report_rows:
            print(f"{lang:>3}  total:{total:>4}  missing:{missing:>3}")

    if not args.apply:
        print("Dry-run only. Re-run with --apply to write changes.")
        return 0

    if not changed:
        print("No changes needed.")
        return 0

    TRANSLATIONS_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2, sort_keys=False) + "\n", "utf-8")
    print("Updated translations.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

