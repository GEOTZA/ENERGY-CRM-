#!/bin/bash

# Local Verification Script for App.jsx
# Run this BEFORE deploying to verify you have the correct file

echo "═══════════════════════════════════════════════════════════════"
echo "  App.jsx Local Verification Script"
echo "═══════════════════════════════════════════════════════════════"
echo ""

ERRORS=0
WARNINGS=0

# Check if we're in the right directory
if [ ! -f "src/App.jsx" ]; then
    echo "❌ ERROR: src/App.jsx not found!"
    echo "   Make sure you're in the project root (energy-crm/)"
    exit 1
fi

echo "✅ Found src/App.jsx"
echo ""

# Check file size
FILE_SIZE=$(wc -c < src/App.jsx)
FILE_SIZE_KB=$((FILE_SIZE / 1024))

echo "📊 File Statistics:"
echo "   Size: ${FILE_SIZE_KB}KB"

if [ "$FILE_SIZE_KB" -lt 100 ] || [ "$FILE_SIZE_KB" -gt 150 ]; then
    echo "   ⚠️  WARNING: Expected ~132KB, got ${FILE_SIZE_KB}KB"
    WARNINGS=$((WARNINGS + 1))
fi

# Check line count
LINE_COUNT=$(wc -l < src/App.jsx)
echo "   Lines: $LINE_COUNT"

if [ "$LINE_COUNT" -lt 3100 ] || [ "$LINE_COUNT" -gt 3300 ]; then
    echo "   ⚠️  WARNING: Expected ~3216 lines, got $LINE_COUNT"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""

# Check first line
FIRST_LINE=$(head -1 src/App.jsx)
echo "🔍 Checking First Line:"

if [[ "$FIRST_LINE" == "import React"* ]]; then
    echo "   ✅ CORRECT: $FIRST_LINE"
else
    echo "   ❌ ERROR: First line should be 'import React...'"
    echo "   Got: $FIRST_LINE"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# Check for common errors
echo "🔍 Checking for Common Errors:"

# Check for #import
if grep -q "^#import" src/App.jsx; then
    echo "   ❌ Found '#import' (should be 'import')"
    ERRORS=$((ERRORS + 1))
else
    echo "   ✅ No '#import' found"
fi

# Check for double braces
if grep -q "{{user.role" src/App.jsx; then
    echo "   ❌ Found double braces '{{' (should be single '{')"
    ERRORS=$((ERRORS + 1))
else
    echo "   ✅ No double braces found"
fi

# Count nav tags
NAV_OPENS=$(grep -c "<nav" src/App.jsx)
NAV_CLOSES=$(grep -c "</nav>" src/App.jsx)

echo ""
echo "🔍 Checking JSX Structure:"
echo "   <nav> opens: $NAV_OPENS"
echo "   </nav> closes: $NAV_CLOSES"

if [ "$NAV_OPENS" -eq "$NAV_CLOSES" ]; then
    echo "   ✅ Nav tags balanced"
else
    echo "   ❌ Nav tags MISMATCH!"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  SUMMARY"
echo "═══════════════════════════════════════════════════════════════"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "✅ ALL CHECKS PASSED!"
    echo ""
    echo "Your App.jsx file is CORRECT and ready to deploy!"
    echo ""
    echo "Next steps:"
    echo "  1. npm run build"
    echo "  2. git add src/App.jsx"
    echo "  3. git commit -m \"Deploy verified version\""
    echo "  4. git push origin main"
    echo ""
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  $WARNINGS WARNING(S) found"
    echo ""
    echo "File should work, but double-check the warnings above."
    echo ""
    exit 0
else
    echo "❌ $ERRORS ERROR(S) found"
    if [ $WARNINGS -gt 0 ]; then
        echo "⚠️  $WARNINGS WARNING(S) found"
    fi
    echo ""
    echo "❌ DO NOT DEPLOY!"
    echo ""
    echo "You have the WRONG file!"
    echo ""
    echo "Fix:"
    echo "  1. Download App-FINAL-VERIFIED.jsx from Claude"
    echo "  2. Replace src/App.jsx with it"
    echo "  3. Run this script again"
    echo ""
    exit 1
fi
