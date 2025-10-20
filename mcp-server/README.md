# MCP Omarchy Manual

Intelligent search MCP server for the Omarchy Linux manual.

**[→ Get Started](GetStarted.md)**

## Features

✨ Fuzzy search with typo tolerance
🔍 Smart synonym expansion
📊 TF-IDF relevance ranking
⚡ LRU query caching (500 entries)
🎯 Keyword extraction
🌿 Porter stemming
💬 Multi-word query intelligence

## Quick Install

```bash
npm install

claude mcp add --transport stdio omarchy-manual \
  --env CORPUS_INDEX=/path/to/omarchy-mcp-search/corpus/index.jsonl \
  -- npx tsx /path/to/omarchy-mcp-search/mcp-server/src/server.ts
```

Replace `/path/to/` with your actual project path, then restart Claude Code.

**Full documentation**: [GetStarted.md](GetStarted.md)
