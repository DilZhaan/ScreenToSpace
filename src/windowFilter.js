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
     * Checks if a window should be placed on a new workspace
     * @param {Object} window - Meta window object
     * @returns {boolean}
     */
    shouldPlaceOnNewWorkspace(window) {
        if (!this.isNormalWindow(window)) {
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
        if (!this.isNormalWindow(window)) {
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
        if (!this.isNormalWindow(window)) {
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
        return this._settings.get_boolean('move-window-when-maximized');
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
