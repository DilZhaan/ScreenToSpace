#!/bin/bash

NAME=screentospace@dilzhan.dev
SRC_DIR=src
INSTALL_DIR="$HOME/.local/share/gnome-shell/extensions/$NAME"

echo "Deploying ScreenToSpace extension..."

# Remove old installation
if [ -d "$INSTALL_DIR" ]; then
    echo "Removing old installation..."
    rm -rf "$INSTALL_DIR"
fi

# Create extension directory
echo "Creating extension directory..."
mkdir -p "$INSTALL_DIR"

# Copy source files
echo "Copying extension files..."
cp -r "$SRC_DIR"/* "$INSTALL_DIR/"

# Compile schemas
echo "Compiling GSettings schema..."
cd "$INSTALL_DIR/schemas"
glib-compile-schemas .

echo "✓ Extension deployed successfully to: $INSTALL_DIR"
echo ""
echo "Next steps:"
echo "  1. Restart GNOME Shell:"
echo "     - X11: Alt+F2, type 'r', press Enter"
echo "     - Wayland: Log out and log back in"
echo "  2. Enable extension:"
echo "     gnome-extensions enable $NAME"
echo "  3. Check logs:"
echo "     journalctl -f -o cat /usr/bin/gnome-shell | grep screentospace"
