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

/**
 * Filters and validates windows for placement
 */
export class WindowFilter {
    constructor(settings) {
        this._settings = settings;
    }

    /**
     * Checks if a window is a normal window (not dialog, popup, etc.)
     * @param {Object} window - Meta window object
     * @returns {boolean}
     */
    isNormalWindow(window) {
        return window.window_type === Meta.WindowType.NORMAL && 
               !window.is_always_on_all_workspaces();
    }

    /**
     * Determines if this window should be managed based on type and app filters
     * @param {Object} window - Meta window object
     * @returns {boolean}
     */
    isManagedWindow(window) {
        return this.isNormalWindow(window) && this._isAppAllowed(window);
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

        if (this._isMaximizeEnabled()) {
            return window.is_maximized();
        }
        
        return window.fullscreen;
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

        const isMaximizing = this._isMaximizeEnabled() && 
                            change === Meta.SizeChange.MAXIMIZE && 
                            window.is_maximized();
        const isFullscreening = change === Meta.SizeChange.FULLSCREEN;

        return isMaximizing || isFullscreening;
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

        const workArea = window.get_work_area_for_monitor(window.get_monitor());
        
        const isUnmaximizing = this._isMaximizeEnabled() && 
                              change === Meta.SizeChange.UNMAXIMIZE &&
                              workArea.equal(oldRect);
        
        const isUnfullscreening = change === Meta.SizeChange.UNFULLSCREEN &&
                                 (this._isMaximizeEnabled() ? window.is_maximized() : true);

        return isUnmaximizing || isUnfullscreening;
    }

    /**
     * Checks if maximize feature is enabled in settings
     * @private
     * @returns {boolean}
     */
    _isMaximizeEnabled() {
        return this._settings.get_boolean(ExtensionConstants.SETTING_MOVE_WHEN_MAXIMIZED);
    }

    /**
     * Checks if the window's app is allowed based on filter mode and lists
     * @private
     * @param {Object} window - Meta window object
     * @returns {boolean}
     */
    _isAppAllowed(window) {
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
