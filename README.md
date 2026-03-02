# Omarchy MCP Search

An intelligent Model Context Protocol (MCP) server for searching the Omarchy Linux manual, with built-in scraper for corpus generation.

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![License](https://img.shields.io/badge/license-ISC-green.svg)

## Features

✨ **Fuzzy Search** - Typo-tolerant matching with Fuse.js
🔍 **Smart Synonyms** - Automatic query expansion
📊 **TF-IDF Ranking** - Intelligent relevance scoring
⚡ **LRU Caching** - 500-query cache for instant results
🎯 **Keyword Extraction** - Automatic concept identification
🌿 **Porter Stemming** - Matches word variations
💬 **Multi-Word Logic** - Smart phrase handling

## Project Structure

```
omarchy-mcp-search/
├── mcp-server/          # MCP server implementation
│   ├── src/
│   │   └── server.ts    # Main server code
│   ├── package.json
│   ├── GetStarted.md    # Detailed MCP documentation
│   └── README.md
├── scraper/             # Corpus generation tool
│   ├── scrape_and_build_omarchy.py
│   ├── requirements.txt
│   └── README.md
├── corpus/              # Generated search index (gitignored)
│   ├── index.jsonl
│   └── pages/
├── setup-first-time.sh  # ⭐ First-time setup script
├── update-corpus.sh     # Automated update script
├── UPDATING.md          # Update documentation
├── README.md            # This file
└── LICENSE              # ISC License
```

## Quick Start

### Automated Setup (Recommended)

```bash
git clone https://github.com/12lolo/omarchy-mcp-search.git
cd omarchy-mcp-search
./setup-first-time.sh
```

This single script will:
- ✅ Set up Python virtual environment
- ✅ Install all dependencies (Python + Node.js)
- ✅ Generate the corpus by scraping the Omarchy manual
- ✅ Show you the exact command to add to Claude Code

Then just **add to Claude Code and restart**!

### Manual Setup

<details>
<summary>Click to expand manual setup steps</summary>

#### 1. Generate the Corpus

```bash
cd scraper
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python3 scrape_and_build_omarchy.py --out ../corpus --max-pages 200
```

This creates `corpus/index.jsonl` with optimized documentation chunks.

#### 2. Install MCP Server

```bash
cd mcp-server
npm install
```

#### 3. Add to Claude Code

```bash
claude mcp add --transport stdio omarchy-manual \
  --env CORPUS_INDEX=/path/to/omarchy-mcp-search/corpus/index.jsonl \
  -- npx tsx /path/to/omarchy-mcp-search/mcp-server/src/server.ts
```

Replace `/path/to/` with your actual project path.

#### 4. Restart Claude Code

Quit and restart Claude Code to activate the MCP server.

#### 5. Test It

Ask Claude Code:
```
"Search the omarchy manual for shortcuts"
```

</details>

## Updating the Corpus

When the Omarchy manual is updated online, refresh your local corpus:

```bash
./update-corpus.sh
```

Then **restart Claude Code** to load the new content.

**See [UPDATING.md](UPDATING.md)** for:
- Manual update process
- Automation options (cron, etc.)
- Troubleshooting
- Update frequency recommendations

---

## Usage Examples

### Basic Queries
```
"hotkeys"              → Finds keyboard shortcuts
"theme settings"       → Finds appearance/style docs
"how to screenshot"    → Multi-word intelligence
```

### Typo Tolerance
```
"neovimm"              → Corrects to "neovim"
"shortcutts"           → Finds "shortcuts"
"instaling"            → Finds "install"
```

### Synonym Expansion
```
"shortcuts"            → Searches: hotkeys, keybinds, keyboard...
"wifi setup"           → Searches: wireless, network, internet...
"editor config"        → Searches: neovim, vim, nvim...
```

## Documentation

- **[mcp-server/GetStarted.md](mcp-server/GetStarted.md)** - Complete MCP server guide
- **[mcp-server/README.md](mcp-server/README.md)** - MCP quick reference
- **[scraper/README.md](scraper/README.md)** - Scraper documentation

## Performance

| Metric | Value |
|--------|-------|
| Search Speed (cached) | <1ms |
| Search Speed (first-time) | 10-30ms |
| Memory Usage | ~6-7MB |
| Cache Capacity | 500 queries |

## Architecture

### Search Pipeline

```
Query → Cache Check → Synonym Expansion → Multi-Mode Search → Ranking → Cache → Results
```

**Multi-Mode Search includes:**
1. Exact substring matching
2. Fuzzy matching (Fuse.js)
3. Keyword matching
4. Stem matching (Porter)
5. TF-IDF scoring

### Scoring Weights

- Exact title match: +150
- Title contains: +50
- Exact heading: +75
- Heading contains: +25
- Body match: +5
- Keyword match: +15
- Stem match: +10
- TF-IDF: Variable
- Multi-word bonus: +30

## Development

### MCP Server

```bash
cd mcp-server

# Start server
npm start

# Development mode (auto-reload)
npm run dev
```

### Scraper

```bash
cd scraper
source .venv/bin/activate

# Re-scrape corpus
python3 scrape_and_build_omarchy.py --out ../corpus
```

### Testing MCP Tools

From Claude Code, you can test:
```
search_omarchy(query="shortcuts", limit=10)
get_omarchy_chunk(id="abc123")
cache_stats()
```

## Troubleshooting

### MCP Server Won't Start

Check the corpus path:
```bash
cd mcp-server
CORPUS_INDEX=../corpus/index.jsonl npm start
```

### Search Returns No Results

1. Verify corpus exists: `ls -lh ../corpus/index.jsonl`
2. Check MCP connection: `claude mcp list`
3. Restart Claude Code completely
4. Try exact terms: "hotkeys", "theme", "neovim"

### Scraper Fails

- Increase wait time: `--wait 2.0`
- Reduce max pages: `--max-pages 50`
- Check internet connection
- Verify source URL is accessible

## Technologies

### MCP Server
- TypeScript + tsx
- Fuse.js (fuzzy search)
- natural (NLP/stemming)
- lru-cache (query caching)
- @modelcontextprotocol/sdk

### Scraper
- Python 3
- requests (HTTP)
- beautifulsoup4 (HTML parsing)
- lxml (fast parser)

## Contributing

This is a personal project, but feel free to fork and adapt for your own documentation needs!

## License

ISC

## Credits

Built for searching the [Omarchy Linux manual](https://learn.omacom.io/2/the-omarchy-manual/).
Omarchy is developed by [DHH / Basecamp](https://github.com/basecamp/omarchy).

---

**Status:** ✅ Production Ready
**Version:** 2.0.0
**Performance:** ⚡ Optimized
