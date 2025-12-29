/**
 * ScreenToSpace - Window Placement Handler
 * 
 * Handles window placement logic and workspace reordering.
 * Implements the core functionality of moving windows to empty workspaces.
 * 
 * @author DilZhaan
 * @license GPL-2.0-or-later
 */

import { ExtensionConstants } from './constants.js';
import GLib from 'gi://GLib';

/**
 * Handles placing windows on appropriate workspaces
 */
export class WindowPlacementHandler {
    constructor(workspaceManager, settings) {
        this._workspaceManager = workspaceManager;
        this._settings = settings;
        this._placedWindows = new Map();
        this._pendingOperations = new Set();
    }

    /**
     * Places a window on a new workspace if needed
     * @param {Object} window - Meta window object
     */
    placeWindowOnWorkspace(window) {
        if (!window) {
            return;
        }

        const windowId = window.get_id();
        
        if (this._pendingOperations.has(windowId)) {
            return;
        }

        this._pendingOperations.add(windowId);

        try {
            this._placeWindowOnWorkspaceInternal(window);
        } finally {
            this._pendingOperations.delete(windowId);
        }
    }

    _placeWindowOnWorkspaceInternal(window) {
        const monitor = window.get_monitor();
        const currentWorkspace = window.get_workspace();
        const otherWindows = this._getOtherWindowsOnMonitor(currentWorkspace, window, monitor);
        
        if (otherWindows.length === 0) {
            return;
        }

        const manager = window.get_display().get_workspace_manager();
        const currentIndex = currentWorkspace.index();
        
        if (this._workspaceManager.isWorkspacesOnlyOnPrimary()) {
            this._handlePrimaryMonitorPlacement(window, manager, currentIndex, monitor, otherWindows);
        } else {
            this._handleMultiMonitorPlacement(window, manager, currentIndex, monitor, otherWindows);
        }
    }

    /**
     * Returns a window to its previous workspace
     * @param {Object} window - Meta window object
     */
    returnWindowToOldWorkspace(window) {
        if (!window) {
            return;
        }

        const windowId = window.get_id();

        if (this._pendingOperations.has(windowId)) {
            return;
        }

        const placedInfo = this._placedWindows.get(windowId);
        if (!placedInfo) {
            return;
        }

        this._pendingOperations.add(windowId);

        try {
            this._placedWindows.delete(windowId);
            this._returnWindowToHomeWorkspace(window, placedInfo);
        } finally {
            this._pendingOperations.delete(windowId);
        }
    }

    /**
     * Handles window being destroyed/closed
     * Returns to home workspace if window was placed by extension
     * @param {Object} window - Meta window object
     */
    handleWindowDestroyed(window) {
        if (!window) {
            return;
        }

        const windowId = window.get_id();
        const placedInfo = this._placedWindows.get(windowId);
        
        // Clean up tracking
        this._placedWindows.delete(windowId);
        this._pendingOperations.delete(windowId);

        // If this window was moved by us, return to the original workspace
        if (placedInfo) {
            this._returnToHomeWorkspaceOnClose(placedInfo);
        }
    }

    /**
     * Returns to home workspace when a placed window is closed
     * @private
     */
    _returnToHomeWorkspaceOnClose(placedInfo) {
        const manager = global.display.get_workspace_manager();
        const homeIndex = placedInfo.homeWorkspaceIndex;
        const workspaceCount = manager.get_n_workspaces();

        // Validate home workspace still exists
        if (homeIndex >= 0 && homeIndex < workspaceCount) {
            const homeWorkspace = manager.get_workspace_by_index(homeIndex);
            if (homeWorkspace) {
                // Switch back to original workspace
                homeWorkspace.activate(global.get_current_time());
            }
        }
    }

    /**
     * Marks a window as placed on a new workspace
     * @param {Object} window - Meta window object
     * @param {number} homeWorkspaceIndex - Index of the original workspace
     */
    markWindowAsPlaced(window, homeWorkspaceIndex) {
        const windowId = window.get_id();
        this._placedWindows.set(windowId, {
            homeWorkspaceIndex: homeWorkspaceIndex,
        });
    }

    forgetWindow(window) {
        if (!window) {
            return;
        }

        const windowId = window.get_id();
        this._placedWindows.delete(windowId);
        this._pendingOperations.delete(windowId);
    }

    _returnWindowToHomeWorkspace(window, placedInfo) {
        const manager = window.get_display().get_workspace_manager();
        const homeIndex = placedInfo.homeWorkspaceIndex;

        const workspaceCount = manager.get_n_workspaces();
        if (homeIndex >= 0 && homeIndex < workspaceCount) {
            const homeWorkspace = manager.get_workspace_by_index(homeIndex);
            if (homeWorkspace) {
                this._moveWindowToWorkspace(window, homeIndex, manager);
                return;
            }
        }

        this._returnWindowUsingFallback(window, manager);
    }

    /**
     * Moves a window to a workspace and activates it
     * @private
     */
    _moveWindowToWorkspace(window, targetIndex, manager) {
        const workspaceCount = manager.get_n_workspaces();
        if (targetIndex < 0 || targetIndex >= workspaceCount) {
            return false;
        }

        window.change_workspace_by_index(targetIndex, false);
        const targetWorkspace = manager.get_workspace_by_index(targetIndex);
        targetWorkspace.activate(global.get_current_time());
        this._focusMovedWindow(window);
        return true;
    }

    _focusMovedWindow(window) {
        if (!window) {
            return;
        }

        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                try {
                    const time = global.get_current_time();
                    window.activate(time);
                    window.raise();
                } catch (error) {
                    // Window may have been destroyed
                }
                return GLib.SOURCE_REMOVE;
            });
            return GLib.SOURCE_REMOVE;
        });
    }

    _returnWindowUsingFallback(window, manager) {
        const monitor = window.get_monitor();
        const currentWorkspace = window.get_workspace();
        const otherWindows = this._getOtherWindowsOnMonitor(currentWorkspace, window, monitor);

        if (otherWindows.length > 0) {
            this._focusMovedWindow(window);
            return;
        }

        const currentIndex = currentWorkspace.index();
        if (this._workspaceManager.isWorkspacesOnlyOnPrimary()) {
            this._handlePrimaryMonitorReturn(window, manager, currentIndex, monitor);
        } else {
            this._handleMultiMonitorReturn(window, manager, currentIndex, monitor);
        }
    }

    /**
     * Gets other windows on the same monitor in a workspace
     * @private
     */
    _getOtherWindowsOnMonitor(workspace, excludeWindow, monitor) {
        return workspace.list_windows().filter(w => 
            w !== excludeWindow && 
            !w.is_always_on_all_workspaces() && 
            w.get_monitor() === monitor
        );
    }

    /**
     * Handles placement when workspaces are only on primary monitor
     * @private
     */
    _handlePrimaryMonitorPlacement(window, manager, currentIndex, monitor, otherWindows) {
        const primaryMonitor = window.get_display().get_primary_monitor();
        
        if (monitor !== primaryMonitor) {
            return;
        }

        const firstFree = this._workspaceManager.getFirstFreeWorkspace(manager, monitor);
        
        if (firstFree === -1) {
            return;
        }

        this._reorderWorkspaces(manager, currentIndex, firstFree, otherWindows);
        this.markWindowAsPlaced(window, currentIndex);
    }

    /**
     * Handles placement for multi-monitor setup
     * @private
     */
    _handleMultiMonitorPlacement(window, manager, currentIndex, monitor, otherWindows) {
        const firstFree = this._workspaceManager.getFirstFreeWorkspace(manager, monitor);
        
        if (firstFree === -1) {
            return;
        }

        const currentWindows = window.get_workspace().list_windows()
            .filter(w => w !== window && !w.is_always_on_all_workspaces());
        const freeWorkspaceWindows = manager.get_workspace_by_index(firstFree).list_windows()
            .filter(w => w !== window && !w.is_always_on_all_workspaces());

        this._reorderWorkspaces(manager, currentIndex, firstFree, currentWindows);
        
        freeWorkspaceWindows.forEach(w => {
            w.change_workspace_by_index(firstFree, false);
        });
        
        this.markWindowAsPlaced(window, currentIndex);
    }

    /**
     * Handles return when workspaces are only on primary monitor
     * @private
     */
    _handlePrimaryMonitorReturn(window, manager, currentIndex, monitor) {
        const primaryMonitor = window.get_display().get_primary_monitor();
        
        if (monitor !== primaryMonitor) {
            return;
        }

        const lastOccupied = this._workspaceManager.getLastOccupiedWorkspace(manager, currentIndex, monitor);
        
        if (lastOccupied === -1) {
            return;
        }

        const occupiedWindows = this._getOtherWindowsOnMonitor(
            manager.get_workspace_by_index(lastOccupied), 
            window, 
            monitor
        );

        manager.reorder_workspace(manager.get_workspace_by_index(currentIndex), lastOccupied);
        occupiedWindows.forEach(w => w.change_workspace_by_index(lastOccupied, false));
    }

    /**
     * Handles return for multi-monitor setup
     * @private
     */
    _handleMultiMonitorReturn(window, manager, currentIndex, monitor) {
        const lastOccupied = this._workspaceManager.getLastOccupiedWorkspace(manager, currentIndex, monitor);
        
        if (lastOccupied === -1) {
            return;
        }

        const currentWindows = window.get_workspace().list_windows()
            .filter(w => w !== window && !w.is_always_on_all_workspaces());
        
        if (currentWindows.length > 0) {
            return;
        }

        const occupiedWindows = manager.get_workspace_by_index(lastOccupied).list_windows()
            .filter(w => w !== window && !w.is_always_on_all_workspaces());

        manager.reorder_workspace(manager.get_workspace_by_index(currentIndex), lastOccupied);
        occupiedWindows.forEach(w => w.change_workspace_by_index(lastOccupied, false));
    }

    /**
     * Reorders workspaces and moves windows
     * @private
     */
    _reorderWorkspaces(manager, currentIndex, targetIndex, windows) {
        if (currentIndex < targetIndex) {
            manager.reorder_workspace(manager.get_workspace_by_index(targetIndex), currentIndex);
            manager.reorder_workspace(manager.get_workspace_by_index(currentIndex + 1), targetIndex);
            windows.forEach(w => w.change_workspace_by_index(currentIndex, false));
        } else if (currentIndex > targetIndex) {
            manager.reorder_workspace(manager.get_workspace_by_index(currentIndex), targetIndex);
            manager.reorder_workspace(manager.get_workspace_by_index(targetIndex + 1), currentIndex);
            windows.forEach(w => w.change_workspace_by_index(currentIndex, false));
        }
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this._placedWindows.clear();
        this._pendingOperations.clear();
        this._workspaceManager = null;
        this._settings = null;
    }
}
