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

/**
 * Handles window manager events
 */
export class WindowEventHandler {
    constructor(windowFilter, placementHandler) {
        this._windowFilter = windowFilter;
        this._placementHandler = placementHandler;
        this._pendingActions = {};
    }

    /**
     * Handles window map event (new window)
     * @param {Object} actor - Window actor
     */
    onWindowMap(actor) {
        const window = actor.meta_window;
        
        if (this._windowFilter.shouldPlaceOnNewWorkspace(window)) {
            this._placementHandler.placeWindowOnWorkspace(window);
        }
    }

    /**
     * Handles window destroy event
     * @param {Object} actor - Window actor
     */
    onWindowDestroy(actor) {
        const window = actor.meta_window;
        
        if (!this._windowFilter.isNormalWindow(window)) {
            return;
        }
        
        this._placementHandler.returnWindowToOldWorkspace(window);
    }

    /**
     * Handles window unminimize event
     * @param {Object} actor - Window actor
     */
    onWindowUnminimize(actor) {
        const window = actor.meta_window;
        
        if (this._windowFilter.shouldPlaceOnNewWorkspace(window)) {
            this._placementHandler.placeWindowOnWorkspace(window);
        }
    }

    /**
     * Handles window minimize event
     * @param {Object} actor - Window actor
     */
    onWindowMinimize(actor) {
        const window = actor.meta_window;
        
        if (!this._windowFilter.isNormalWindow(window)) {
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
        const window = actor.meta_window;
        const windowId = window.get_id();
        
        if (this._windowFilter.shouldPlaceOnSizeChange(window, change)) {
            this._pendingActions[windowId] = ExtensionConstants.MARKER_PLACE;
        } else if (this._windowFilter.shouldReturnOnSizeChange(window, change, oldRect)) {
            this._pendingActions[windowId] = ExtensionConstants.MARKER_BACK;
        }
    }

    /**
     * Handles window size changed event (after change completed)
     * @param {Object} actor - Window actor
     */
    onWindowSizeChanged(actor) {
        const window = actor.meta_window;
        const windowId = window.get_id();
        
        if (!this._pendingActions[windowId]) {
            return;
        }

        const action = this._pendingActions[windowId];
        delete this._pendingActions[windowId];

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
        this._pendingActions = {};
        this._windowFilter = null;
        this._placementHandler = null;
    }
}
