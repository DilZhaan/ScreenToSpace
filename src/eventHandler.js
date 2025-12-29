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

const DEBUG = false;

function log_debug(msg) {
    if (DEBUG) {
        console.log(`[ScreenToSpace] ${msg}`);
    }
}

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
     * Safely gets a window from an actor
     * @private
     */
    _getWindowFromActor(actor) {
        if (!actor) {
            return null;
        }

        try {
            const window = actor.meta_window;
            if (!window) {
                return null;
            }

            // Validate window is still usable
            window.get_id();
            return window;
        } catch (error) {
            log_debug(`Error getting window from actor: ${error.message}`);
            return null;
        }
    }

    /**
     * Handles window map event (new window)
     * @param {Object} actor - Window actor
     */
    onWindowMap(actor) {
        const window = this._getWindowFromActor(actor);
        if (!window) {
            return;
        }

        try {
            log_debug(`Window mapped: ${window.get_id()}`);
            
            if (this._windowFilter.shouldPlaceOnNewWorkspace(window)) {
                this._placementHandler.placeWindowOnWorkspace(window);
            }
        } catch (error) {
            console.error(`[ScreenToSpace] Error in onWindowMap: ${error.message}`);
        }
    }

    /**
     * Handles window destroy event
     * @param {Object} actor - Window actor
     */
    onWindowDestroy(actor) {
        const window = this._getWindowFromActor(actor);
        if (!window) {
            return;
        }

        try {
            const windowId = window.get_id();
            log_debug(`Window destroyed: ${windowId}`);
            
            // Clean up pending actions
            this._pendingActions.delete(windowId);
            
            if (!this._windowFilter.isManagedWindow(window)) {
                return;
            }

            // On destroy we only clean up state; we don't move/reorder anything.
            if (typeof this._placementHandler.forgetWindow === 'function') {
                this._placementHandler.forgetWindow(window);
            }
        } catch (error) {
            log_debug(`Error in onWindowDestroy: ${error.message}`);
        }
    }

    /**
     * Handles window unminimize event
     * @param {Object} actor - Window actor
     */
    onWindowUnminimize(actor) {
        const window = this._getWindowFromActor(actor);
        if (!window) {
            return;
        }

        try {
            log_debug(`Window unminimized: ${window.get_id()}`);
            
            if (this._windowFilter.shouldPlaceOnNewWorkspace(window)) {
                this._placementHandler.placeWindowOnWorkspace(window);
            }
        } catch (error) {
            console.error(`[ScreenToSpace] Error in onWindowUnminimize: ${error.message}`);
        }
    }

    /**
     * Handles window minimize event
     * @param {Object} actor - Window actor
     */
    onWindowMinimize(actor) {
        const window = this._getWindowFromActor(actor);
        if (!window) {
            return;
        }

        try {
            log_debug(`Window minimized: ${window.get_id()}`);
            
            if (!this._windowFilter.isManagedWindow(window)) {
                return;
            }
            
            this._placementHandler.returnWindowToOldWorkspace(window);
        } catch (error) {
            console.error(`[ScreenToSpace] Error in onWindowMinimize: ${error.message}`);
        }
    }

    /**
     * Handles window size change event (during change)
     * @param {Object} actor - Window actor
     * @param {Meta.SizeChange} change - Type of size change
     * @param {Meta.Rectangle} oldRect - Previous window rectangle
     */
    onWindowSizeChange(actor, change, oldRect) {
        const window = this._getWindowFromActor(actor);
        if (!window) {
            return;
        }

        try {
            const windowId = window.get_id();
            log_debug(`Window size change: ${windowId}, change: ${change}`);

            // Holding the configured override modifier bypasses ScreenToSpace,
            // allowing GNOME's default maximize/fullscreen behavior.
            if (this._shouldBypassForOverrideModifier(change)) {
                log_debug('Override modifier detected, bypassing');
                return;
            }
            
            if (this._windowFilter.shouldPlaceOnSizeChange(window, change)) {
                this._pendingActions.set(windowId, ExtensionConstants.MARKER_PLACE);
                log_debug(`Pending action PLACE for window ${windowId}`);
            } else if (this._windowFilter.shouldReturnOnSizeChange(window, change, oldRect)) {
                this._pendingActions.set(windowId, ExtensionConstants.MARKER_BACK);
                log_debug(`Pending action BACK for window ${windowId}`);
            }
        } catch (error) {
            console.error(`[ScreenToSpace] Error in onWindowSizeChange: ${error.message}`);
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
        const window = this._getWindowFromActor(actor);
        if (!window) {
            return;
        }

        try {
            const windowId = window.get_id();
            
            if (!this._pendingActions.has(windowId)) {
                return;
            }

            const action = this._pendingActions.get(windowId);
            this._pendingActions.delete(windowId);

            log_debug(`Window size changed: ${windowId}, executing action: ${action}`);

            if (action === ExtensionConstants.MARKER_PLACE) {
                this._placementHandler.placeWindowOnWorkspace(window);
            } else if (action === ExtensionConstants.MARKER_BACK) {
                this._placementHandler.returnWindowToOldWorkspace(window);
            }
        } catch (error) {
            console.error(`[ScreenToSpace] Error in onWindowSizeChanged: ${error.message}`);
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
