import os
import re
import json
import time
import unicodedata
from urllib.parse import urljoin, urlparse, unquote

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.faainc.com"
TEAM_URL = f"{BASE_URL}/team"

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; TeamScraper/1.0)"}
session = requests.Session()
session.headers.update(HEADERS)

RASTER_EXTS = (".jpg", ".jpeg", ".png", ".webp")


def clean(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def safe_filename(name: str) -> str:
    name = unicodedata.normalize("NFKD", clean(name))
    name = re.sub(r'[<>:"/\\|?*\x00-\x1F]', "", name)
    return name.strip().rstrip(".")


def is_raster_url(u: str) -> bool:
    path = urlparse(u).path.lower()
    return path.endswith(RASTER_EXTS)


def pick_ext(u: str) -> str:
    ext = os.path.splitext(urlparse(u).path)[1].lower()
    return ext if ext in RASTER_EXTS else ".jpg"


def parse_srcset(srcset: str):
    # "url 500w, url 800w" -> [url, url]
    out = []
    for part in (srcset or "").split(","):
        part = part.strip()
        if not part:
            continue
        url = part.split(" ")[0].strip()
        if url:
            out.append(url)
    return out


def get_profile_links():
    r = session.get(TEAM_URL, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    links = set()
    for a in soup.select('a[href^="/team/"]'):
        href = a.get("href")
        if href and href != "/team":
            links.add(urljoin(BASE_URL, href))
    return sorted(links)


def best_headshot_from_profile_html(html: str, profile_url: str):
    soup = BeautifulSoup(html, "html.parser")

    # Name: first heading
    h = soup.find(["h1", "h2", "h3"])
    name = clean(h.get_text(" ", strip=True)) if h else ""
    slug = urlparse(profile_url).path.rsplit("/", 1)[-1].lower()

    candidates = []

    # 1) BEST: anchor links that already point to the image (right-click "open in new tab")
    for a in soup.find_all("a", href=True):
        href = urljoin(profile_url, a["href"])
        if is_raster_url(href):
            candidates.append(href)

    # 2) Also collect from <img> attrs (fallback)
    for img in soup.find_all("img"):
        for key in ("src", "data-src"):
            val = img.get(key)
            if val:
                u = urljoin(profile_url, val)
                if is_raster_url(u):
                    candidates.append(u)

        for key in ("srcset", "data-srcset"):
            val = img.get(key)
            if val:
                for u in parse_srcset(val):
                    u = urljoin(profile_url, u)
                    if is_raster_url(u):
                        candidates.append(u)

    # de-dupe
    candidates = list(dict.fromkeys(candidates))

    if not candidates:
        return None

    # scoring: prefer "headshot" + matching slug/name, avoid random images
    def score(u: str) -> int:
        u_dec = unquote(u).lower()
        s = 0
        if "headshot" in u_dec:
            s += 50
        if slug and slug.replace("-", " ") in u_dec:
            s += 25
        if slug and slug in u_dec:
            s += 25
        if name and clean(name).lower().replace(" ", "-") in u_dec:
            s += 15
        if "cdn.prod.website-files.com" in u_dec:
            s += 10
        # slightly prefer longer filenames (often the real asset vs tiny)
        s += min(len(u_dec), 200) // 20
        return s

    best = max(candidates, key=score)
    return {"name": name, "image_url": best, "profile_url": profile_url}


def download_images(records, out_dir="images"):
    os.makedirs(out_dir, exist_ok=True)

    for rec in records:
        url = rec["image_url"]
        ext = pick_ext(url)
        out_path = os.path.join(out_dir, safe_filename(rec["name"]) + ext)

        if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
            continue

        resp = session.get(url, timeout=45)
        resp.raise_for_status()
        with open(out_path, "wb") as f:
            f.write(resp.content)

        time.sleep(0.15)


if __name__ == "__main__":
    profiles = get_profile_links()
    print(f"Found {len(profiles)} profile pages")

    people = []
    for url in profiles:
        r = session.get(url, timeout=30)
        r.raise_for_status()

        rec = best_headshot_from_profile_html(r.text, url)
        if rec and rec["name"] and rec["image_url"]:
            people.append(rec)
            print(f"✓ {rec['name']} -> {rec['image_url']}")
        else:
            print(f"✗ Failed: {url}")

    # manifest for your Teams tab app
    with open("people.json", "w", encoding="utf-8") as f:
        json.dump(
            {
                "people": [p["name"] for p in people],
                "records": people
            },
            f,
            ensure_ascii=False,
            indent=2
        )

    download_images(people, out_dir="images")
    print(f"Done. Saved {len(people)} records. Downloaded images to ./images")
