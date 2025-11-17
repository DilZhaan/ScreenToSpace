#!/bin/bash

# Script to add logo icon to ScreenToSpace extension

echo "🎨 Adding Logo to ScreenToSpace Extension"
echo "=========================================="
echo ""

# Find the logo file
LOGO_FILE="Gemini_Generated_Image_12nvbi12nvbi12nv-removebg-preview.svg"
DEST_FILE="src/icon.svg"

# Check common locations
if [ -f "$LOGO_FILE" ]; then
    SOURCE_PATH="$LOGO_FILE"
elif [ -f "$HOME/Downloads/$LOGO_FILE" ]; then
    SOURCE_PATH="$HOME/Downloads/$LOGO_FILE"
elif [ -f "$HOME/Desktop/$LOGO_FILE" ]; then
    SOURCE_PATH="$HOME/Desktop/$LOGO_FILE"
else
    echo "❌ Cannot find logo file: $LOGO_FILE"
    echo ""
    echo "Please run this command manually:"
    echo "  cp /path/to/$LOGO_FILE $DEST_FILE"
    echo ""
    echo "Where /path/to/ is where you saved the file (Downloads, Desktop, etc.)"
    exit 1
fi

echo "✓ Found logo file: $SOURCE_PATH"

# Copy the file
cp "$SOURCE_PATH" "$DEST_FILE"

if [ $? -eq 0 ]; then
    echo "✓ Logo copied to: $DEST_FILE"
else
    echo "❌ Failed to copy logo file"
    exit 1
fi

# Verify the file exists
if [ -f "$DEST_FILE" ]; then
    FILE_SIZE=$(du -h "$DEST_FILE" | cut -f1)
    echo "✓ Icon file size: $FILE_SIZE"
else
    echo "❌ Icon file not found after copy"
    exit 1
fi

echo ""
echo "✅ Icon added successfully!"
echo ""
echo "Next steps:"
echo "  1. Rebuild extension:  ./scripts/makezip.sh"
echo "  2. Deploy locally:     ./scripts/deploy.sh"
echo "  3. Test it:            gnome-extensions prefs screentospace@dilzhan.dev"
echo "  4. Commit changes:     git add src/icon.svg src/metadata.json"
echo "  5. Push to GitHub:     git push origin main"
echo ""
echo "The icon will appear in GNOME Extensions app! 🎉"
