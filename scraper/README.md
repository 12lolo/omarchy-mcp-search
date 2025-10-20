# Omarchy Manual Scraper

Scrapes the Omarchy Linux manual website and builds a searchable corpus.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Usage

### Basic Scraping

```bash
python3 scrape_and_build_omarchy.py
```

This will:
- Scrape from `https://learn.omacom.io/2/the-omarchy-manual/`
- Output to `../corpus/` directory
- Wait 1 second between requests
- Limit to 1000 pages (safety cap)

### Custom Options

```bash
python3 scrape_and_build_omarchy.py \
  --root https://learn.omacom.io/2/the-omarchy-manual/ \
  --out ../corpus \
  --wait 1.0 \
  --max-pages 100
```

**Options:**
- `--root`: Starting URL to scrape
- `--out`: Output directory (default: `corpus`)
- `--wait`: Delay between requests in seconds (default: 1.0)
- `--max-pages`: Maximum pages to scrape (default: 1000)

## Output

The scraper creates:

```
../corpus/
├── index.jsonl          # Main search index (one chunk per line)
└── pages/               # Full page JSON files
    ├── abc123def456.json
    └── ...
```

### Index Format

Each line in `index.jsonl` is a JSON object:

```json
{
  "id": "abc123def456",
  "title": "Page Title",
  "heading": "Section Heading",
  "url": "https://...",
  "markdown": "# Content..."
}
```

## Features

### Smart Chunking

- Splits on H2/H3 headings
- Merges small sections (<30 words)
- Keeps headings with their content
- Max 2500 characters per chunk

### Content Processing

- Converts HTML to clean markdown
- Removes navigation/UI elements
- Preserves code blocks, lists, paragraphs
- Extracts proper headings

### Crawling

- Follows internal links only
- Deduplicates URLs
- Normalizes paths (removes trailing slashes)
- Respects rate limiting (--wait parameter)

## Maintenance

### Re-scraping

To update the corpus:

```bash
# Backup existing corpus
mv ../corpus ../corpus.backup-$(date +%Y%m%d)

# Re-scrape
python3 scrape_and_build_omarchy.py --out ../corpus --max-pages 100

# Verify
cat ../corpus/index.jsonl | wc -l
```

### Dependencies

- **requests**: HTTP client
- **beautifulsoup4**: HTML parsing
- **lxml**: Fast HTML parser (optional but recommended)

## Troubleshooting

### Connection Errors

If you get connection errors:
- Increase `--wait` time (e.g., `--wait 2.0`)
- Check internet connection
- Verify the root URL is accessible

### Missing Content

If chunks seem incomplete:
- Check the HTML structure of the source site
- Adjust selectors in `html_to_markdown()` function
- Verify the `main` or `article` tags are being found

### Too Many/Few Chunks

Adjust chunking parameters in the script:
- `max_chars=2500`: Max characters per chunk
- `min_words=30`: Minimum words before merging sections
