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

/**
 * Handles placing windows on appropriate workspaces
 */
export class WindowPlacementHandler {
    constructor(workspaceManager) {
        this._workspaceManager = workspaceManager;
        this._placedWindows = {};
    }

    /**
     * Places a window on a new workspace if needed
     * @param {Object} window - Meta window object
     */
    placeWindowOnWorkspace(window) {
        const monitor = window.get_monitor();
        const currentWorkspace = window.get_workspace();
        const otherWindows = this._getOtherWindowsOnMonitor(currentWorkspace, window, monitor);
        
        if (otherWindows.length === 0) {
            return;
        }

        const manager = window.get_display().get_workspace_manager();
        const currentIndex = manager.get_active_workspace_index();
        
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
        const windowId = window.get_id();
        
        if (!this._placedWindows[windowId]) {
            return;
        }
        
        delete this._placedWindows[windowId];

        const monitor = window.get_monitor();
        const currentWorkspace = window.get_workspace();
        const otherWindows = this._getOtherWindowsOnMonitor(currentWorkspace, window, monitor);
        
        if (otherWindows.length > 0) {
            return;
        }

        const manager = window.get_display().get_workspace_manager();
        const currentIndex = manager.get_active_workspace_index();
        
        if (this._workspaceManager.isWorkspacesOnlyOnPrimary()) {
            this._handlePrimaryMonitorReturn(window, manager, currentIndex, monitor);
        } else {
            this._handleMultiMonitorReturn(window, manager, currentIndex, monitor);
        }
    }

    /**
     * Marks a window as placed on a new workspace
     * @param {Object} window - Meta window object
     */
    markWindowAsPlaced(window) {
        this._placedWindows[window.get_id()] = ExtensionConstants.MARKER_REORDER;
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
        this.markWindowAsPlaced(window);
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
        
        // Restore windows to their original positions
        freeWorkspaceWindows.forEach(w => w.change_workspace_by_index(firstFree, false));
        
        this.markWindowAsPlaced(window);
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
        this._placedWindows = {};
        this._workspaceManager = null;
    }
}
