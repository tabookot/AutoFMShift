#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""extract.py — куски кода для вставки в чат. Python 3.8+, stdlib.

  python tools/extract.py FILE NAME|START-END [...]   функция/константа по имени или строки
  python tools/extract.py --outline FILE               список функций и констант
  python tools/extract.py --grep REGEX FILE [FILE...]  поиск (файл:строка: текст)

Вывод всегда UTF-8 (и в консоли Win7, и при `> chunk.txt`).
"""
import io
import re
import sys

_REGEX_PREV = set("(,=:[!&|?{};+-*%<>~^")
_REGEX_KW = ("return", "typeof", "case", "in", "of", "else", "do", "delete", "void", "throw", "new")


def _skip_str(src, i, q):
    n = len(src)
    i += 1
    while i < n:
        c = src[i]
        if c == "\\":
            i += 2
            continue
        if c == q or c == "\n":
            return i + 1
        i += 1
    return n


def _skip_expr(src, i):
    depth, n = 1, len(src)
    while i < n and depth:
        c = src[i]
        if c in "'\"":
            i = _skip_str(src, i, c)
            continue
        if c == "`":
            i = _skip_tpl(src, i)
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
        i += 1
    return i


def _skip_tpl(src, i):
    n = len(src)
    i += 1
    while i < n:
        c = src[i]
        if c == "\\":
            i += 2
            continue
        if c == "`":
            return i + 1
        if c == "$" and src[i + 1:i + 2] == "{":
            i = _skip_expr(src, i + 2)
            continue
        i += 1
    return n


def _skip_regex(src, i):
    """src[i] == '/'. Возвращает индекс после литерала, либо i+1 если это не regex."""
    n = len(src)
    j = i + 1
    in_cls = False
    while j < n:
        c = src[j]
        if c == "\n":
            return i + 1
        if c == "\\":
            j += 2
            continue
        if in_cls:
            if c == "]":
                in_cls = False
        elif c == "[":
            in_cls = True
        elif c == "/":
            j += 1
            while j < n and src[j].isalpha():
                j += 1
            return j
        j += 1
    return i + 1


def _kw_before(src, i):
    m = re.search(r"([A-Za-z_$][\w$]*)\s*$", src[max(0, i - 12):i])
    return bool(m and m.group(1) in _REGEX_KW)


_NEXT_STMT = re.compile(r"^\s*(?:const|let|var|function|async\s+function|class|if|for|while|return|//)\b|^\s*//")


def _end_of(src, start, kind, limit=80000):
    """kind: 'function' — до закрывающей } тела; 'stmt' — до ; на нулевой глубине."""
    n = len(src)
    i = start
    depth = 0
    prev = ""
    while i < n and i - start < limit:
        c = src[i]
        nx = src[i + 1] if i + 1 < n else ""
        if c == "/" and nx == "/":
            j = src.find("\n", i)
            i = n if j < 0 else j
            continue
        if c == "/" and nx == "*":
            j = src.find("*/", i + 2)
            i = n if j < 0 else j + 2
            continue
        if c in "'\"":
            i = _skip_str(src, i, c)
            prev = c
            continue
        if c == "`":
            i = _skip_tpl(src, i)
            prev = c
            continue
        if c == "/" and (prev == "" or prev in _REGEX_PREV or _kw_before(src, i)):
            j = _skip_regex(src, i)
            if j > i + 1:
                i = j
                prev = "x"
                continue
        if c in "([{":
            depth += 1
        elif c in ")]}":
            depth -= 1
            if depth < 0:
                return i
            if depth == 0 and c == "}" and kind == "function":
                return i + 1
        elif c == ";" and depth == 0 and kind == "stmt":
            return i + 1
        elif c == "\n" and depth == 0 and kind == "stmt" and prev not in "=+-*/,(&|?:" and prev:
            eol = src.find("\n", i + 1)
            nxt = src[i + 1:(n if eol < 0 else eol)]
            if _NEXT_STMT.match(nxt):
                return i
        if not c.isspace():
            prev = c
        i += 1
    return min(i, n)


def _find(src, name):
    nm = re.escape(name)
    m = re.search(r"^[ \t]*(?:async[ \t]+)?function[ \t]+%s\b" % nm, src, re.M)
    if m:
        return m.start(), "function"
    m = re.search(r"^[ \t]*(?:const|let|var)[ \t]+%s\b" % nm, src, re.M)
    if m:
        return m.start(), "stmt"
    # let a, b, c;  — имя не первое в списке
    for m in re.finditer(r"^[ \t]*(?:const|let|var)[ \t]+[^\n;]*", src, re.M):
        if re.search(r"(?<![\w$])%s(?![\w$])" % nm, m.group(0)):
            return m.start(), "stmt"
    return -1, ""


def _lineno(src, pos):
    return src.count("\n", 0, pos) + 1


def _read(path):
    with io.open(path, "r", encoding="utf-8-sig") as f:
        return f.read()


def cmd_extract(path, queries):
    src = _read(path)
    lines = src.split("\n")
    for q in queries:
        m = re.match(r"^(\d+)-(\d+)$", q)
        if m:
            s, e = int(m.group(1)), int(m.group(2))
            print("// ---- %s:%d-%d" % (path, s, e))
            print("\n".join(lines[s - 1:e]))
            continue
        head = 0
        mh = re.match(r"^(.+)\+(\d+)$", q)
        if mh:
            q, head = mh.group(1), int(mh.group(2))
        pos, kind = _find(src, q)
        if pos < 0:
            print("// ---- НЕ НАЙДЕНО: %s :: %s" % (path, q))
            continue
        end = _end_of(src, pos, kind)
        text = src[pos:end]
        if head:
            text = "\n".join(text.split("\n")[:head])
        print("// ---- %s :: %s (строки %d-%d)" % (path, q, _lineno(src, pos), _lineno(src, end)))
        print(text.rstrip("\n"))


def cmd_outline(path):
    src = _read(path)
    for i, ln in enumerate(src.split("\n"), 1):
        m = re.match(r"^ {0,2}(?:async[ \t]+)?function[ \t]+([\w$]+)", ln)
        if m:
            print("fn %s:%d" % (m.group(1), i))
            continue
        m = re.match(r"^ {0,2}(?:const|let|var)[ \t]+([\w$]+)", ln)
        if m:
            print("var %s:%d" % (m.group(1), i))


def cmd_grep(rx, paths):
    r = re.compile(rx)
    for p in paths:
        for i, ln in enumerate(_read(p).split("\n"), 1):
            if r.search(ln):
                print("%s:%d: %s" % (p, i, ln.strip()[:500]))


def main():
    a = sys.argv[1:]
    if len(a) < 2:
        sys.exit(__doc__)
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", newline="\n")
    except Exception:
        pass
    if a[0] == "--grep":
        cmd_grep(a[1], a[2:])
    elif a[0] == "--outline":
        cmd_outline(a[1])
    else:
        cmd_extract(a[0], a[1:])
    sys.stdout.flush()


if __name__ == "__main__":
    main()
