# ScreenToSpace

> **Intelligent Window Management for GNOME Shell 49+**

A GNOME Shell extension that automatically organizes your workspace by moving maximized and fullscreen windows to empty workspaces. Keep your workflow clean and organized with intelligent multi-monitor support.

[![License: GPL v2](https://img.shields.io/badge/License-GPL%20v2-blue.svg)](https://www.gnu.org/licenses/old-licenses/gpl-2.0.en.html)
[![GNOME Shell](https://img.shields.io/badge/GNOME%20Shell-49%2B-blue.svg)](https://www.gnome.org/)

---

## ✨ Features

- 🖥️ **Automatic Workspace Management**: Maximized and fullscreen windows automatically move to empty workspaces
- 🎯 **Smart Window Placement**: Intelligently reorders workspaces to maintain workflow continuity
- 🖼️ **Multi-Monitor Support**: Works seamlessly across multiple displays
- ⚙️ **Configurable Behavior**: Choose whether to move maximized windows, fullscreen windows, or both
- 🔄 **Dynamic Workspace Handling**: Automatically manages workspace creation and cleanup
- 🌐 **Internationalization Ready**: Built-in i18n support for multiple languages

---

## 📋 Requirements

- **GNOME Shell**: Version 49 or higher
- **Operating System**: Linux with GNOME desktop environment
- **Dependencies**: Standard GNOME Shell extensions dependencies

---

## 🚀 Installation

### Method 1: Manual Installation (Recommended for Development)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/DilZhaan/ScreenToSpace.git
   cd ScreenToSpace
   ```

2. **Deploy the extension**:
   ```bash
   chmod +x scripts/deploy.sh
   ./scripts/deploy.sh
   ```

3. **Restart GNOME Shell**:
   - On X11: Press `Alt + F2`, type `r`, and press Enter
   - On Wayland: Log out and log back in

4. **Enable the extension**:
   ```bash
   gnome-extensions enable screentospace@dilzhan.dev
   ```

### Method 2: Build and Install from ZIP

1. **Build the extension**:
   ```bash
   chmod +x scripts/makezip.sh
   ./scripts/makezip.sh
   ```

2. **Install the ZIP file**:
   ```bash
   gnome-extensions install build/screentospace@dilzhan.dev.zip
   ```

3. **Enable the extension**:
   ```bash
   gnome-extensions enable screentospace@dilzhan.dev
   ```

---

## ⚙️ Configuration

Access the extension preferences through:
- GNOME Extensions app → ScreenToSpace → Settings
- Command line: `gnome-extensions prefs screentospace@dilzhan.dev`

### Available Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Move Window When Maximized** | Automatically move maximized windows to empty workspaces. When enabled, both maximized and fullscreen windows are moved. When disabled, only fullscreen windows are moved. | ✅ Enabled |

---

## 🎯 How It Works

### Window Placement Strategy

1. **New Maximized/Fullscreen Window**:
   - Extension detects a window entering fullscreen or maximized state
   - Finds the first available empty workspace on the same monitor
   - Intelligently reorders workspaces to place the window without disrupting workflow
   - Other windows remain in their original positions

2. **Window Restore**:
   - When a window is un-maximized or exits fullscreen
   - If the workspace becomes empty, it's automatically reorganized
   - Window returns to the last occupied workspace on the same monitor

### Multi-Monitor Behavior

- **Workspaces Only on Primary**: Only the primary monitor has multiple workspaces; extension works exclusively on the primary display
- **Workspaces on All Monitors**: Extension manages workspaces independently for each monitor

---

## 🏗️ Architecture

This extension is built following SOLID principles with a modular, maintainable architecture:

```
src/
├── extension.js           # Main extension entry point
├── constants.js          # Centralized constants and strings (i18n ready)
├── eventHandler.js       # Window manager event handling (SRP)
├── windowFilter.js       # Window eligibility filtering (SRP)
├── windowPlacement.js    # Window placement logic (SRP)
├── workspaceManager.js   # Workspace operations (SRP)
├── i18n.js              # Internationalization utilities
├── prefs.js             # Preferences UI
└── schemas/             # GSettings schemas
    └── org.gnome.shell.extensions.screentospace.gschema.xml
```

### Key Design Principles

- **Single Responsibility Principle**: Each module handles one specific concern
- **Open/Closed Principle**: Extensible without modifying core logic
- **Dependency Inversion**: High-level modules don't depend on low-level details
- **Interface Segregation**: Clean, focused interfaces for each component
- **DRY (Don't Repeat Yourself)**: No code duplication, centralized logic

---

## 🐛 Troubleshooting

### Extension Not Loading

```bash
# Check extension status
gnome-extensions info screentospace@dilzhan.dev

# View GNOME Shell logs
journalctl -f -o cat /usr/bin/gnome-shell

# Reset extension settings
dconf reset -f /org/gnome/shell/extensions/screentospace/
```

### Schema Issues

If you encounter schema-related errors:

```bash
# Recompile schemas
glib-compile-schemas src/schemas/

# Or use the deploy script which handles this automatically
./scripts/deploy.sh
```

### Common Issues

1. **Extension not visible in Extensions app**:
   - Ensure GNOME Shell version is 49+: `gnome-shell --version`
   - Check if extension is installed: `gnome-extensions list`

2. **Windows not moving automatically**:
   - Verify extension is enabled: `gnome-extensions info screentospace@dilzhan.dev`
   - Check settings: `gnome-extensions prefs screentospace@dilzhan.dev`
   - Ensure dynamic workspaces are enabled in GNOME settings

3. **Multi-monitor issues**:
   - Check "Workspaces on primary display only" setting in GNOME Tweaks
   - Extension behavior adapts based on this system setting

---

## 🔧 Development

### Prerequisites for Development

```bash
# Install development dependencies
sudo apt-get install gettext glib-2.0-dev

# For Fedora/RHEL
sudo dnf install gettext glib2-devel
```

### Project Structure

```bash
ScreenToSpace/
├── src/              # Source code
├── po/               # Translations
├── scripts/          # Build and deployment scripts
├── build/            # Build output (generated)
├── LICENSE           # GPL-2.0 license
└── README.md         # This file
```

### Building from Source

```bash
# Build extension package
./scripts/makezip.sh

# Output: build/screentospace@dilzhan.dev.zip
```

### Testing Changes

```bash
# Deploy to local extensions directory
./scripts/deploy.sh

# Restart GNOME Shell (X11)
Alt + F2, type 'r', press Enter

# Watch logs for debugging
journalctl -f -o cat /usr/bin/gnome-shell | grep screentospace
```

### Code Style

- ES6+ JavaScript
- 4-space indentation
- Descriptive variable and function names
- JSDoc comments for public APIs
- Follow GNOME JavaScript style guidelines

---

## 📝 License

This project is licensed under the **GNU General Public License v2.0 or later** - see the [LICENSE](LICENSE) file for details.

```
Copyright (C) 2025 DilZhaan

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.
```

---

## 👤 Author

**DilZhaan**

- GitHub: [@DilZhaan](https://github.com/DilZhaan)
- Project: [ScreenToSpace](https://github.com/DilZhaan/ScreenToSpace)

---

## 🙏 Acknowledgments

This extension was developed from scratch following modern software engineering principles and GNOME Shell extension best practices.

---

## 📊 Project Status

**Status**: Active Development  
**Version**: 1  
**GNOME Shell Compatibility**: 49+

---

## 🗺️ Roadmap

- [ ] Add more workspace placement strategies
- [ ] Implement custom keyboard shortcuts
- [ ] Add workspace naming and organization features
- [ ] Create comprehensive test suite
- [ ] Add more language translations
- [ ] Integration with GNOME Activities overview

---

## 💬 Support

If you encounter any issues or have questions:

1. Check the [Troubleshooting](#-troubleshooting) section
2. Review [existing issues](https://github.com/DilZhaan/ScreenToSpace/issues)
3. Create a [new issue](https://github.com/DilZhaan/ScreenToSpace/issues/new) with detailed information

---

**Made with ❤️ by DilZhaan**

