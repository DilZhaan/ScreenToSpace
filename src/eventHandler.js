/**
 * ScreenToSpace - Event Handler
 * 
 * Manages window manager events and delegates to appropriate handlers.
 * Acts as a coordinator between window events and business logic.
 * 
 * @author DilZhaan
 * @license GPL-2.0-or-later
 */

import { ExtensionConstants } from './constants.js';
import Meta from 'gi://Meta';
import Clutter from 'gi://Clutter';

/**
 * Handles window manager events
 */
export class WindowEventHandler {
    constructor(windowFilter, placementHandler, settings) {
        this._windowFilter = windowFilter;
        this._placementHandler = placementHandler;
        this._settings = settings;
        this._pendingActions = new Map();
    }

    /**
     * Handles window map event (new window)
     * @param {Object} actor - Window actor
     */
    onWindowMap(actor) {
        const window = actor?.meta_window;
        if (!window) {
            return;
        }
        
        if (this._windowFilter.shouldPlaceOnNewWorkspace(window)) {
            this._placementHandler.placeWindowOnWorkspace(window);
        }
    }

    /**
     * Handles window destroy event
     * @param {Object} actor - Window actor
     */
    onWindowDestroy(actor) {
        const window = actor?.meta_window;
        if (!window) {
            return;
        }

        const windowId = window.get_id();
        this._pendingActions.delete(windowId);
        
        if (!this._windowFilter.isManagedWindow(window)) {
            return;
        }

        // Let placement handler decide if we need to return to home workspace
        this._placementHandler.handleWindowDestroyed(window);
    }

    /**
     * Handles window unminimize event
     * @param {Object} actor - Window actor
     */
    onWindowUnminimize(actor) {
        const window = actor?.meta_window;
        if (!window) {
            return;
        }
        
        if (this._windowFilter.shouldPlaceOnNewWorkspace(window)) {
            this._placementHandler.placeWindowOnWorkspace(window);
        }
    }

    /**
     * Handles window minimize event
     * @param {Object} actor - Window actor
     */
    onWindowMinimize(actor) {
        const window = actor?.meta_window;
        if (!window) {
            return;
        }
        
        if (!this._windowFilter.isManagedWindow(window)) {
            return;
        }
        
        this._placementHandler.returnWindowToOldWorkspace(window);
    }

    /**
     * Handles window size change event (during change)
     * @param {Object} actor - Window actor
     * @param {Meta.SizeChange} change - Type of size change
     * @param {Meta.Rectangle} oldRect - Previous window rectangle
     */
    onWindowSizeChange(actor, change, oldRect) {
        const window = actor?.meta_window;
        if (!window) {
            return;
        }

        const windowId = window.get_id();

        if (this._shouldBypassForOverrideModifier(change)) {
            return;
        }
        
        if (this._windowFilter.shouldPlaceOnSizeChange(window, change)) {
            this._pendingActions.set(windowId, ExtensionConstants.MARKER_PLACE);
        } else if (this._windowFilter.shouldReturnOnSizeChange(window, change, oldRect)) {
            this._pendingActions.set(windowId, ExtensionConstants.MARKER_BACK);
        }
    }

    _shouldBypassForOverrideModifier(change) {
        if (change !== Meta.SizeChange.MAXIMIZE && change !== Meta.SizeChange.FULLSCREEN) {
            return false;
        }

        return this._isOverrideModifierPressed();
    }

    _isOverrideModifierPressed() {
        const mask = this._getOverrideModifierMask();
        if (!mask) {
            return false;
        }

        if (typeof global.get_pointer !== 'function') {
            return false;
        }

        const pointer = global.get_pointer();
        const mods = Array.isArray(pointer) ? (pointer[2] || 0) : 0;
        return (mods & mask) !== 0;
    }

    _getOverrideModifierMask() {
        const settings = this._settings;
        const schema = settings?.settings_schema;
        if (!schema?.has_key?.(ExtensionConstants.SETTING_OVERRIDE_MODIFIER)) {
            return 0;
        }

        const choice = settings.get_string(ExtensionConstants.SETTING_OVERRIDE_MODIFIER);
        switch (choice) {
            case 'alt':
                return Clutter.ModifierType.MOD1_MASK;
            case 'super':
                return Clutter.ModifierType.SUPER_MASK;
            case 'ctrl':
                return Clutter.ModifierType.CONTROL_MASK;
            case 'shift':
                return Clutter.ModifierType.SHIFT_MASK;
            default:
                return 0;
        }
    }

    /**
     * Handles window size changed event (after change completed)
     * @param {Object} actor - Window actor
     */
    onWindowSizeChanged(actor) {
        const window = actor?.meta_window;
        if (!window) {
            return;
        }

        const windowId = window.get_id();
        
        if (!this._pendingActions.has(windowId)) {
            return;
        }

        const action = this._pendingActions.get(windowId);
        this._pendingActions.delete(windowId);

        if (action === ExtensionConstants.MARKER_PLACE) {
            this._placementHandler.placeWindowOnWorkspace(window);
        } else if (action === ExtensionConstants.MARKER_BACK) {
            this._placementHandler.returnWindowToOldWorkspace(window);
        }
    }

    /**
     * Handles workspace switch event
     */
    onWorkspaceSwitch() {
        // Reserved for future functionality
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this._pendingActions.clear();
        this._windowFilter = null;
        this._placementHandler = null;
        this._settings = null;
    }
}
