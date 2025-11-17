/**
 * ScreenToSpace - Workspace Manager
 * 
 * Handles workspace discovery and management operations.
 * Follows Single Responsibility Principle by focusing only on workspace-related operations.
 * 
 * @author DilZhaan
 * @license GPL-2.0-or-later
 */

import Gio from 'gi://Gio';

/**
 * Manages workspace discovery and queries
 */
export class WorkspaceManager {
    constructor() {
        this._mutterSettings = new Gio.Settings({ schema_id: 'org.gnome.mutter' });
    }

    /**
     * Finds the first workspace with no windows on the specified monitor
     * @param {Object} manager - Workspace manager instance
     * @param {number} monitor - Monitor index
     * @returns {number} Workspace index or -1 if none found
     */
    getFirstFreeWorkspace(manager, monitor) {
        const workspaceCount = manager.get_n_workspaces();
        
        for (let i = 0; i < workspaceCount; i++) {
            const workspace = manager.get_workspace_by_index(i);
            const windowCount = this._getWindowCountOnMonitor(workspace, monitor);
            
            if (windowCount === 0) {
                return i;
            }
        }
        
        return -1;
    }
    
    /**
     * Finds the last occupied workspace on the specified monitor
     * @param {Object} manager - Workspace manager instance
     * @param {number} currentIndex - Current workspace index
     * @param {number} monitor - Monitor index
     * @returns {number} Workspace index or -1 if none found
     */
    getLastOccupiedWorkspace(manager, currentIndex, monitor) {
        // Search backwards from current
        for (let i = currentIndex - 1; i >= 0; i--) {
            const workspace = manager.get_workspace_by_index(i);
            const windowCount = this._getWindowCountOnMonitor(workspace, monitor);
            
            if (windowCount > 0) {
                return i;
            }
        }
        
        // Search forwards from current
        const workspaceCount = manager.get_n_workspaces();
        for (let i = currentIndex + 1; i < workspaceCount; i++) {
            const workspace = manager.get_workspace_by_index(i);
            const windowCount = this._getWindowCountOnMonitor(workspace, monitor);
            
            if (windowCount > 0) {
                return i;
            }
        }
        
        return -1;
    }

    /**
     * Checks if workspaces are only on primary monitor
     * @returns {boolean}
     */
    isWorkspacesOnlyOnPrimary() {
        return this._mutterSettings.get_boolean('workspaces-only-on-primary');
    }

    /**
     * Gets count of windows on a specific monitor in a workspace
     * @private
     */
    _getWindowCountOnMonitor(workspace, monitor) {
        return workspace.list_windows()
            .filter(w => !w.is_always_on_all_workspaces() && w.get_monitor() === monitor)
            .length;
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this._mutterSettings = null;
    }
}
