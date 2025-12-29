# Changelog

## Version 10 - Reliability & Maintainability Refactor

### Major Improvements

#### Reliability Fixes
- **Fixed workspace reference tracking**: Now uses workspace indices instead of object references, preventing issues when workspaces are dynamically created/destroyed
- **Eliminated race conditions**: Added operation locking to prevent concurrent operations on the same window
- **Improved focus reliability**: Enhanced window focusing with double idle callbacks for better timing
- **Better error recovery**: Comprehensive error handling prevents extension crashes and provides graceful degradation

#### Code Quality
- **Comprehensive error handling**: All critical operations wrapped in try-catch blocks with proper logging
- **Window validation**: Added validation checks before all window operations to prevent crashes
- **Better data structures**: Changed from plain objects to Map/Set for better performance and semantics
- **Debug logging**: Added extensive debug logging throughout (can be enabled by setting DEBUG flag)
- **Improved documentation**: Better inline comments and JSDoc annotations

#### Specific Fixes
- Fixed issue where windows could get stuck when rapidly maximizing/unmaximizing
- Fixed crashes when windows are destroyed during workspace transitions
- Fixed unreliable window focusing after workspace changes
- Fixed issues with dynamic workspace configurations
- Fixed potential memory leaks with proper cleanup

### Technical Changes

#### windowPlacement.js
- Store workspace indices instead of object references
- Added `_pendingOperations` Set to prevent concurrent operations
- Added `_validateWindow()` for safety checks
- Enhanced `_moveWindowToWorkspace()` with validation
- Improved `_focusMovedWindow()` with double idle callbacks
- Changed `_placedWindows` from object to Map

#### eventHandler.js
- Added `_getWindowFromActor()` for safe window extraction
- Wrapped all event handlers in try-catch blocks
- Added comprehensive debug logging
- Changed `_pendingActions` from object to Map
- Clean up pending actions on window destroy

#### windowFilter.js
- Added `_validateWindow()` checks before all operations
- Try-catch blocks around all filter logic
- Safe defaults on errors

#### workspaceManager.js
- Added null checks for manager and workspace objects
- Try-catch blocks around all workspace queries
- Safe defaults on error conditions

#### New Files
- **utils.js**: Centralized utility functions for logging and validation

### Backward Compatibility
- All changes are backward compatible
- No changes to settings schema
- Existing user configurations continue to work
- Migration logic for old settings preserved

### For Developers
- Enable debug mode by setting `DEBUG = true` in source files
- Better error messages for troubleshooting
- Clearer code structure for easier maintenance
- See REFACTORING_NOTES.md for detailed technical documentation

---

## Version 9 and Earlier
See git history for previous changes.

