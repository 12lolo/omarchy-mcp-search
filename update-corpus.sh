#!/bin/bash
# Update Omarchy Manual Corpus
# This script re-scrapes the Omarchy manual and updates the MCP corpus

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRAPER_DIR="$SCRIPT_DIR/scraper"
CORPUS_DIR="$SCRIPT_DIR/corpus"
VENV_DIR="$SCRAPER_DIR/.venv"

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║          Omarchy MCP Corpus Update Script                        ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Check if virtualenv exists
if [ ! -d "$VENV_DIR" ]; then
    echo "❌ Python virtual environment not found at $VENV_DIR"
    echo "   Run: cd scraper && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

# Backup existing corpus if it exists
if [ -d "$CORPUS_DIR" ]; then
    BACKUP_NAME="corpus.backup-$(date +%Y%m%d-%H%M%S)"
    echo "📦 Backing up existing corpus to $BACKUP_NAME..."
    mv "$CORPUS_DIR" "$SCRIPT_DIR/$BACKUP_NAME"
    echo "✅ Backup created"
else
    echo "ℹ️  No existing corpus found, creating new one"
fi

echo ""
echo "🌐 Scraping Omarchy manual..."
echo "   Source: https://learn.omacom.io/2/the-omarchy-manual/"
echo "   Target: $CORPUS_DIR"
echo ""

# Activate virtualenv and run scraper
cd "$SCRAPER_DIR"
source "$VENV_DIR/bin/activate"

python3 scrape_and_build_omarchy.py \
    --root https://learn.omacom.io/2/the-omarchy-manual/ \
    --out "$CORPUS_DIR" \
    --wait 1.0 \
    --max-pages 200

# Check if scraping was successful
if [ ! -f "$CORPUS_DIR/index.jsonl" ]; then
    echo ""
    echo "❌ Scraping failed! index.jsonl not found"
    echo "   Restoring backup..."

    # Find latest backup
    LATEST_BACKUP=$(ls -dt "$SCRIPT_DIR"/corpus.backup-* 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
        rm -rf "$CORPUS_DIR"
        mv "$LATEST_BACKUP" "$CORPUS_DIR"
        echo "✅ Backup restored"
    fi
    exit 1
fi

# Count chunks
CHUNK_COUNT=$(wc -l < "$CORPUS_DIR/index.jsonl")

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                    Update Complete!                               ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Statistics:"
echo "   • Chunks indexed: $CHUNK_COUNT"
echo "   • Corpus location: $CORPUS_DIR/index.jsonl"
echo ""
echo "⚠️  IMPORTANT: Restart Claude Code to load the new corpus!"
echo ""
echo "🔄 To activate the changes:"
echo "   1. Quit Claude Code completely"
echo "   2. Restart Claude Code"
echo "   3. Test with: 'search omarchy manual for shortcuts'"
echo ""

# Show backups
BACKUP_COUNT=$(ls -d "$SCRIPT_DIR"/corpus.backup-* 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 0 ]; then
    echo "📦 Old backups available ($BACKUP_COUNT):"
    ls -dt "$SCRIPT_DIR"/corpus.backup-* | head -3
    echo ""
    if [ "$BACKUP_COUNT" -gt 5 ]; then
        echo "💡 Tip: Clean up old backups with: rm -rf corpus.backup-*"
    fi
fi

echo "✅ Done!"
