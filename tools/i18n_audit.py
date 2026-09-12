import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX_HTML = ROOT / "index.html"
TRANSLATIONS_JSON = ROOT / "translations.json"


def extract_en_keys_from_index_html(text: str) -> set[str]:
    m = re.search(r"\ben\s*:\s*\{", text)
    if not m:
        return set()
    brace_start = m.end() - 1

    depth = 0
    end = None
    in_str = None
    escape = False
    for i in range(brace_start, len(text)):
        ch = text[i]
        if in_str:
            if escape:
                escape = False
                continue
            if ch == "\\":
                escape = True
                continue
            if ch == in_str:
                in_str = None
                continue
            continue

        if ch in ("'", '"', "`"):
            in_str = ch
            continue
        if ch == "{":
            depth += 1
            continue
        if ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break

    if end is None:
        return set()

    block = text[brace_start:end]
    stripped = []
    in_str = None
    escape = False
    for ch in block:
        if in_str:
            if escape:
                escape = False
                stripped.append(" ")
                continue
            if ch == "\\":
                escape = True
                stripped.append(" ")
                continue
            if ch == in_str:
                in_str = None
                stripped.append(" ")
                continue
            stripped.append(" ")
            continue
        if ch in ("'", '"', "`"):
            in_str = ch
            stripped.append(" ")
            continue
        stripped.append(ch)

    safe = "".join(stripped)
    keys = set(re.findall(r"\b([A-Za-z_][A-Za-z0-9_]*)\s*:", safe))
    return keys


def extract_used_keys_from_index_html(text: str) -> set[str]:
    used = set()
    for attr in (
        "data-i18n",
        "data-i18n-html",
        "data-i18n-placeholder",
        "data-i18n-aria",
        "data-i18n-title",
        "data-i18n-alt",
    ):
        used.update(re.findall(rf"""{re.escape(attr)}=["']([A-Za-z_][A-Za-z0-9_]*)["']""", text))

    used.update(re.findall(r"""\btr\(\s*["']([A-Za-z_][A-Za-z0-9_]*)["']""", text))
    used.update(re.findall(r"""\bsetStatusKey\(\s*["']([A-Za-z_][A-Za-z0-9_]*)["']""", text))
    used.update(re.findall(r"""\bt\(\s*["']([A-Za-z_][A-Za-z0-9_]*)["']""", text))
    return used


def main() -> int:
    strict = "--strict" in sys.argv
    index_text = INDEX_HTML.read_text("utf-8")
    en_keys = extract_en_keys_from_index_html(index_text)
    if not en_keys:
        print("ERROR: Could not extract EN keys from index.html")
        return 2
    used_keys = extract_used_keys_from_index_html(index_text)

    data = json.loads(TRANSLATIONS_JSON.read_text("utf-8"))
    langs = sorted([k for k, v in data.items() if isinstance(v, dict)])

    missing = {}
    extra = {}
    empty = []
    unused = sorted(en_keys - used_keys)
    unknown_used = sorted(used_keys - en_keys)

    allowed_placeholders = {"missing", "done", "total", "value", "w", "h", "usdz", "glb", "size", "message", "max"}
    bad_placeholders = []

    for lang in langs:
        d = data[lang]
        keys = set(d.keys())
        m = sorted(en_keys - keys)
        e = sorted(keys - en_keys)
        if m:
            missing[lang] = m
        if e:
            extra[lang] = e

        for k, v in d.items():
            if isinstance(v, str) and not v.strip():
                empty.append(f"{lang}/{k}")
            if isinstance(v, str):
                for ph in re.findall(r"\{([a-zA-Z0-9_]+)\}", v):
                    if ph not in allowed_placeholders:
                        bad_placeholders.append(f"{lang}/{k}:{{{ph}}}")

    print("Languages:", len(langs))
    print("EN keys:", len(en_keys))
    print("Used keys (static scan):", len(used_keys))
    print("Langs with missing keys:", len(missing))
    print("Langs with extra keys:", len(extra))
    print("Empty strings:", len(empty))
    print("Unknown placeholders:", len(bad_placeholders))
    print("Potentially unused EN keys:", len(unused))
    print("Used but not defined in EN:", len(unknown_used))

    if missing:
        lang = sorted(missing.keys())[0]
        print("First missing:", lang, missing[lang][:12])
    if extra:
        lang = sorted(extra.keys())[0]
        print("First extra:", lang, extra[lang][:12])
    if empty:
        print("First empty:", empty[0])
    if bad_placeholders:
        print("First bad placeholder:", bad_placeholders[0])
    if unused:
        print("First unused:", unused[:12])
    if unknown_used:
        print("First unknown used:", unknown_used[:12])

    ok = (not empty) and (not bad_placeholders)
    if strict:
        ok = ok and (not missing) and (not extra)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
