#!/usr/bin/env python3
"""Produce a fully offline copy of index.html with Google Fonts embedded as
base64 woff2 data: URIs, for bundling inside the Android APK asset."""
import base64, re, sys, urllib.request, pathlib

SRC = pathlib.Path(__file__).resolve().parent.parent / "index.html"
OUT = pathlib.Path(__file__).resolve().parent.parent / "android" / "assets" / "index.html"

CSS_URL = ("https://fonts.googleapis.com/css2?"
           "family=Fredoka:wght@500;600;700&family=Baloo+2:wght@700;800&display=swap")
# A modern-browser UA makes Google Fonts serve woff2 (smallest, universally supported in WebView).
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")


def fetch(url, ua=None):
    req = urllib.request.Request(url, headers={"User-Agent": ua} if ua else {})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def main():
    css = fetch(CSS_URL, UA).decode("utf-8")
    # Replace every remote woff2 url(...) with an embedded data: URI.
    urls = re.findall(r"url\((https://[^)]+\.woff2)\)", css)
    uniq = sorted(set(urls))
    print(f"Embedding {len(uniq)} woff2 files...")
    for u in uniq:
        data = fetch(u)
        b64 = base64.b64encode(data).decode("ascii")
        css = css.replace(u, f"data:font/woff2;base64,{b64}")
        print(f"  {u.split('/')[-1]}  {len(data)//1024} KB")

    html = SRC.read_text(encoding="utf-8")
    # Remove the three remote font <link> tags (preconnect x2 + stylesheet).
    html = re.sub(r'\s*<link rel="preconnect"[^>]*>', "", html)
    html = re.sub(r'\s*<link href="https://fonts\.googleapis\.com[^>]*>', "", html)
    # Inject the fully-inlined font CSS just before our own <style>.
    inline = "<style>\n/* embedded fonts (offline) */\n" + css + "\n</style>"
    html = html.replace("<style>", inline + "\n<style>", 1)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    kb = len(html.encode("utf-8")) // 1024
    print(f"Wrote {OUT}  ({kb} KB)")
    if "fonts.googleapis.com" in html or "fonts.gstatic.com" in html:
        print("WARNING: remote font references still present!", file=sys.stderr)
        sys.exit(1)
    print("OK: no remote font references remain.")


if __name__ == "__main__":
    main()
