# MCP Omarchy Manual - Get Started

A Model Context Protocol (MCP) server providing intelligent search over the Omarchy Linux manual documentation.

## Features

- **Fuzzy Search**: Typo-tolerant matching with Fuse.js
- **Synonym Expansion**: Automatically expands queries (e.g., "shortcuts" → "hotkeys", "keybinds", "keyboard")
- **Stemming**: Matches word variations (e.g., "configuring" matches "config", "configure", "configuration")
- **TF-IDF Scoring**: Prioritizes important and unique terms
- **Query Caching**: LRU cache with 500 entries for instant repeat searches
- **Keyword Extraction**: Identifies and highlights key concepts in each document
- **Multi-Word Intelligence**: Smart handling of phrases and multiple search terms

## Quick Start

### 1. Install Dependencies

```bash
cd mcp-server
npm install
```

### 2. Add to Claude Code

```bash
claude mcp add --transport stdio omarchy-manual \
  --env CORPUS_INDEX=/path/to/omarchy-mcp-search/corpus/index.jsonl \
  -- npx tsx /path/to/omarchy-mcp-search/mcp-server/src/server.ts
```

Replace `/path/to/` with your actual project path.

### 3. Verify Connection

```bash
claude mcp list
```

You should see:
```
omarchy-manual: npx tsx .../mcp-server/src/server.ts - ✓ Connected
```

### 4. Restart Claude Code

Quit and restart Claude Code for the MCP server to fully activate.

## Usage Examples

### Basic Search

Ask Claude Code:
```
"Search the omarchy manual for shortcuts"
```

The MCP will return relevant documentation with:
- Relevance scores
- Content previews
- Extracted keywords
- Search time and expanded terms

### Advanced Queries

**Typo Tolerance:**
```
"neovimm configuration"  → Automatically corrects to "neovim"
"themees settings"       → Finds "theme" documentation
```

**Synonym Expansion:**
```
"shortcuts"              → Searches: hotkeys, keybinds, keyboard, bindings
"wifi setup"             → Searches: wireless, network, internet
"editor config"          → Searches: neovim, vim, nvim, editor
```

**Multi-Word Queries:**
```
"how to change theme"
"setup wifi connection"
"neovim keyboard shortcuts"
```

## Available Tools

### 1. `search_omarchy`

Search the Omarchy manual with advanced fuzzy matching.

**Parameters:**
- `query` (string): Search query text
- `limit` (number, optional): Maximum results (1-25, default 10)

**Returns:**
- Ranked results with scores
- Content previews (500 chars)
- Top 5 keywords per result
- Search time and expanded terms

### 2. `get_omarchy_chunk`

Retrieve complete content for a specific documentation chunk.

**Parameters:**
- `id` (string): Chunk ID from search results

**Returns:**
- Full markdown content
- Complete keyword list (top 10)
- Source URL and metadata

### 3. `cache_stats`

Monitor search performance and cache statistics.

**Returns:**
- Current cache size
- Total indexed chunks
- Unique indexed terms
- Cache configuration

## Architecture

### Search Pipeline

```
Query → Cache Check → Synonym Expansion → Multi-Mode Search → Ranking → Cache → Results
                         ↓
              [Original + Synonyms + Stems]
                         ↓
         [Exact Match + Fuzzy + Keywords + TF-IDF]
```

### Scoring System

| Match Type           | Score | Notes                    |
|---------------------|-------|--------------------------|
| Exact title match   | +150  | Highest priority         |
| Title contains      | +50   | Very high                |
| Exact heading       | +75   | High priority            |
| Heading contains    | +25   | High                     |
| Body match          | +5    | Base score               |
| Multiple occurrences| +2/ea | Max +20                  |
| Keyword match       | +15   | Important terms          |
| Stem match          | +10   | Root form                |
| TF-IDF score        | Var   | Contextual importance    |
| Multi-word bonus    | +30   | All terms present        |

### Performance

- **Memory**: ~6-7MB total
- **Speed**: <1ms (cached) / 10-30ms (first-time)
- **Corpus**: 112 optimized chunks
- **Index**: 2,215 unique terms
- **Cache**: 500-query capacity
- **Synonyms**: 30 categories, 84 mappings

## Project Structure

```
mcp-omarchy/
├── src/
│   └── server.ts          # Main MCP server implementation
├── package.json           # Dependencies and configuration
├── tsconfig.json          # TypeScript configuration
└── GetStarted.md          # This file
```

## Dependencies

- `@modelcontextprotocol/sdk` - MCP server framework
- `fuse.js` - Fuzzy search engine
- `natural` - NLP library for stemming
- `lru-cache` - Query caching
- `zod` - Schema validation
- `tsx` - TypeScript execution

## Updating the Corpus

The corpus is built from the Omarchy manual website using a separate scraper (see `../scraper/`):

```bash
cd ../scraper
source .venv/bin/activate

# Backup existing corpus
mv ../corpus ../corpus.backup-$(date +%Y%m%d)

# Re-scrape (adjust --max-pages as needed)
python3 scrape_and_build_omarchy.py \
  --root https://learn.omacom.io/2/the-omarchy-manual/ \
  --out ../corpus \
  --wait 1.0 \
  --max-pages 100

# Verify
cat ../corpus/index.jsonl | wc -l
```

After updating the corpus:
1. Restart Claude Code
2. The MCP server will automatically load the new corpus
3. Test with a search query to verify

## Troubleshooting

### Server Won't Start

Check the corpus path is correct:
```bash
CORPUS_INDEX=/home/senne/PycharmProjects/scaper/corpus/index.jsonl \
  npx tsx src/server.ts
```

Expected output:
```
[omarchy-manual] Loaded 112 chunks with enriched metadata
omarchy-manual MCP server v2.0 (OPTIMIZED) ready
  - 112 enriched chunks
  - 2215 unique indexed terms
  - Fuzzy search: enabled
  - Query cache: enabled (max 500 entries)
  - Synonym expansion: enabled (30 mappings)
```

### Search Returns Poor Results

1. Restart Claude Code completely
2. Verify MCP is connected: `claude mcp list`
3. Check cache stats to confirm server is running
4. Try exact terms from the manual (e.g., "hotkeys")

### Cache Not Working

The cache is automatically managed with LRU eviction. To monitor:
- Use `cache_stats` tool to see current cache size
- Cache has 1-hour TTL
- 500-query capacity

## Technical Details

### Synonym Categories

The server includes 30+ synonym mappings across categories:
- Keyboard & shortcuts
- Appearance & styling
- Network & connectivity
- Applications
- Window management
- System operations
- Capture & screenshots

### Keyword Extraction

Keywords are extracted using:
1. Term frequency analysis
2. Stopword filtering (removes common words)
3. Top 20 per chunk
4. Used for result relevance boosting

### Stemming

Uses Porter Stemmer algorithm to match:
- `configure` ↔ `configuration` ↔ `configuring`
- `theme` ↔ `themes` ↔ `themed` ↔ `theming`
- `install` ↔ `installation` ↔ `installing`

### TF-IDF Scoring

- **TF (Term Frequency)**: How often a term appears in a document
- **IDF (Inverse Document Frequency)**: Rarity bonus for uncommon terms
- Normalized by document length
- Scaled ×100 for score visibility

## Configuration

### Environment Variables

- `CORPUS_INDEX`: Path to the corpus index.jsonl file

### Tuning Search

Edit `src/server.ts` to adjust:
- Fuse.js threshold (line 183): Lower = stricter (0.0-1.0)
- Cache size (line 193): Increase for more queries
- Score weights (lines 268-318): Customize ranking
- Synonym mappings (lines 40-84): Add your own

## License

This MCP server is provided as-is for use with Claude Code and the Omarchy manual.

## Credits

Built with Claude Code for searching the Omarchy Linux manual documentation.

---

**Version**: 2.0.0
**Status**: Production Ready
**Performance**: ⚡ Optimized
