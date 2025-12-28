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
    constructor(workspaceManager, settings) {
        this._workspaceManager = workspaceManager;
        this._settings = settings;
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
        const currentIndex = currentWorkspace.index();

        if (this._isInsertAfterCurrentEnabled()) {
            this._placeWindowByInsertingAfterCurrent(window, manager, currentWorkspace, currentIndex);
            return;
        }
        
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

        const placedInfo = this._placedWindows[windowId];
        if (!placedInfo) {
            return;
        }

        delete this._placedWindows[windowId];
        this._returnWindowToHomeWorkspaceOrFallback(window, placedInfo);
    }

    /**
     * Marks a window as placed on a new workspace
     * @param {Object} window - Meta window object
     */
    markWindowAsPlaced(window, homeWorkspace) {
        this._placedWindows[window.get_id()] = {
            mode: 'reorder',
            marker: ExtensionConstants.MARKER_REORDER,
            homeWorkspace,
        };
    }

    forgetWindow(window) {
        if (!window) {
            return;
        }

        delete this._placedWindows[window.get_id()];
    }

    _isInsertAfterCurrentEnabled() {
        const settings = this._settings;
        const schema = settings?.settings_schema;
        if (!schema?.has_key?.(ExtensionConstants.SETTING_INSERT_AFTER_CURRENT)) {
            return false;
        }

        return settings.get_boolean(ExtensionConstants.SETTING_INSERT_AFTER_CURRENT);
    }

    _placeWindowByInsertingAfterCurrent(window, manager, originalWorkspace, originalIndex) {
        const workspaceCount = manager.get_n_workspaces();
        if (originalIndex >= workspaceCount - 1) {
            return;
        }

        const emptyIndex = this._workspaceManager.getLastCompletelyEmptyWorkspace(manager);
        if (emptyIndex === -1) {
            return;
        }

        const targetIndex = originalIndex + 1;

        const emptyWorkspace = manager.get_workspace_by_index(emptyIndex);
        if (emptyIndex !== targetIndex) {
            manager.reorder_workspace(emptyWorkspace, targetIndex);
        }

        const finalTargetIndex = emptyWorkspace.index();
        window.change_workspace_by_index(finalTargetIndex, false);
        manager.get_workspace_by_index(finalTargetIndex).activate(global.get_current_time());

        this._placedWindows[window.get_id()] = {
            mode: 'insert',
            homeWorkspace: originalWorkspace,
        };
    }

    _returnWindowToHomeWorkspaceOrFallback(window, placedInfo) {
        const manager = window.get_display().get_workspace_manager();
        const targetIndex = this._findWorkspaceIndexByIdentity(manager, placedInfo.homeWorkspace);

        if (targetIndex !== -1) {
            window.change_workspace_by_index(targetIndex, false);
            manager.get_workspace_by_index(targetIndex).activate(global.get_current_time());
            return;
        }

        // Original workspace was likely removed (dynamic workspaces).
        // Fall back to the existing restore heuristic without recreating anything.
        this._returnWindowUsingCurrentRestoreLogic(window, manager);
    }

    _findWorkspaceIndexByIdentity(manager, workspace) {
        if (!manager || !workspace) {
            return -1;
        }

        const count = manager.get_n_workspaces();
        for (let i = 0; i < count; i++) {
            if (manager.get_workspace_by_index(i) === workspace) {
                return i;
            }
        }

        return -1;
    }

    _returnWindowUsingCurrentRestoreLogic(window, manager) {
        const monitor = window.get_monitor();
        const currentWorkspace = window.get_workspace();
        const otherWindows = this._getOtherWindowsOnMonitor(currentWorkspace, window, monitor);

        if (otherWindows.length > 0) {
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

        // After reordering, the workspace at the original index is the "home" workspace
        // from the user's perspective (where other windows stayed).
        const homeWorkspace = manager.get_workspace_by_index(currentIndex);
        this.markWindowAsPlaced(window, homeWorkspace);
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
        
        const homeWorkspace = manager.get_workspace_by_index(currentIndex);
        this.markWindowAsPlaced(window, homeWorkspace);
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
        this._settings = null;
    }
}
