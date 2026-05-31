#!/usr/bin/env python3
"""
Regenerate sitemap.xml for kneeage.com from the files in the repo.

Why this exists: the site is hand-built static HTML with no build step, so the
sitemap does NOT update itself. Run this after adding/removing a page and the
sitemap is rebuilt deterministically — no page can be silently left out.

Rules (LOCKED):
  - Canonical host is ALWAYS https://www.kneeage.com (with www). Never apex,
    never ortholongevity.ai.
  - Article pages use clean URLs (/articles/<slug>, no .html) to match
    vercel.json rewrites.
  - Pages disallowed in robots.txt (confirmed) are excluded.

Usage:  python3 scripts/gen_sitemap.py
"""

import datetime
import pathlib

REPO = pathlib.Path(__file__).resolve().parent.parent
HOST = "https://www.kneeage.com"

# Top-level pages we want indexed. (path-on-site, priority, changefreq)
# Excludes confirmed.html (disallowed in robots.txt) and the quiz thank-you flow.
ROOT_PAGES = [
    ("/", "1.0", "weekly"),
    ("/kneeagequiz.html", "0.9", "monthly"),
]

# Article files we never want in the sitemap (drafts, etc.) — by filename.
ARTICLE_EXCLUDE = set()


def lastmod(path: pathlib.Path) -> str:
    ts = path.stat().st_mtime
    return datetime.date.fromtimestamp(ts).isoformat()


def url_block(loc: str, mod: str, freq: str, priority: str) -> str:
    return (
        "  <url>\n"
        f"    <loc>{loc}</loc>\n"
        f"    <lastmod>{mod}</lastmod>\n"
        f"    <changefreq>{freq}</changefreq>\n"
        f"    <priority>{priority}</priority>\n"
        "  </url>"
    )


def main() -> None:
    blocks = []

    # Root pages
    for site_path, priority, freq in ROOT_PAGES:
        file_name = "index.html" if site_path == "/" else site_path.lstrip("/")
        f = REPO / file_name
        mod = lastmod(f) if f.exists() else datetime.date.today().isoformat()
        blocks.append(url_block(f"{HOST}{site_path}", mod, freq, priority))

    # Article pages -> clean URLs, sorted for stable output
    articles_dir = REPO / "articles"
    for f in sorted(articles_dir.glob("*.html")):
        if f.name in ARTICLE_EXCLUDE:
            continue
        slug = f.stem  # strips .html
        loc = f"{HOST}/articles/{slug}"
        blocks.append(url_block(loc, lastmod(f), "monthly", "0.8"))

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(blocks)
        + "\n</urlset>\n"
    )

    out = REPO / "sitemap.xml"
    out.write_text(xml, encoding="utf-8")
    print(f"Wrote {out} with {len(blocks)} URLs:")
    for b in blocks:
        loc = b.split("<loc>")[1].split("</loc>")[0]
        print(f"  - {loc}")


if __name__ == "__main__":
    main()
