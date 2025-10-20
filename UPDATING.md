# Updating the Corpus

When the Omarchy manual documentation is updated online, you'll want to refresh your local corpus to get the latest content.

## Quick Update (Recommended)

Use the automated update script:

```bash
cd /path/to/omarchy-mcp-search
./update-corpus.sh
```

This will:
1. ✅ Backup your existing corpus
2. ✅ Re-scrape the Omarchy manual
3. ✅ Create new corpus with latest content
4. ✅ Show statistics and next steps

**Then restart Claude Code** to load the new corpus.

---

## Manual Update

If you prefer to do it manually:

### 1. Backup Existing Corpus

```bash
cd /path/to/omarchy-mcp-search
mv corpus corpus.backup-$(date +%Y%m%d)
```

### 2. Activate Python Environment

```bash
cd scraper
source .venv/bin/activate
```

### 3. Run Scraper

```bash
python3 scrape_and_build_omarchy.py \
  --root https://learn.omacom.io/2/the-omarchy-manual/ \
  --out ../corpus \
  --wait 1.0 \
  --max-pages 100
```

### 4. Verify

```bash
# Check corpus was created
ls -lh ../corpus/index.jsonl

# Count chunks
wc -l ../corpus/index.jsonl
```

### 5. Restart Claude Code

**Quit Claude Code completely and restart it.**

The MCP server will automatically load the new corpus on startup.

### 6. Test

Ask Claude Code:
```
"Search the omarchy manual for shortcuts"
```

You should see the latest documentation in the results.

---

## Automation Options

### Option 1: Cron Job (Daily Update)

Add to your crontab:

```bash
# Edit crontab
crontab -e

# Add this line (runs daily at 3 AM)
0 3 * * * /path/to/omarchy-mcp-search/update-corpus.sh >> /tmp/omarchy-update.log 2>&1
```

**Note:** You'll still need to restart Claude Code manually after updates.

### Option 2: Weekly Update (Recommended)

```bash
# Edit crontab
crontab -e

# Add this line (runs every Monday at 3 AM)
0 3 * * 1 /path/to/omarchy-mcp-search/update-corpus.sh >> /tmp/omarchy-update.log 2>&1
```

Check the log:
```bash
tail -f /tmp/omarchy-update.log
```

### Option 3: On-Demand with Notification

Create a desktop notification when update completes:

```bash
./update-corpus.sh && notify-send "Omarchy Corpus" "Update complete! Restart Claude Code."
```

### Option 4: Git Hook (Pre-Commit)

Update corpus before committing changes:

```bash
# Create pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Check if manual update is needed (optional)
echo "Checking corpus freshness..."
# Add your logic here
EOF

chmod +x .git/hooks/pre-commit
```

---

## How the MCP Server Loads the Corpus

The MCP server reads the corpus **once at startup**:

```typescript
// From src/server.ts
const chunks: Chunk[] = fs
  .readFileSync(INDEX_PATH, "utf-8")
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l));
```

This means:
- ✅ **Fast**: Loads all data into memory on startup
- ✅ **Efficient**: No disk reads during searches
- ⚠️ **Requires restart**: Changes only take effect after Claude Code restart

**You must restart Claude Code** after updating the corpus.

---

## Troubleshooting

### Update Script Fails

**Check virtualenv exists:**
```bash
cd scraper
ls -la .venv/
```

If not found:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**Check internet connection:**
```bash
curl -I https://learn.omacom.io/2/the-omarchy-manual/
```

**Increase wait time if rate-limited:**
```bash
# Edit scraper command in update-corpus.sh
--wait 2.0  # Instead of 1.0
```

### MCP Not Picking Up Changes

**1. Verify corpus was updated:**
```bash
ls -lh corpus/index.jsonl
# Check modification time
```

**2. Check MCP is using correct path:**
```bash
claude mcp get omarchy-manual
# Look for CORPUS_INDEX environment variable
```

**3. Restart Claude Code properly:**
- Quit completely (not just close window)
- Wait 5 seconds
- Restart
- Check MCP connection: `claude mcp list`

**4. Check server logs:**
```bash
# MCP server logs to stderr
# Look for "Loaded X chunks" message
```

### Corpus Seems Incomplete

**Check scraping log:**
```bash
# If using update script, check output
./update-corpus.sh | tee update.log
```

**Increase max pages:**
```bash
# Edit update-corpus.sh
--max-pages 200  # Instead of 100
```

**Verify page count:**
```bash
ls corpus/pages/ | wc -l
```

### Backups Taking Too Much Space

**Clean old backups:**
```bash
# Keep only last 3 backups
cd /path/to/omarchy-mcp-search
ls -dt corpus.backup-* | tail -n +4 | xargs rm -rf

# Or remove all backups
rm -rf corpus.backup-*
```

---

## Update Frequency Recommendations

| Frequency | When to Use |
|-----------|-------------|
| **Manual (as needed)** | Best for most users |
| **Weekly** | If docs update frequently |
| **Monthly** | For stable documentation |
| **Never** | If you only need a snapshot |

The Omarchy manual doesn't change very often, so **manual updates when needed** is usually best.

---

## Checking for Documentation Updates

### Manual Check

Visit the manual and check for changes:
```
https://learn.omacom.io/2/the-omarchy-manual/
```

### Automated Check (Advanced)

Create a simple change detector:

```bash
#!/bin/bash
# check-updates.sh
CURRENT_HASH=$(curl -s https://learn.omacom.io/2/the-omarchy-manual/ | md5sum)
STORED_HASH=$(cat /tmp/omarchy-hash 2>/dev/null)

if [ "$CURRENT_HASH" != "$STORED_HASH" ]; then
    echo "Documentation has changed!"
    echo "$CURRENT_HASH" > /tmp/omarchy-hash
    # Run update script
    /path/to/omarchy-mcp-search/update-corpus.sh
else
    echo "No changes detected"
fi
```

---

## Quick Reference

| Task | Command |
|------|---------|
| **Update corpus** | `./update-corpus.sh` |
| **Manual update** | `cd scraper && source .venv/bin/activate && python3 scrape_and_build_omarchy.py --out ../corpus` |
| **Check corpus** | `wc -l corpus/index.jsonl` |
| **List backups** | `ls -lh corpus.backup-*` |
| **Clean backups** | `rm -rf corpus.backup-*` |
| **Restart MCP** | Quit and restart Claude Code |
| **Test search** | Ask Claude: "search omarchy manual for hotkeys" |

---

## What Gets Updated

When you re-scrape:
- ✅ New pages added to manual
- ✅ Updated content in existing pages
- ✅ Removed pages deleted from manual
- ✅ Changed page titles/headings
- ✅ New sections and documentation

The MCP server's code (synonyms, search logic) stays the same unless you update the code itself.

---

## Advanced: Partial Updates

Currently, the scraper does a **full re-scrape** each time. For faster partial updates, you could:

1. Track page modification dates
2. Only re-scrape changed pages
3. Merge with existing corpus

This would require custom scripting. For most use cases, the full re-scrape (100 pages in ~2 minutes) is fast enough.

---

**Remember:** Always restart Claude Code after updating the corpus!
