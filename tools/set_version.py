#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""python tools/set_version.py X.Y.Z -- version in core.js, ?v= stamps, SC_BUILD."""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = ["index.html", "data/sandbox.html", "scorch/index.html"]
TAG_RE = re.compile(r"""<(script|link)\b(?:"[^"]*"|'[^']*'|[^>"'])*>""", re.I)
ATTR_RE = re.compile(r"""(\b(?:src|href)\s*=\s*)(["'])(.*?)\2""", re.I | re.S)
REL_RE = re.compile(r"""\brel\s*=\s*(["'])(.*?)\1""", re.I)
LINK_RELS = set(["stylesheet", "icon", "apple-touch-icon"])


def read(rel):
    with io.open(os.path.join(ROOT, rel), "r", encoding="utf-8", newline="") as f:
        return f.read()


def write(rel, text):
    with io.open(os.path.join(ROOT, rel), "w", encoding="utf-8", newline="") as f:
        f.write(text)


def is_local(u):
    u = u.strip()
    return u != "" and not re.match(r"^(?:[a-z][a-z0-9+.-]*:|//|#)", u, re.I)


def stamp(u, ver):
    frag = ""
    if "#" in u:
        u, frag = u.split("#", 1)
        frag = "#" + frag
    base, _, q = u.partition("?")
    params = [x for x in q.split("&") if x and not x.startswith("v=")]
    params.append("v=" + ver)
    return base + "?" + "&".join(params) + frag


def stamp_html(text, ver, log, name):
    def sub(m):
        tag = m.group(0)
        kind = m.group(1).lower()
        if kind == "link":
            r = REL_RE.search(tag)
            if not r or not (set(r.group(2).lower().split()) & LINK_RELS):
                return tag
        a = ATTR_RE.search(tag)
        if not a:
            return tag
        want = "src" if kind == "script" else "href"
        if not a.group(1).lower().lstrip().startswith(want):
            return tag
        old = a.group(3)
        if not is_local(old):
            return tag
        new = stamp(old, ver)
        if new == old:
            return tag
        log.append("%s: %s -> %s" % (name, old, new))
        return tag[:a.start(3)] + new + tag[a.end(3):]
    return TAG_RE.sub(sub, text)


def main():
    if len(sys.argv) != 2 or not re.match(r"^\d+\.\d+\.\d+$", sys.argv[1]):
        print("usage: python tools/set_version.py X.Y.Z")
        return 2
    ver = sys.argv[1]
    log = []
    out = {}
    try:
        for rel, pat in (("core.js", r"(const VERSION = ')[^']*(')"),
                         ("scorch/scorch.js", r"(const SC_BUILD = ')[^']*(')")):
            text = read(rel)
            new, n = re.subn(pat, r"\g<1>" + ver + r"\g<2>", text)
            if n != 1:
                print("ERROR: %s: pattern found %d times (need 1)" % (rel, n))
                return 1
            if new != text:
                log.append("%s: version -> %s" % (rel, ver))
                out[rel] = new
        for rel in HTML:
            if not os.path.exists(os.path.join(ROOT, rel)):
                print("warn: no file " + rel)
                continue
            text = read(rel)
            new = stamp_html(text, ver, log, rel)
            if new != text:
                out[rel] = new
    except IOError as e:
        print("ERROR: %s" % e)
        return 1
    for rel in out:
        write(rel, out[rel])
    print("\n".join(log) if log else "no changes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
