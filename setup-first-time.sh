#!/bin/bash
# First-Time Setup Script for Omarchy MCP Search
# Run this after cloning the repository

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRAPER_DIR="$SCRIPT_DIR/scraper"
MCP_DIR="$SCRIPT_DIR/mcp-server"
CORPUS_DIR="$SCRIPT_DIR/corpus"
VENV_DIR="$SCRAPER_DIR/.venv"

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║        Omarchy MCP Search - First Time Setup                     ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""
echo "This script will:"
echo "  1. Set up Python virtual environment"
echo "  2. Install Python dependencies"
echo "  3. Install Node.js dependencies"
echo "  4. Generate the corpus (scrape Omarchy manual)"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 1
fi

# Check for required commands
echo ""
echo "🔍 Checking prerequisites..."

if ! command -v python3 &> /dev/null; then
    echo "❌ python3 not found. Please install Python 3.8 or higher."
    exit 1
fi
echo "✅ Python 3 found: $(python3 --version)"

if ! command -v node &> /dev/null; then
    echo "❌ node not found. Please install Node.js 18 or higher."
    exit 1
fi
echo "✅ Node.js found: $(node --version)"

if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install npm."
    exit 1
fi
echo "✅ npm found: $(npm --version)"

# Setup Python environment
echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  Step 1: Python Environment Setup                                ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

if [ -d "$VENV_DIR" ]; then
    echo "ℹ️  Virtual environment already exists at $VENV_DIR"
    echo "   Skipping creation..."
else
    echo "📦 Creating Python virtual environment..."
    cd "$SCRAPER_DIR"
    python3 -m venv .venv
    echo "✅ Virtual environment created"
fi

echo ""
echo "📥 Installing Python dependencies..."
source "$VENV_DIR/bin/activate"
pip install --quiet --upgrade pip
pip install --quiet -r "$SCRAPER_DIR/requirements.txt"
echo "✅ Python dependencies installed"

# Setup Node.js environment
echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  Step 2: Node.js Environment Setup                               ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

cd "$MCP_DIR"
if [ -d "node_modules" ]; then
    echo "ℹ️  node_modules already exists"
    echo "   Skipping installation..."
else
    echo "📥 Installing Node.js dependencies..."
    npm install --silent
    echo "✅ Node.js dependencies installed"
fi

# Generate corpus
echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  Step 3: Generate Corpus                                         ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

if [ -f "$CORPUS_DIR/index.jsonl" ]; then
    CHUNK_COUNT=$(wc -l < "$CORPUS_DIR/index.jsonl")
    echo "ℹ️  Corpus already exists with $CHUNK_COUNT chunks"
    read -p "   Re-generate corpus? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "   Skipping corpus generation..."
        SKIP_CORPUS=true
    else
        echo "   Backing up existing corpus..."
        mv "$CORPUS_DIR" "$SCRIPT_DIR/corpus.backup-$(date +%Y%m%d-%H%M%S)"
    fi
fi

if [ "$SKIP_CORPUS" != true ]; then
    echo "🌐 Scraping Omarchy manual..."
    echo "   This will take 2-3 minutes..."
    echo "   Source: https://learn.omacom.io/2/the-omarchy-manual/"
    echo ""

    cd "$SCRAPER_DIR"
    source "$VENV_DIR/bin/activate"

    python3 scrape_and_build_omarchy.py \
        --root https://learn.omacom.io/2/the-omarchy-manual/ \
        --out "$CORPUS_DIR" \
        --wait 1.0 \
        --max-pages 200

    if [ ! -f "$CORPUS_DIR/index.jsonl" ]; then
        echo ""
        echo "❌ Corpus generation failed!"
        exit 1
    fi

    CHUNK_COUNT=$(wc -l < "$CORPUS_DIR/index.jsonl")
    echo ""
    echo "✅ Corpus generated successfully"
    echo "   • $CHUNK_COUNT chunks indexed"
fi

# Final instructions
echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                    Setup Complete!                                ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Summary:"
echo "   • Python environment: ✅"
echo "   • Node.js dependencies: ✅"
echo "   • Corpus ($CHUNK_COUNT chunks): ✅"
echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                   Next Steps                                      ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""
echo "1️⃣  Add MCP to Claude Code:"
echo ""
echo "   claude mcp add --transport stdio omarchy-manual \\"
echo "     --env CORPUS_INDEX=$CORPUS_DIR/index.jsonl \\"
echo "     -- npx tsx $MCP_DIR/src/server.ts"
echo ""
echo "2️⃣  Restart Claude Code"
echo ""
echo "3️⃣  Test with:"
echo "   \"Search the omarchy manual for shortcuts\""
echo ""
echo "📖 Documentation:"
echo "   • README.md - Project overview"
echo "   • mcp-server/GetStarted.md - Detailed guide"
echo "   • UPDATING.md - How to update corpus"
echo ""
echo "✨ You're all set! Happy searching!"
echo ""
