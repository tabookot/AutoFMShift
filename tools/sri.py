#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""sri.py - sha384 для CDN-скриптов index.html. Python 3.8, stdlib.
  python tools/sri.py           показать хеши
  python tools/sri.py --apply   вписать integrity в index.html (нужна сеть)
"""
import base64
import hashlib
import io
import os
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TAG = re.compile(r'<script src="(https://[^"]+)"(?: integrity="[^"]*")?( crossorigin="anonymous")></script>')


def sri(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    data = urllib.request.urlopen(req, timeout=30).read()
    return "sha384-" + base64.b64encode(hashlib.sha384(data).digest()).decode("ascii")


def main():
    apply = "--apply" in sys.argv[1:]
    path = os.path.join(ROOT, "index.html")
    with io.open(path, "r", encoding="utf-8-sig", newline="") as f:
        html = f.read()
    urls = [m.group(1) for m in TAG.finditer(html)]
    if not urls:
        sys.exit("CDN-скрипты не найдены в index.html")
    hashes = {}
    for u in urls:
        try:
            hashes[u] = sri(u)
        except Exception as e:
            sys.exit("Не удалось скачать %s: %s\nПосчитай хеш на srihash.org и вставь руками." % (u, e))
        print(hashes[u], u)
    new = TAG.sub(lambda m: '<script src="%s" integrity="%s"%s></script>'
                  % (m.group(1), hashes[m.group(1)], m.group(2)), html)
    if not apply:
        print("(без --apply: файл не изменён)")
    elif new == html:
        print("index.html уже актуален")
    else:
        with io.open(path, "w", encoding="utf-8", newline="") as f:
            f.write(new)
        print("index.html обновлён")


if __name__ == "__main__":
    main()
