/**
 * ScreenToSpace - GNOME Shell Extension
 * 
 * Automatically moves maximized and fullscreen windows to empty workspaces.
 * Provides a clean, organized workspace experience for multi-tasking users.
 * 
 * @author DilZhaan
 * @copyright 2025 DilZhaan
 * @license GPL-2.0-or-later
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 */

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { WorkspaceManager } from './workspaceManager.js';
import { WindowPlacementHandler } from './windowPlacement.js';
import { WindowFilter } from './windowFilter.js';
import { WindowEventHandler } from './eventHandler.js';
import { ExtensionConstants } from './constants.js';

/**
 * Main extension class implementing the ScreenToSpace functionality
 * 
 * Architecture:
 * - WorkspaceManager: Handles workspace discovery and queries
 * - WindowPlacementHandler: Manages window placement logic
 * - WindowFilter: Determines which windows to manage
 * - WindowEventHandler: Coordinates window events
 */
export default class ScreenToSpaceExtension extends Extension {
    /**
     * Called when the extension is enabled
     */
    enable() {
        this._initializeComponents();
        this._connectSignals();
    }

    /**
     * Called when the extension is disabled
     */
    disable() {
        this._disconnectSignals();
        this._cleanupComponents();
    }

    /**
     * Initialize all extension components
     * @private
     */
    _initializeComponents() {
        this._settings = this.getSettings();
        this._migrateTriggerSettings(this._settings);
        this._workspaceManager = new WorkspaceManager();
        this._placementHandler = new WindowPlacementHandler(this._workspaceManager, this._settings);
        this._windowFilter = new WindowFilter(this._settings);
        this._eventHandler = new WindowEventHandler(this._windowFilter, this._placementHandler, this._settings);
        this._signalHandles = [];
    }

    _migrateTriggerSettings(settings) {
        const schema = settings?.settings_schema;
        if (!schema?.has_key?.(ExtensionConstants.SETTING_TRIGGERS_MIGRATED) ||
            !schema?.has_key?.(ExtensionConstants.SETTING_TRIGGER_ON_MAXIMIZE) ||
            !schema?.has_key?.(ExtensionConstants.SETTING_TRIGGER_ON_FULLSCREEN)) {
            return;
        }

        if (settings.get_boolean(ExtensionConstants.SETTING_TRIGGERS_MIGRATED)) {
            return;
        }

        // Legacy behavior:
        // - move-window-when-maximized = true  => maximize + fullscreen
        // - move-window-when-maximized = false => fullscreen only
        const legacyMaximize = schema.has_key(ExtensionConstants.SETTING_MOVE_WHEN_MAXIMIZED)
            ? settings.get_boolean(ExtensionConstants.SETTING_MOVE_WHEN_MAXIMIZED)
            : true;

        settings.set_boolean(ExtensionConstants.SETTING_TRIGGER_ON_MAXIMIZE, legacyMaximize);
        settings.set_boolean(ExtensionConstants.SETTING_TRIGGER_ON_FULLSCREEN, true);
        settings.set_boolean(ExtensionConstants.SETTING_TRIGGERS_MIGRATED, true);
    }

    /**
     * Connect to window manager signals
     * @private
     */
    _connectSignals() {
        const wm = global.window_manager;
        const C = ExtensionConstants;
        
        this._signalHandles = [
            wm.connect(C.SIGNAL_MAP, (_, actor) => this._eventHandler.onWindowMap(actor)),
            wm.connect(C.SIGNAL_DESTROY, (_, actor) => this._eventHandler.onWindowDestroy(actor)),
            wm.connect(C.SIGNAL_UNMINIMIZE, (_, actor) => this._eventHandler.onWindowUnminimize(actor)),
            wm.connect(C.SIGNAL_MINIMIZE, (_, actor) => this._eventHandler.onWindowMinimize(actor)),
            wm.connect(C.SIGNAL_SIZE_CHANGE, (_, actor, change, oldRect) => 
                this._eventHandler.onWindowSizeChange(actor, change, oldRect)),
            wm.connect(C.SIGNAL_SIZE_CHANGED, (_, actor) => 
                this._eventHandler.onWindowSizeChanged(actor)),
            wm.connect(C.SIGNAL_SWITCH_WORKSPACE, () => 
                this._eventHandler.onWorkspaceSwitch()),
        ];
    }

    /**
     * Disconnect all window manager signals
     * @private
     */
    _disconnectSignals() {
        const wm = global.window_manager;
        
        this._signalHandles.forEach(handle => wm.disconnect(handle));
        this._signalHandles = [];
    }

    /**
     * Cleanup all extension components
     * @private
     */
    _cleanupComponents() {
        if (this._eventHandler) {
            this._eventHandler.destroy();
            this._eventHandler = null;
        }
        
        if (this._windowFilter) {
            this._windowFilter.destroy();
            this._windowFilter = null;
        }
        
        if (this._placementHandler) {
            this._placementHandler.destroy();
            this._placementHandler = null;
        }
        
        if (this._workspaceManager) {
            this._workspaceManager.destroy();
            this._workspaceManager = null;
        }
        
        this._settings = null;
    }
}
