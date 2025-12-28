/**
 * ScreenToSpace - Constants
 * 
 * Centralized constants for the extension.
 * All string literals and magic values should be defined here.
 * 
 * @author DilZhaan
 * @license GPL-2.0-or-later
 */

export const ExtensionConstants = {
    // Settings keys
    SETTING_MOVE_WHEN_MAXIMIZED: 'move-window-when-maximized',
    SETTING_TRIGGER_ON_MAXIMIZE: 'trigger-on-maximize',
    SETTING_TRIGGER_ON_FULLSCREEN: 'trigger-on-fullscreen',
    SETTING_OVERRIDE_MODIFIER: 'override-modifier',
    SETTING_TRIGGERS_MIGRATED: 'triggers-migrated',
    SETTING_INSERT_AFTER_CURRENT: 'insert-workspace-after-current',
    SETTING_FILTER_MODE: 'filter-mode',
    SETTING_BLACKLIST_APPS: 'blacklist-apps',
    SETTING_WHITELIST_APPS: 'whitelist-apps',
    
    // Window placement markers
    MARKER_REORDER: 'reorder',
    MARKER_PLACE: 'place',
    MARKER_BACK: 'back',
    
    // Window manager signal names
    SIGNAL_MAP: 'map',
    SIGNAL_DESTROY: 'destroy',
    SIGNAL_UNMINIMIZE: 'unminimize',
    SIGNAL_MINIMIZE: 'minimize',
    SIGNAL_SIZE_CHANGE: 'size-change',
    SIGNAL_SIZE_CHANGED: 'size-changed',
    SIGNAL_SWITCH_WORKSPACE: 'switch-workspace',
    
    // GSettings schema IDs
    SCHEMA_MUTTER: 'org.gnome.mutter',
    SCHEMA_SCREENTOSPACE: 'org.gnome.shell.extensions.screentospace',
    
    // Settings keys (mutter)
    SETTING_WORKSPACES_ONLY_PRIMARY: 'workspaces-only-on-primary',
    
    // Extension metadata
    NAME: 'ScreenToSpace',
    AUTHOR: 'DilZhaan',
    URL: 'https://github.com/DilZhaan/ScreenToSpace',
    UUID: 'screentospace@dilzhan.dev',
    DOMAIN: 'screentospace',
};
