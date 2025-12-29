/**
 * ScreenToSpace - Window Filter
 * 
 * Determines which windows should be managed by the extension.
 * Implements filtering logic based on window state and settings.
 * 
 * @author DilZhaan
 * @license GPL-2.0-or-later
 */

import Meta from 'gi://Meta';
import { ExtensionConstants } from './constants.js';

const DEBUG = false;

function log_debug(msg) {
    if (DEBUG) {
        console.log(`[ScreenToSpace] ${msg}`);
    }
}

/**
 * Filters and validates windows for placement
 */
export class WindowFilter {
    constructor(settings) {
        this._settings = settings;
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
            window.get_id();
            window.get_workspace();
            return true;
        } catch (error) {
            log_debug(`Window validation failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Checks if a window is a normal window (not dialog, popup, etc.)
     * @param {Object} window - Meta window object
     * @returns {boolean}
     */
    isNormalWindow(window) {
        if (!this._validateWindow(window)) {
            return false;
        }

        try {
            return window.window_type === Meta.WindowType.NORMAL && 
                   !window.is_always_on_all_workspaces();
        } catch (error) {
            log_debug(`Error checking if window is normal: ${error.message}`);
            return false;
        }
    }

    /**
     * Determines if this window should be managed based on type and app filters
     * @param {Object} window - Meta window object
     * @returns {boolean}
     */
    isManagedWindow(window) {
        if (!this._validateWindow(window)) {
            return false;
        }

        try {
            return this.isNormalWindow(window) && this._isAppAllowed(window);
        } catch (error) {
            log_debug(`Error checking if window is managed: ${error.message}`);
            return false;
        }
    }

    /**
     * Checks if a window should be placed on a new workspace
     * @param {Object} window - Meta window object
     * @returns {boolean}
     */
    shouldPlaceOnNewWorkspace(window) {
        if (!this.isManagedWindow(window)) {
            return false;
        }

        try {
            const triggerOnMaximize = this._getTriggerOnMaximizeEnabled();
            const triggerOnFullscreen = this._getTriggerOnFullscreenEnabled();

            return (triggerOnMaximize && window.is_maximized()) ||
                   (triggerOnFullscreen && window.fullscreen);
        } catch (error) {
            log_debug(`Error checking if window should be placed: ${error.message}`);
            return false;
        }
    }

    /**
     * Checks if a size change warrants placing on new workspace
     * @param {Object} window - Meta window object
     * @param {Meta.SizeChange} change - The type of size change
     * @returns {boolean}
     */
    shouldPlaceOnSizeChange(window, change) {
        if (!this.isManagedWindow(window)) {
            return false;
        }

        try {
            const triggerOnMaximize = this._getTriggerOnMaximizeEnabled();
            const triggerOnFullscreen = this._getTriggerOnFullscreenEnabled();

            const isMaximizing = triggerOnMaximize &&
                                change === Meta.SizeChange.MAXIMIZE &&
                                window.is_maximized();
            const isFullscreening = triggerOnFullscreen &&
                                   change === Meta.SizeChange.FULLSCREEN;

            return isMaximizing || isFullscreening;
        } catch (error) {
            log_debug(`Error checking size change: ${error.message}`);
            return false;
        }
    }

    /**
     * Checks if a size change warrants returning to old workspace
     * @param {Object} window - Meta window object
     * @param {Meta.SizeChange} change - The type of size change
     * @param {Meta.Rectangle} oldRect - Previous window rectangle
     * @returns {boolean}
     */
    shouldReturnOnSizeChange(window, change, oldRect) {
        if (!this.isManagedWindow(window)) {
            return false;
        }

        try {
            const workArea = window.get_work_area_for_monitor(window.get_monitor());

            const triggerOnMaximize = this._getTriggerOnMaximizeEnabled();
            const triggerOnFullscreen = this._getTriggerOnFullscreenEnabled();
            
            const isUnmaximizing = triggerOnMaximize && 
                                  change === Meta.SizeChange.UNMAXIMIZE &&
                                  workArea.equal(oldRect);
            
            const isUnfullscreening = triggerOnFullscreen &&
                                     change === Meta.SizeChange.UNFULLSCREEN &&
                                     (!triggerOnMaximize || !window.is_maximized());

            return isUnmaximizing || isUnfullscreening;
        } catch (error) {
            log_debug(`Error checking return condition: ${error.message}`);
            return false;
        }
    }

    /**
     * Returns whether maximize should trigger moving.
     * @private
     * @returns {boolean}
     */
    _getTriggerOnMaximizeEnabled() {
        try {
            const schema = this._settings?.settings_schema;
            if (schema?.has_key?.(ExtensionConstants.SETTING_TRIGGER_ON_MAXIMIZE)) {
                return this._settings.get_boolean(ExtensionConstants.SETTING_TRIGGER_ON_MAXIMIZE);
            }

            // Backward-compatible fallback
            return this._settings.get_boolean(ExtensionConstants.SETTING_MOVE_WHEN_MAXIMIZED);
        } catch (error) {
            log_debug(`Error getting maximize trigger setting: ${error.message}`);
            return true; // Default to enabled
        }
    }

    /**
     * Returns whether fullscreen should trigger moving.
     * @private
     * @returns {boolean}
     */
    _getTriggerOnFullscreenEnabled() {
        try {
            const schema = this._settings?.settings_schema;
            if (schema?.has_key?.(ExtensionConstants.SETTING_TRIGGER_ON_FULLSCREEN)) {
                return this._settings.get_boolean(ExtensionConstants.SETTING_TRIGGER_ON_FULLSCREEN);
            }

            // Backward-compatible fallback: fullscreen always moved
            return true;
        } catch (error) {
            log_debug(`Error getting fullscreen trigger setting: ${error.message}`);
            return true; // Default to enabled
        }
    }

    /**
     * Checks if the window's app is allowed based on filter mode and lists
     * @private
     * @param {Object} window - Meta window object
     * @returns {boolean}
     */
    _isAppAllowed(window) {
        try {
            const mode = this._settings.get_string(ExtensionConstants.SETTING_FILTER_MODE);
            const normalizeId = (id) => {
                if (!id) {
                    return null;
                }

                const lower = id.toLowerCase();
                return lower.endsWith('.desktop') ? lower.slice(0, -8) : lower;
            };

            const toNormalizedSet = (list) => {
                const set = new Set();
                list.forEach(id => {
                    const normalized = normalizeId(id);
                    if (normalized) {
                        set.add(normalized);
                    }
                });
                return set;
            };

            const blacklist = toNormalizedSet(this._settings.get_strv(ExtensionConstants.SETTING_BLACKLIST_APPS));
            const whitelist = toNormalizedSet(this._settings.get_strv(ExtensionConstants.SETTING_WHITELIST_APPS));

            const appId = normalizeId(this._getWindowAppId(window));

            if (mode === 'whitelist') {
                if (whitelist.size === 0) {
                    return false;
                }

                return appId ? whitelist.has(appId) : false;
            }

            if (mode === 'blacklist') {
                if (!appId) {
                    return true;
                }

                return !blacklist.has(appId);
            }

            return true;
        } catch (error) {
            log_debug(`Error checking if app is allowed: ${error.message}`);
            return true; // Default to allowing the app
        }
    }

    /**
     * Tries to resolve an application identifier for a window
     * @private
     * @param {Object} window - Meta window object
     * @returns {string|null}
     */
    _getWindowAppId(window) {
        const candidates = [
            window.get_gtk_application_id?.(),
            window.get_wm_class_instance?.(),
            window.get_wm_class?.(),
        ];

        for (const id of candidates) {
            if (id && typeof id === 'string' && id.trim().length > 0) {
                return id.trim();
            }
        }

        return null;
    }

    /**
     * Updates settings reference
     * @param {Object} settings - New settings object
     */
    updateSettings(settings) {
        this._settings = settings;
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this._settings = null;
    }
}
