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
import { ExtensionConstants } from './constants.js';

const DEBUG = false;

function log_debug(msg) {
    if (DEBUG) {
        console.log(`[ScreenToSpace] ${msg}`);
    }
}

/**
 * Manages workspace discovery and queries
 */
export class WorkspaceManager {
    constructor() {
        try {
            this._mutterSettings = new Gio.Settings({ 
                schema_id: ExtensionConstants.SCHEMA_MUTTER 
            });
        } catch (error) {
            console.error(`[ScreenToSpace] Error initializing workspace manager: ${error.message}`);
            this._mutterSettings = null;
        }
    }

    /**
     * Finds the first workspace with no windows on the specified monitor
     * @param {Object} manager - Workspace manager instance
     * @param {number} monitor - Monitor index
     * @returns {number} Workspace index or -1 if none found
     */
    getFirstFreeWorkspace(manager, monitor) {
        if (!manager) {
            log_debug('Invalid workspace manager');
            return -1;
        }

        try {
            const workspaceCount = manager.get_n_workspaces();
            
            for (let i = 0; i < workspaceCount; i++) {
                const workspace = manager.get_workspace_by_index(i);
                if (!workspace) {
                    continue;
                }

                const windowCount = this._getWindowCountOnMonitor(workspace, monitor);
                
                if (windowCount === 0) {
                    log_debug(`First free workspace: ${i}`);
                    return i;
                }
            }
            
            log_debug('No free workspace found');
            return -1;
        } catch (error) {
            console.error(`[ScreenToSpace] Error finding free workspace: ${error.message}`);
            return -1;
        }
    }

    /**
     * Finds the last workspace with no windows at all (across all monitors).
     * Useful for dynamic workspaces where an empty workspace exists at the end.
     * @param {Object} manager - Workspace manager instance
     * @returns {number} Workspace index or -1 if none found
     */
    getLastCompletelyEmptyWorkspace(manager) {
        if (!manager) {
            log_debug('Invalid workspace manager');
            return -1;
        }

        try {
            const workspaceCount = manager.get_n_workspaces();

            for (let i = workspaceCount - 1; i >= 0; i--) {
                const workspace = manager.get_workspace_by_index(i);
                if (!workspace) {
                    continue;
                }

                const hasWindows = workspace.list_windows()
                    .some(w => !w.is_always_on_all_workspaces());

                if (!hasWindows) {
                    log_debug(`Last empty workspace: ${i}`);
                    return i;
                }
            }

            log_debug('No completely empty workspace found');
            return -1;
        } catch (error) {
            console.error(`[ScreenToSpace] Error finding empty workspace: ${error.message}`);
            return -1;
        }
    }
    
    /**
     * Finds the last occupied workspace on the specified monitor
     * @param {Object} manager - Workspace manager instance
     * @param {number} currentIndex - Current workspace index
     * @param {number} monitor - Monitor index
     * @returns {number} Workspace index or -1 if none found
     */
    getLastOccupiedWorkspace(manager, currentIndex, monitor) {
        if (!manager) {
            log_debug('Invalid workspace manager');
            return -1;
        }

        try {
            // Search backwards from current
            for (let i = currentIndex - 1; i >= 0; i--) {
                const workspace = manager.get_workspace_by_index(i);
                if (!workspace) {
                    continue;
                }

                const windowCount = this._getWindowCountOnMonitor(workspace, monitor);
                
                if (windowCount > 0) {
                    log_debug(`Last occupied workspace (backwards): ${i}`);
                    return i;
                }
            }
            
            // Search forwards from current
            const workspaceCount = manager.get_n_workspaces();
            for (let i = currentIndex + 1; i < workspaceCount; i++) {
                const workspace = manager.get_workspace_by_index(i);
                if (!workspace) {
                    continue;
                }

                const windowCount = this._getWindowCountOnMonitor(workspace, monitor);
                
                if (windowCount > 0) {
                    log_debug(`Last occupied workspace (forwards): ${i}`);
                    return i;
                }
            }
            
            log_debug('No occupied workspace found');
            return -1;
        } catch (error) {
            console.error(`[ScreenToSpace] Error finding occupied workspace: ${error.message}`);
            return -1;
        }
    }

    /**
     * Checks if workspaces are only on primary monitor
     * @returns {boolean}
     */
    isWorkspacesOnlyOnPrimary() {
        if (!this._mutterSettings) {
            log_debug('Mutter settings not available');
            return false;
        }

        try {
            return this._mutterSettings.get_boolean(
                ExtensionConstants.SETTING_WORKSPACES_ONLY_PRIMARY
            );
        } catch (error) {
            log_debug(`Error checking workspaces-only-on-primary: ${error.message}`);
            return false;
        }
    }

    /**
     * Gets count of windows on a specific monitor in a workspace
     * @private
     */
    _getWindowCountOnMonitor(workspace, monitor) {
        if (!workspace) {
            return 0;
        }

        try {
            return workspace.list_windows()
                .filter(w => {
                    try {
                        return !w.is_always_on_all_workspaces() && w.get_monitor() === monitor;
                    } catch (error) {
                        log_debug(`Error filtering window: ${error.message}`);
                        return false;
                    }
                })
                .length;
        } catch (error) {
            log_debug(`Error getting window count: ${error.message}`);
            return 0;
        }
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this._mutterSettings = null;
    }
}
