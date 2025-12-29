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

const DEBUG = false;

function log_debug(msg) {
    if (DEBUG) {
        console.log(`[ScreenToSpace] ${msg}`);
    }
}

/**
 * Handles placing windows on appropriate workspaces
 */
export class WindowPlacementHandler {
    constructor(workspaceManager, settings) {
        this._workspaceManager = workspaceManager;
        this._settings = settings;
        // Store workspace indices instead of object references for reliability
        this._placedWindows = new Map();
        this._pendingOperations = new Set();
    }

    /**
     * Places a window on a new workspace if needed
     * @param {Object} window - Meta window object
     */
    placeWindowOnWorkspace(window) {
        if (!this._validateWindow(window)) {
            log_debug('Invalid window for placement');
            return;
        }

        const windowId = window.get_id();
        
        // Prevent concurrent operations on the same window
        if (this._pendingOperations.has(windowId)) {
            log_debug(`Operation already pending for window ${windowId}`);
            return;
        }

        this._pendingOperations.add(windowId);

        try {
            this._placeWindowOnWorkspaceInternal(window);
        } catch (error) {
            console.error(`[ScreenToSpace] Error placing window: ${error.message}`);
        } finally {
            this._pendingOperations.delete(windowId);
        }
    }

    _placeWindowOnWorkspaceInternal(window) {
        const monitor = window.get_monitor();
        const currentWorkspace = window.get_workspace();
        const otherWindows = this._getOtherWindowsOnMonitor(currentWorkspace, window, monitor);
        
        if (otherWindows.length === 0) {
            log_debug('No other windows on workspace, not moving');
            return;
        }

        const manager = window.get_display().get_workspace_manager();
        const currentIndex = currentWorkspace.index();

        log_debug(`Placing window ${window.get_id()} from workspace ${currentIndex}`);

        if (this._isInsertAfterCurrentEnabled()) {
            this._placeWindowByInsertingAfterCurrent(window, manager, currentIndex);
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
        if (!this._validateWindow(window)) {
            log_debug('Invalid window for return');
            return;
        }

        const windowId = window.get_id();

        // Prevent concurrent operations
        if (this._pendingOperations.has(windowId)) {
            log_debug(`Operation already pending for window ${windowId}`);
            return;
        }

        const placedInfo = this._placedWindows.get(windowId);
        if (!placedInfo) {
            log_debug(`No placement info for window ${windowId}`);
            return;
        }

        this._pendingOperations.add(windowId);

        try {
            this._placedWindows.delete(windowId);
            this._returnWindowToHomeWorkspaceOrFallback(window, placedInfo);
        } catch (error) {
            console.error(`[ScreenToSpace] Error returning window: ${error.message}`);
        } finally {
            this._pendingOperations.delete(windowId);
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
            mode: 'reorder',
            homeWorkspaceIndex: homeWorkspaceIndex,
            timestamp: Date.now(),
        });
        log_debug(`Marked window ${windowId} as placed, home: ${homeWorkspaceIndex}`);
    }

    forgetWindow(window) {
        if (!window) {
            return;
        }

        const windowId = window.get_id();
        this._placedWindows.delete(windowId);
        log_debug(`Forgot window ${windowId}`);
    }

    /**
     * Validates that a window is in a usable state
     * @private
     */
    _validateWindow(window) {
        if (!window) {
            return false;
        }

        try {
            // Check if window still exists and has necessary methods
            const id = window.get_id();
            const workspace = window.get_workspace();
            return id !== undefined && workspace !== null;
        } catch (error) {
            log_debug(`Window validation failed: ${error.message}`);
            return false;
        }
    }

    _isInsertAfterCurrentEnabled() {
        const settings = this._settings;
        const schema = settings?.settings_schema;
        if (!schema?.has_key?.(ExtensionConstants.SETTING_INSERT_AFTER_CURRENT)) {
            return false;
        }

        return settings.get_boolean(ExtensionConstants.SETTING_INSERT_AFTER_CURRENT);
    }

    _placeWindowByInsertingAfterCurrent(window, manager, originalIndex) {
        const workspaceCount = manager.get_n_workspaces();
        if (originalIndex >= workspaceCount - 1) {
            log_debug('Already at last workspace');
            return;
        }

        const monitor = window.get_monitor();
        
        // First try to find a completely empty workspace
        let emptyIndex = this._workspaceManager.getLastCompletelyEmptyWorkspace(manager);
        
        // If no completely empty workspace, find one that's empty on this monitor
        if (emptyIndex === -1) {
            log_debug('No completely empty workspace, looking for monitor-specific empty workspace');
            emptyIndex = this._workspaceManager.getFirstFreeWorkspace(manager, monitor);
        }
        
        if (emptyIndex === -1) {
            log_debug('No empty workspace found on monitor');
            // Fall back to regular placement logic
            const otherWindows = this._getOtherWindowsOnMonitor(window.get_workspace(), window, monitor);
            if (this._workspaceManager.isWorkspacesOnlyOnPrimary()) {
                this._handlePrimaryMonitorPlacement(window, manager, originalIndex, monitor, otherWindows);
            } else {
                this._handleMultiMonitorPlacement(window, manager, originalIndex, monitor, otherWindows);
            }
            return;
        }

        const targetIndex = originalIndex + 1;

        const emptyWorkspace = manager.get_workspace_by_index(emptyIndex);
        if (emptyIndex !== targetIndex) {
            manager.reorder_workspace(emptyWorkspace, targetIndex);
        }

        const finalTargetIndex = emptyWorkspace.index();
        this._moveWindowToWorkspace(window, finalTargetIndex, manager);

        const windowId = window.get_id();
        this._placedWindows.set(windowId, {
            mode: 'insert',
            homeWorkspaceIndex: originalIndex,
            timestamp: Date.now(),
        });
        log_debug(`Inserted workspace after current, window ${windowId} to ${finalTargetIndex}, home: ${originalIndex}`);
    }

    _returnWindowToHomeWorkspaceOrFallback(window, placedInfo) {
        const manager = window.get_display().get_workspace_manager();
        const homeIndex = placedInfo.homeWorkspaceIndex;

        log_debug(`Returning window ${window.get_id()} to home workspace ${homeIndex}`);

        // Validate that the home workspace still exists
        const workspaceCount = manager.get_n_workspaces();
        if (homeIndex >= 0 && homeIndex < workspaceCount) {
            const homeWorkspace = manager.get_workspace_by_index(homeIndex);
            if (homeWorkspace) {
                log_debug(`Home workspace ${homeIndex} still exists, moving back`);
                this._moveWindowToWorkspace(window, homeIndex, manager);
                return;
            }
        }

        // Original workspace was likely removed (dynamic workspaces).
        // Fall back to finding an appropriate workspace
        log_debug('Home workspace no longer exists, using fallback logic');
        this._returnWindowUsingFallbackLogic(window, manager);
    }

    /**
     * Moves a window to a workspace and activates it
     * @private
     */
    _moveWindowToWorkspace(window, targetIndex, manager) {
        if (!this._validateWindow(window)) {
            log_debug('Cannot move invalid window');
            return false;
        }

        const workspaceCount = manager.get_n_workspaces();
        if (targetIndex < 0 || targetIndex >= workspaceCount) {
            log_debug(`Invalid target workspace index: ${targetIndex}`);
            return false;
        }

        try {
            window.change_workspace_by_index(targetIndex, false);
            const targetWorkspace = manager.get_workspace_by_index(targetIndex);
            targetWorkspace.activate(global.get_current_time());
            this._focusMovedWindow(window);
            log_debug(`Moved window ${window.get_id()} to workspace ${targetIndex}`);
            return true;
        } catch (error) {
            console.error(`[ScreenToSpace] Error moving window: ${error.message}`);
            return false;
        }
    }

    _focusMovedWindow(window) {
        if (!window) {
            return;
        }

        // Focusing immediately after workspace changes can be racy.
        // Using double idle callbacks makes this much more reliable.
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                if (!this._validateWindow(window)) {
                    return GLib.SOURCE_REMOVE;
                }

                try {
                    const time = typeof global.get_current_time === 'function'
                        ? global.get_current_time()
                        : 0;

                    if (typeof window.activate === 'function') {
                        window.activate(time);
                    }

                    if (typeof window.raise === 'function') {
                        window.raise();
                    }

                    log_debug(`Focused window ${window.get_id()}`);
                } catch (error) {
                    log_debug(`Error focusing window: ${error.message}`);
                }

                return GLib.SOURCE_REMOVE;
            });
            return GLib.SOURCE_REMOVE;
        });
    }

    _returnWindowUsingFallbackLogic(window, manager) {
        const monitor = window.get_monitor();
        const currentWorkspace = window.get_workspace();
        const otherWindows = this._getOtherWindowsOnMonitor(currentWorkspace, window, monitor);

        // If there are other windows, stay on current workspace
        if (otherWindows.length > 0) {
            log_debug('Other windows present, not returning to previous workspace');
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
            log_debug('Window not on primary monitor');
            return;
        }

        const firstFree = this._workspaceManager.getFirstFreeWorkspace(manager, monitor);
        
        if (firstFree === -1) {
            log_debug('No free workspace found');
            return;
        }

        this._reorderWorkspaces(manager, currentIndex, firstFree, otherWindows);

        // Store the index instead of the workspace object
        this.markWindowAsPlaced(window, currentIndex);
    }

    /**
     * Handles placement for multi-monitor setup
     * @private
     */
    _handleMultiMonitorPlacement(window, manager, currentIndex, monitor, otherWindows) {
        const firstFree = this._workspaceManager.getFirstFreeWorkspace(manager, monitor);
        
        if (firstFree === -1) {
            log_debug('No free workspace found');
            return;
        }

        const currentWindows = window.get_workspace().list_windows()
            .filter(w => w !== window && !w.is_always_on_all_workspaces());
        const freeWorkspaceWindows = manager.get_workspace_by_index(firstFree).list_windows()
            .filter(w => w !== window && !w.is_always_on_all_workspaces());

        this._reorderWorkspaces(manager, currentIndex, firstFree, currentWindows);
        
        // Restore windows to their original positions
        freeWorkspaceWindows.forEach(w => {
            try {
                w.change_workspace_by_index(firstFree, false);
            } catch (error) {
                log_debug(`Error restoring window: ${error.message}`);
            }
        });
        
        // Store the index instead of the workspace object
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
        try {
            if (currentIndex < targetIndex) {
                manager.reorder_workspace(manager.get_workspace_by_index(targetIndex), currentIndex);
                manager.reorder_workspace(manager.get_workspace_by_index(currentIndex + 1), targetIndex);
                windows.forEach(w => {
                    try {
                        w.change_workspace_by_index(currentIndex, false);
                    } catch (error) {
                        log_debug(`Error moving window during reorder: ${error.message}`);
                    }
                });
            } else if (currentIndex > targetIndex) {
                manager.reorder_workspace(manager.get_workspace_by_index(currentIndex), targetIndex);
                manager.reorder_workspace(manager.get_workspace_by_index(targetIndex + 1), currentIndex);
                windows.forEach(w => {
                    try {
                        w.change_workspace_by_index(currentIndex, false);
                    } catch (error) {
                        log_debug(`Error moving window during reorder: ${error.message}`);
                    }
                });
            }
            log_debug(`Reordered workspaces: current=${currentIndex}, target=${targetIndex}`);
        } catch (error) {
            console.error(`[ScreenToSpace] Error reordering workspaces: ${error.message}`);
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
