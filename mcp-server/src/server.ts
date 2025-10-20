// src/server.ts - Ultra-optimized search with fuzzy matching, stemming, and caching
import fs from "node:fs";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import Fuse from "fuse.js";
import { LRUCache } from "lru-cache";
import natural from "natural";

const { PorterStemmer } = natural;

type Chunk = {
  id: string;
  title: string;
  heading: string;
  url: string;
  markdown: string;
  _searchTitle: string;
  _searchHeading: string;
  _searchBody: string;
  _keywords: string[];  // Extracted keywords
  _stems: Set<string>;  // Stemmed words
  _termFreq: Map<string, number>;  // Term frequency for TF-IDF
};

// Resolve your index.jsonl (allow override via env var)
const INDEX_PATH =
  process.env.CORPUS_INDEX ||
  path.resolve(process.cwd(), "../corpus/index.jsonl");

if (!fs.existsSync(INDEX_PATH)) {
  console.error("ERROR: index.jsonl not found at", INDEX_PATH);
  process.exit(2);
}

// ============================================================================
// COMPREHENSIVE SYNONYM MAPPING
// ============================================================================
const SYNONYMS: Record<string, string[]> = {
  // Keyboard & shortcuts
  "shortcuts": ["hotkeys", "keybinds", "keyboard", "bindings", "keys", "keymap", "hotkey", "keybinding"],
  "keybinds": ["hotkeys", "shortcuts", "keyboard", "bindings", "keys", "keymap", "keybinding"],
  "hotkeys": ["shortcuts", "keybinds", "keyboard", "bindings", "keys", "keymap"],
  "keys": ["hotkeys", "shortcuts", "keybinds", "keyboard", "bindings"],
  "keymap": ["hotkeys", "shortcuts", "keybinds", "keyboard", "bindings"],

  // Appearance & style
  "theme": ["style", "appearance", "colors", "colorscheme", "palette"],
  "style": ["theme", "appearance", "colors", "styling"],
  "colors": ["theme", "colorscheme", "palette", "appearance"],
  "background": ["wallpaper", "image", "backdrop", "bg"],
  "wallpaper": ["background", "image", "backdrop"],

  // Network
  "wifi": ["wireless", "network", "internet", "connection"],
  "wireless": ["wifi", "network", "internet"],
  "network": ["wifi", "internet", "connection", "networking"],

  // Applications
  "terminal": ["shell", "console", "alacritty", "cli", "command"],
  "shell": ["terminal", "console", "bash", "zsh", "cli"],
  "editor": ["neovim", "vim", "nvim", "text editor"],
  "neovim": ["vim", "nvim", "editor"],
  "vim": ["neovim", "nvim", "editor"],
  "browser": ["chromium", "firefox", "web browser", "chrome"],
  "files": ["file manager", "thunar", "explorer", "finder"],

  // Capture
  "screenshot": ["capture", "screen", "image", "screencap", "print screen"],
  "capture": ["screenshot", "screen", "record", "grab"],
  "record": ["capture", "recording", "screencast"],

  // Window management
  "window": ["windows", "tiling", "tile"],
  "workspace": ["desktop", "virtual desktop", "space"],
  "fullscreen": ["full screen", "maximize"],

  // System
  "install": ["setup", "add", "installation", "configure"],
  "config": ["configuration", "setup", "settings", "configure"],
  "settings": ["config", "configuration", "preferences", "options"],
  "update": ["upgrade", "updates", "updating"],
};

// ============================================================================
// STOPWORDS - Common words to ignore in keyword extraction
// ============================================================================
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "he",
  "in", "is", "it", "its", "of", "on", "that", "the", "to", "was", "will",
  "with", "you", "your", "this", "can", "all", "or", "but", "not", "have",
]);

// ============================================================================
// KEYWORD EXTRACTION
// ============================================================================
function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));

  // Count frequency
  const freq = new Map<string, number>();
  words.forEach(w => freq.set(w, (freq.get(w) || 0) + 1));

  // Get top keywords by frequency
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
}

// ============================================================================
// STEMMING
// ============================================================================
function stemWords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2);

  return new Set(words.map(w => PorterStemmer.stem(w)));
}

// ============================================================================
// TERM FREQUENCY FOR TF-IDF-LIKE SCORING
// ============================================================================
function calculateTermFrequency(text: string): Map<string, number> {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));

  const freq = new Map<string, number>();
  words.forEach(w => freq.set(w, (freq.get(w) || 0) + 1));

  // Normalize by document length
  const total = words.length;
  freq.forEach((count, word) => freq.set(word, count / total));

  return freq;
}

// ============================================================================
// LOAD AND ENRICH CHUNKS
// ============================================================================
const chunks: Chunk[] = fs
  .readFileSync(INDEX_PATH, "utf-8")
  .trim()
  .split("\n")
  .map((l) => {
    const parsed = JSON.parse(l);
    const fullText = `${parsed.title} ${parsed.heading} ${parsed.markdown}`;

    return {
      ...parsed,
      heading: parsed.heading || "",
      _searchTitle: (parsed.title || "").toLowerCase(),
      _searchHeading: (parsed.heading || "").toLowerCase(),
      _searchBody: (parsed.markdown || "").toLowerCase(),
      _keywords: extractKeywords(fullText),
      _stems: stemWords(fullText),
      _termFreq: calculateTermFrequency(fullText),
    };
  });

console.error(`[omarchy-manual] Loaded ${chunks.length} chunks with enriched metadata`);

// ============================================================================
// FUSE.JS SETUP FOR FUZZY SEARCH
// ============================================================================
const fuse = new Fuse(chunks, {
  keys: [
    { name: "_searchTitle", weight: 3 },
    { name: "_searchHeading", weight: 2 },
    { name: "_searchBody", weight: 1 },
  ],
  threshold: 0.4,  // 0 = exact match, 1 = match anything
  ignoreLocation: true,
  minMatchCharLength: 3,
  includeScore: true,
});

// ============================================================================
// QUERY CACHE
// ============================================================================
const queryCache = new LRUCache<string, any>({
  max: 500,  // Cache up to 500 queries
  ttl: 1000 * 60 * 60,  // 1 hour TTL
});

// ============================================================================
// DOCUMENT FREQUENCY FOR IDF CALCULATION
// ============================================================================
const documentFrequency = new Map<string, number>();
chunks.forEach(chunk => {
  const uniqueWords = new Set(chunk._searchBody.split(/\s+/).filter(w => w.length > 2));
  uniqueWords.forEach(word => {
    documentFrequency.set(word, (documentFrequency.get(word) || 0) + 1);
  });
});

// ============================================================================
// SYNONYM EXPANSION
// ============================================================================
function expandQuery(query: string): string[] {
  const q = query.toLowerCase().trim();
  const terms = new Set([q]);

  // Add whole query synonyms
  if (SYNONYMS[q]) {
    SYNONYMS[q].forEach(syn => terms.add(syn));
  }

  // Check each word in multi-word queries
  const words = q.split(/\s+/);
  words.forEach(word => {
    if (SYNONYMS[word]) {
      SYNONYMS[word].forEach(syn => terms.add(syn));
      // Also add the synonym as part of the original phrase structure
      words.forEach((w, i) => {
        if (w === word) {
          const newPhrase = [...words];
          newPhrase[i] = syn;
          terms.add(newPhrase.join(" "));
        }
      });
    }
  });

  // Add stemmed versions
  words.forEach(word => {
    if (word.length > 2) {
      terms.add(PorterStemmer.stem(word));
    }
  });

  return Array.from(terms);
}

// ============================================================================
// MULTI-MODE SEARCH: Exact + Fuzzy + Stem + Synonym
// ============================================================================
function searchChunks(query: string, limit = 10): any[] {
  const cacheKey = `${query}:${limit}`;
  const cached = queryCache.get(cacheKey);
  if (cached) {
    console.error(`[search] Cache hit for "${query}"`);
    return cached;
  }

  const searchTerms = expandQuery(query);
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const queryStems = queryWords.map(w => PorterStemmer.stem(w));

  const scored = chunks.map((c) => {
    let score = 0;

    // 1. EXACT MATCH SCORING (highest priority)
    for (const q of searchTerms) {
      // Title match - super high weight
      if (c._searchTitle.includes(q)) {
        score += 50;
        if (c._searchTitle === q) score += 100;  // Exact title match bonus
      }

      // Heading match - high weight
      if (c._searchHeading.includes(q)) {
        score += 25;
        if (c._searchHeading === q) score += 50;
      }

      // Body match - base weight
      if (c._searchBody.includes(q)) {
        score += 5;

        // Bonus for multiple occurrences
        const occurrences = (c._searchBody.match(new RegExp(q, "g")) || []).length;
        score += Math.min(occurrences - 1, 10) * 2;  // +2 per extra occurrence, max +20
      }
    }

    // 2. KEYWORD MATCH SCORING
    queryWords.forEach(word => {
      if (c._keywords.includes(word)) {
        score += 15;  // Keyword match is valuable
      }
    });

    // 3. STEM MATCH SCORING
    queryStems.forEach(stem => {
      if (c._stems.has(stem)) {
        score += 10;  // Stemmed match
      }
    });

    // 4. TF-IDF-LIKE SCORING
    queryWords.forEach(word => {
      const tf = c._termFreq.get(word) || 0;
      const df = documentFrequency.get(word) || 1;
      const idf = Math.log(chunks.length / df);
      score += tf * idf * 100;  // Scale up for visibility
    });

    // 5. MULTI-WORD QUERY BONUS (all words present)
    if (queryWords.length > 1) {
      const allWordsPresent = queryWords.every(word =>
        c._searchBody.includes(word) ||
        c._searchTitle.includes(word) ||
        c._searchHeading.includes(word)
      );
      if (allWordsPresent) {
        score += 30;  // Bonus for having all query terms
      }
    }

    return score > 0 ? { score, c } : null;
  }).filter(Boolean) as { score: number; c: Chunk }[];

  // 6. FUZZY SEARCH FALLBACK (if few results)
  if (scored.length < 3) {
    console.error(`[search] Using fuzzy fallback for "${query}"`);
    const fuzzyResults = fuse.search(query, { limit: limit * 2 });
    fuzzyResults.forEach(result => {
      const existingIndex = scored.findIndex(s => s.c.id === result.item.id);
      if (existingIndex >= 0) {
        // Boost score if found in both
        scored[existingIndex].score += 20;
      } else {
        // Add fuzzy-only results with lower score
        scored.push({
          score: (1 - (result.score || 0)) * 30,  // Convert Fuse score to our scale
          c: result.item,
        });
      }
    });
  }

  // Sort and return top results
  scored.sort((a, b) => b.score - a.score);

  const results = scored.slice(0, Math.min(Math.max(1, limit), 25)).map(({ score, c }) => ({
    score: Math.round(score),
    id: c.id,
    title: c.title,
    heading: c.heading,
    url: c.url,
    preview: c.markdown.slice(0, 500) + (c.markdown.length > 500 ? "..." : ""),
    markdown: c.markdown.length <= 1000 ? c.markdown : undefined,
    wordCount: c.markdown.split(/\s+/).length,
    keywords: c._keywords.slice(0, 5),  // Include top 5 keywords
  }));

  // Cache the results
  queryCache.set(cacheKey, results);

  return results;
}

// ============================================================================
// MCP SERVER SETUP
// ============================================================================
const server = new McpServer({
  name: "omarchy-manual",
  version: "2.0.0",  // Bumped version for optimized release
});

// 1) SEARCH TOOL
server.registerTool(
  "search_omarchy",
  {
    description: "Search the Omarchy Linux manual with advanced fuzzy matching, synonym expansion, and semantic search. Supports typos, multi-word queries, and intelligent ranking. Returns relevant documentation chunks with content previews and extracted keywords.",
    inputSchema: {
      query: z.string().describe("Search query text (e.g., 'shortcuts', 'how to screenshot', 'hyprland config'). Supports typos and synonyms."),
      limit: z.number().int().min(1).max(25).optional().describe("Maximum number of results (1-25, default 10)"),
    },
  },
  async ({ query, limit = 10 }) => {
    if (!query || query.trim().length === 0) {
      throw new Error("Query cannot be empty");
    }

    console.error(`[search_omarchy] query="${query}" limit=${limit}`);
    const startTime = Date.now();
    const results = searchChunks(query, limit);
    const duration = Date.now() - startTime;
    console.error(`[search_omarchy] found ${results.length} results in ${duration}ms`);

    const output = {
      results,
      query,
      count: results.length,
      searchTime: `${duration}ms`,
      expandedTerms: expandQuery(query).slice(0, 5),  // Show some expanded terms
    };

    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
    };
  },
);

// 2) GET CHUNK TOOL
server.registerTool(
  "get_omarchy_chunk",
  {
    description: "Retrieve the complete markdown content for a specific documentation chunk by ID. Use this after search_omarchy if you need the full content of a specific result that was truncated in the preview.",
    inputSchema: {
      id: z.string().describe("Chunk ID to retrieve (from search results)"),
    },
  },
  async ({ id }) => {
    console.error(`[get_omarchy_chunk] id="${id}"`);
    const c = chunks.find((x) => x.id === id);
    if (!c) {
      console.error(`[get_omarchy_chunk] chunk not found: ${id}`);
      throw new Error(`Chunk not found: ${id}`);
    }

    console.error(`[get_omarchy_chunk] found chunk: "${c.title}"`);
    const output = {
      id: c.id,
      title: c.title,
      heading: c.heading,
      url: c.url,
      markdown: c.markdown,
      wordCount: c.markdown.split(/\s+/).length,
      keywords: c._keywords.slice(0, 10),
    };

    const formattedContent = `# ${c.title}
${c.heading ? `## ${c.heading}\n` : ""}
${c.markdown}

---
Keywords: ${c._keywords.slice(0, 10).join(", ")}
Source: ${c.url}
ID: ${c.id}`;

    return {
      content: [{ type: "text", text: formattedContent }],
      structuredContent: output,
    };
  },
);

// 3) CACHE STATS TOOL (for debugging/monitoring)
server.registerTool(
  "cache_stats",
  {
    description: "Get statistics about the search query cache (for debugging/monitoring performance)",
    inputSchema: {},
  },
  async () => {
    const stats = {
      cacheSize: queryCache.size,
      cacheMax: queryCache.max,
      totalChunks: chunks.length,
      totalUniqueTerms: documentFrequency.size,
    };

    console.error(`[cache_stats]`, stats);
    return {
      content: [{ type: "text", text: JSON.stringify(stats, null, 2) }],
      structuredContent: stats,
    };
  },
);

// Connect via stdio
const transport = new StdioServerTransport();

(async () => {
  await server.connect(transport);
  console.error("omarchy-manual MCP server v2.0 (OPTIMIZED) ready. Index:", INDEX_PATH);
  console.error(`  - ${chunks.length} enriched chunks`);
  console.error(`  - ${documentFrequency.size} unique indexed terms`);
  console.error(`  - Fuzzy search: enabled`);
  console.error(`  - Query cache: enabled (max ${queryCache.max} entries)`);
  console.error(`  - Synonym expansion: enabled (${Object.keys(SYNONYMS).length} mappings)`);
})();
