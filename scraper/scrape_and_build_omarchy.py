#!/usr/bin/env python3
import time, pathlib, json, re, hashlib, sys, urllib.parse, argparse
import requests
from bs4 import BeautifulSoup

DEFAULT_ROOT = "https://learn.omacom.io/2/the-omarchy-manual/"

def sha16(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8")).hexdigest()[:16]

def abs_url(href: str, base: str) -> str:
    return urllib.parse.urljoin(base, href)

def normalize_url(u: str) -> str:
    """Collapse // in path, strip query/fragment, remove trailing slash (except root)."""
    if not u:
        return u
    s = urllib.parse.urlsplit(u)
    # collapse multiple slashes in path
    path = re.sub(r"/{2,}", "/", s.path)
    # strip trailing slash unless path is root
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")
    return urllib.parse.urlunsplit((s.scheme, s.netloc, path, "", ""))

def same_manual_path(url: str, root_prefix: str) -> bool:
    u = normalize_url(url)
    r = normalize_url(root_prefix)
    return u == r or u.startswith(r + "/")

def load_html(session: requests.Session, url: str) -> BeautifulSoup:
    r = session.get(url, timeout=25)
    r.raise_for_status()
    html = r.text
    try:
        return BeautifulSoup(html, "lxml")
    except Exception:
        return BeautifulSoup(html, "html.parser")

def html_to_markdown(soup: BeautifulSoup) -> tuple[str, str]:
    h1 = soup.select_one("main h1, article h1, h1, title")
    title = (h1.get_text(" ", strip=True) if h1 else "").strip() or "Untitled"
    root = soup.select_one("main, article") or soup.body or soup

    # Remove navigation/UI elements before processing
    for unwanted in root.select('nav, button, aside, header, footer, [class*="toc"], [class*="arrangement"], [class*="sidebar"], [class*="menu"], [role="navigation"]'):
        unwanted.decompose()

    parts = [f"# {title}\n"]
    processed_elements = set()  # Track to avoid duplicates

    for el in root.find_all(recursive=True):
        # Skip if already processed as part of parent
        if id(el) in processed_elements:
            continue

        name = (el.name or "").lower()
        if name in ("h2", "h3"):
            txt = el.get_text(" ", strip=True)
            if txt:
                parts.append(f"{'#' * (2 if name == 'h2' else 3)} {txt}\n")
                processed_elements.add(id(el))
        elif name == "p":
            txt = el.get_text(" ", strip=True)
            if txt:
                parts.append(txt + "\n")
                processed_elements.add(id(el))
        elif name == "pre":
            parts.append("```\n" + el.get_text() + "\n```\n")
            processed_elements.add(id(el))
        elif name == "li":
            # Only process if it's in content lists, not navigation
            classes = el.get('class') or []
            if not any(cls for cls in classes if any(nav in cls for nav in ['toc', 'arrangement', 'nav', 'menu', 'sidebar'])):
                txt = el.get_text(' ', strip=True)
                if txt:
                    parts.append(f"- {txt}\n")
                    processed_elements.add(id(el))

    md = "\n".join(parts).strip()
    return title, md

def chunk_markdown(md: str, title: str, url: str, max_chars=2500, min_words=30):
    sections = re.split(r"(?=^##\s|^###\s)", md, flags=re.M) or [md]
    chunk_counter = 0
    pending_sections = []  # Buffer to accumulate small sections

    def word_count(text):
        return len(text.split())

    def flush_pending():
        """Yield buffered sections as a single chunk."""
        nonlocal chunk_counter, pending_sections
        if not pending_sections:
            return

        combined = "\n\n".join(pending_sections)
        # Extract heading from first section if it has one
        heading = ""
        first_lines = pending_sections[0].splitlines()
        if first_lines and first_lines[0].startswith(("## ", "### ")):
            heading = first_lines[0].lstrip("# ").strip()

        yield {
            "id": sha16(f"{url}|{chunk_counter}"),
            "title": title,
            "heading": heading,
            "url": url,
            "markdown": combined.strip()
        }
        chunk_counter += 1
        pending_sections = []

    for sec in sections:
        sec = sec.strip()
        if not sec:
            continue

        lines = sec.splitlines()
        heading = ""
        if lines and lines[0].startswith(("## ", "### ")):
            heading = lines[0].lstrip("# ").strip()

        wc = word_count(sec)

        # If this section is tiny (< min_words), buffer it with others
        if wc < min_words:
            pending_sections.append(sec)
            # Flush if buffered content is getting large enough
            if word_count("\n\n".join(pending_sections)) >= min_words * 2:
                yield from flush_pending()
            continue

        # Flush any buffered tiny sections before processing this larger one
        if pending_sections:
            yield from flush_pending()

        # If section fits in one chunk, yield it
        if len(sec) <= max_chars:
            yield {
                "id": sha16(f"{url}|{chunk_counter}"),
                "title": title,
                "heading": heading,
                "url": url,
                "markdown": sec
            }
            chunk_counter += 1
        else:
            # Smart chunking: split at word boundaries
            words = sec.split()
            current_chunk = []
            current_size = 0

            for word in words:
                word_len = len(word) + 1  # +1 for space

                # If adding this word exceeds limit and we have content, yield chunk
                if current_size + word_len > max_chars and current_chunk:
                    chunk_text = ' '.join(current_chunk)
                    yield {
                        "id": sha16(f"{url}|{chunk_counter}"),
                        "title": title,
                        "heading": heading,
                        "url": url,
                        "markdown": chunk_text
                    }
                    chunk_counter += 1
                    current_chunk = []
                    current_size = 0

                current_chunk.append(word)
                current_size += word_len

            # Yield remaining words
            if current_chunk:
                chunk_text = ' '.join(current_chunk)
                yield {
                    "id": sha16(f"{url}|{chunk_counter}"),
                    "title": title,
                    "heading": heading,
                    "url": url,
                    "markdown": chunk_text
                }
                chunk_counter += 1

    # Flush any remaining buffered sections
    if pending_sections:
        yield from flush_pending()

def crawl_and_build(root_url: str, out_dir: pathlib.Path, wait_sec=1.0, max_pages=1000):
    out_pages = out_dir / "pages"
    out_pages.mkdir(parents=True, exist_ok=True)
    out_index = out_dir / "index.jsonl"

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Senne-OmarchyBot/1.0 (personal-use; contact: you@example.com)",
        "Accept": "text/html,application/xhtml+xml",
    })

    root_norm = normalize_url(root_url)
    seen = set()
    queue = [root_norm]  # normalized root only

    total_pages = 0
    total_chunks = 0

    with out_index.open("w", encoding="utf-8") as jl:
        while queue and total_pages < max_pages:
            raw = queue.pop(0)
            url = normalize_url(raw)
            if url in seen:
                continue
            seen.add(url)
            if not same_manual_path(url, root_norm):
                continue

            try:
                soup = load_html(session, url)
            except Exception as e:
                print(f"SKIP {url} ({e})", file=sys.stderr)
                continue

            # enqueue new links
            for a in soup.select("a[href]"):
                href = a.get("href", "")
                if not href:
                    continue
                absu = abs_url(href, url + "/")  # base w/ slash to resolve relatives
                nu = normalize_url(absu)
                if same_manual_path(nu, root_norm) and nu not in seen:
                    queue.append(nu)

            # extract page
            title, md = html_to_markdown(soup)
            page = {"url": url, "title": title, "markdown": md}
            (out_pages / f"{sha16(url)}.json").write_text(
                json.dumps(page, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            total_pages += 1

            # chunk & write
            for ch in chunk_markdown(md, title, url):
                jl.write(json.dumps(ch, ensure_ascii=False) + "\n")
                total_chunks += 1

            print(f"[{total_pages}] {url}")
            time.sleep(wait_sec)

    print(f"\nDONE. Pages: {total_pages}, Chunks: {total_chunks}")
    print(f"Pages dir: {out_pages}")
    print(f"Index:     {out_index}")

def main():
    ap = argparse.ArgumentParser(description="Scrape Omarchy manual into a chunked corpus")
    ap.add_argument("--root", default=DEFAULT_ROOT, help="Root URL (default: %(default)s)")
    ap.add_argument("--out", default="corpus", help="Output directory (default: corpus)")
    ap.add_argument("--wait", type=float, default=1.0, help="Delay between requests in seconds (default: 1.0)")
    ap.add_argument("--max-pages", type=int, default=1000, help="Safety cap on pages (default: 1000)")
    args = ap.parse_args()

    out_dir = pathlib.Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"Root: {args.root}")
    print(f"Out:  {out_dir}")
    crawl_and_build(args.root, out_dir, wait_sec=args.wait, max_pages=args.max_pages)

if __name__ == "__main__":
    main()
