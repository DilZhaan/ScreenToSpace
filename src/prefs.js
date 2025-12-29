/**
 * ScreenToSpace - Preferences
 * 
 * Provides the preferences UI for the extension settings.
 * 
 * @author DilZhaan
 * @copyright 2025 DilZhaan
 * @license GPL-2.0-or-later
 */

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { ExtensionConstants } from './constants.js';

/**
 * Preferences window for ScreenToSpace extension
 */
export default class ScreenToSpacePreferences extends ExtensionPreferences {
    /**
     * Fills the preferences window with settings
     * @param {Adw.PreferencesWindow} window - The preferences window
     */
    fillPreferencesWindow(window) {
        window._settings = this.getSettings();
        
        const behaviorPage = this._createBehaviorPage(window);
        const appListPage = this._createAppListPage(window);
        const aboutPage = this._createAboutPage();
        
        window.add(behaviorPage);
        window.add(appListPage);
        window.add(aboutPage);
    }

    /**
     * Creates the behavior settings page
     * @private
     * @param {Adw.PreferencesWindow} window - The preferences window
     * @returns {Adw.PreferencesPage} The behavior page
     */
    _createBehaviorPage(window) {
        const page = new Adw.PreferencesPage({
            title: 'Settings',
            icon_name: 'emblem-system-symbolic',
        });
        
        // Window Behavior group
        const behaviorGroup = new Adw.PreferencesGroup({
            title: 'Window Behavior',
            description: 'Configure how windows are moved between workspaces',
        });

        behaviorGroup.add(this._createTriggerModeRow(window));
        behaviorGroup.add(this._createOverrideModifierRow(window));
        page.add(behaviorGroup);

        // App Filtering group (mode selector only)
        const filterGroup = new Adw.PreferencesGroup({
            title: 'App Filtering',
            description: 'Control which apps are affected by this extension',
        });

        // Filter mode combo
        const labels = ['Blacklist', 'Whitelist'];
        const values = ['blacklist', 'whitelist'];
        const stringList = Gtk.StringList.new(labels);

        const combo = new Adw.ComboRow({
            title: 'Filter mode',
            subtitle: 'Blacklist skips the listed apps. Whitelist limits management to the listed apps.',
            model: stringList,
            selected: Math.max(values.indexOf(window._settings.get_string(ExtensionConstants.SETTING_FILTER_MODE)), 0),
        });

        combo.connect('notify::selected', row => {
            const idx = row.selected;
            const nextValue = values[idx] || values[0];
            window._settings.set_string(ExtensionConstants.SETTING_FILTER_MODE, nextValue);
        });

        window._settings.connect(`changed::${ExtensionConstants.SETTING_FILTER_MODE}`, () => {
            combo.selected = Math.max(values.indexOf(window._settings.get_string(ExtensionConstants.SETTING_FILTER_MODE)), 0);
        });

        filterGroup.add(combo);

        // Info row showing app count
        const infoRow = new Adw.ActionRow({
            title: 'Configured apps',
            subtitle: this._getManageAppsSubtitle(window),
        });
        infoRow.add_prefix(new Gtk.Image({
            icon_name: 'view-grid-symbolic',
            valign: Gtk.Align.CENTER,
        }));

        // Update info row when lists change
        const updateInfo = () => {
            infoRow.subtitle = this._getManageAppsSubtitle(window);
        };
        window._settings.connect(`changed::${ExtensionConstants.SETTING_FILTER_MODE}`, updateInfo);
        window._settings.connect(`changed::${ExtensionConstants.SETTING_BLACKLIST_APPS}`, updateInfo);
        window._settings.connect(`changed::${ExtensionConstants.SETTING_WHITELIST_APPS}`, updateInfo);

        filterGroup.add(infoRow);
        page.add(filterGroup);
        
        return page;
    }

    /**
     * Creates the app list management page (separate tab)
     * @private
     */
    _createAppListPage(window) {
        const page = new Adw.PreferencesPage({
            title: 'App List',
            icon_name: 'view-list-symbolic',
        });

        // Add application group (top)
        const addGroup = new Adw.PreferencesGroup({
            title: 'Add Application',
            description: 'Add apps to the filter list',
        });

        const addRow = new Adw.ActionRow({
            title: 'Add application',
            subtitle: 'Select an app to add to the list',
            activatable: true,
        });
        addRow.add_prefix(new Gtk.Image({
            icon_name: 'list-add-symbolic',
            valign: Gtk.Align.CENTER,
        }));
        addRow.add_suffix(new Gtk.Image({
            icon_name: 'go-next-symbolic',
            valign: Gtk.Align.CENTER,
        }));

        // Store reference for updating subtitle
        window._addRow = addRow;

        addRow.connect('activated', () => {
            const mode = window._settings.get_string(ExtensionConstants.SETTING_FILTER_MODE);
            const listKey = mode === 'whitelist' 
                ? ExtensionConstants.SETTING_WHITELIST_APPS 
                : ExtensionConstants.SETTING_BLACKLIST_APPS;
            this._openAppChooser(window, listKey);
        });

        addGroup.add(addRow);
        page.add(addGroup);

        // App list group (below)
        const listGroup = new Adw.PreferencesGroup();

        // Store reference for refresh
        window._appListGroup = listGroup;

        this._refreshAppList(window, listGroup);

        // Listen for changes to refresh list
        window._settings.connect(`changed::${ExtensionConstants.SETTING_FILTER_MODE}`, () => {
            this._refreshAppList(window, listGroup);
            this._updateAddRowSubtitle(window);
        });
        window._settings.connect(`changed::${ExtensionConstants.SETTING_BLACKLIST_APPS}`, () => {
            this._refreshAppList(window, listGroup);
        });
        window._settings.connect(`changed::${ExtensionConstants.SETTING_WHITELIST_APPS}`, () => {
            this._refreshAppList(window, listGroup);
        });

        page.add(listGroup);

        return page;
    }

    /**
     * Updates the add row subtitle based on current mode
     * @private
     */
    _updateAddRowSubtitle(window) {
        if (!window._addRow) return;
        const mode = window._settings.get_string(ExtensionConstants.SETTING_FILTER_MODE);
        window._addRow.subtitle = mode === 'whitelist' 
            ? 'Select apps to manage' 
            : 'Select apps to ignore';
    }

    /**
     * Returns subtitle for manage apps row based on current list count
     * @private
     */
    _getManageAppsSubtitle(window) {
        const mode = window._settings.get_string(ExtensionConstants.SETTING_FILTER_MODE);
        const listKey = mode === 'whitelist' 
            ? ExtensionConstants.SETTING_WHITELIST_APPS 
            : ExtensionConstants.SETTING_BLACKLIST_APPS;
        const count = window._settings.get_strv(listKey).length;

        if (count === 0) {
            return 'No apps configured';
        }
        return `${count} app${count > 1 ? 's' : ''} in ${mode}`;
    }

    /**
     * Rebuilds the application list UI based on mode
     * @private
     */
    _refreshAppList(window, group) {
        group._rowsCache = group._rowsCache || [];
        group._rowsCache.forEach(row => group.remove(row));
        group._rowsCache = [];

        const mode = window._settings.get_string(ExtensionConstants.SETTING_FILTER_MODE);
        const listKey = mode === 'whitelist' 
            ? ExtensionConstants.SETTING_WHITELIST_APPS 
            : ExtensionConstants.SETTING_BLACKLIST_APPS;
        const apps = window._settings.get_strv(listKey);

        group.title = mode === 'whitelist' ? 'Whitelisted Apps' : 'Blacklisted Apps';
        group.description = mode === 'whitelist'
            ? 'Only windows from these apps are managed.'
            : 'Windows from these apps are ignored.';

        if (apps.length === 0) {
            const emptyRow = new Adw.ActionRow({
                title: 'No applications added',
                subtitle: 'Use the button above to add apps.',
                sensitive: false,
            });
            emptyRow.add_prefix(new Gtk.Image({
                icon_name: 'view-grid-symbolic',
                valign: Gtk.Align.CENTER,
            }));
            group.add(emptyRow);
            group._rowsCache.push(emptyRow);
        } else {
            apps.forEach(appId => {
                const appInfo = Gio.DesktopAppInfo.new(appId);
                const row = new Adw.ActionRow({
                    title: appInfo ? appInfo.get_display_name() : appId,
                    subtitle: appId,
                });

                // App icon
                if (appInfo) {
                    const icon = appInfo.get_icon();
                    if (icon) {
                        row.add_prefix(new Gtk.Image({
                            gicon: icon,
                            pixel_size: 32,
                            valign: Gtk.Align.CENTER,
                        }));
                    }
                }

                const removeButton = new Gtk.Button({
                    icon_name: 'edit-delete-symbolic',
                    valign: Gtk.Align.CENTER,
                    tooltip_text: 'Remove',
                });
                removeButton.add_css_class('flat');
                removeButton.add_css_class('circular');
                removeButton.connect('clicked', () => this._removeAppFromList(window, listKey, appId));

                row.add_suffix(removeButton);
                group.add(row);
                group._rowsCache.push(row);
            });
        }
    }

    /**
     * Opens a multi-select app chooser dialog with search
     * @private
     */
    _openAppChooser(window, listKey) {
        const currentList = window._settings.get_strv(listKey);
        const mode = window._settings.get_string(ExtensionConstants.SETTING_FILTER_MODE);

        // Create dialog window
        const dialog = new Adw.Window({
            title: mode === 'whitelist' ? 'Select Apps to Whitelist' : 'Select Apps to Blacklist',
            transient_for: window,
            modal: true,
            default_width: 400,
            default_height: 550,
        });

        // Main layout
        const toolbarView = new Adw.ToolbarView();
        
        // Header bar with cancel/add buttons
        const headerBar = new Adw.HeaderBar();
        
        const cancelButton = new Gtk.Button({ label: 'Cancel' });
        cancelButton.connect('clicked', () => dialog.close());
        headerBar.pack_start(cancelButton);

        const addButton = new Gtk.Button({ label: 'Add Selected' });
        addButton.add_css_class('suggested-action');
        addButton.sensitive = false;
        headerBar.pack_end(addButton);

        toolbarView.add_top_bar(headerBar);

        // Main content box
        const contentBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0,
        });

        // Search entry
        const searchEntry = new Gtk.SearchEntry({
            placeholder_text: 'Search applications...',
            margin_start: 12,
            margin_end: 12,
            margin_top: 12,
            margin_bottom: 6,
        });
        contentBox.append(searchEntry);

        // Scrollable content
        const scrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            vexpand: true,
        });

        const listBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
            css_classes: ['boxed-list'],
            margin_start: 12,
            margin_end: 12,
            margin_top: 6,
            margin_bottom: 12,
        });

        // Track selected apps and rows for filtering
        const selectedApps = new Set();
        const appRows = [];

        // Get all installed apps
        const appInfos = Gio.AppInfo.get_all()
            .filter(app => app.should_show())
            .sort((a, b) => a.get_display_name().localeCompare(b.get_display_name()));

        appInfos.forEach(appInfo => {
            const appId = appInfo.get_id();
            if (!appId) return;

            // Skip already added apps
            if (currentList.includes(appId)) return;

            const displayName = appInfo.get_display_name();

            const row = new Adw.ActionRow({
                title: displayName,
                subtitle: appId,
                activatable: true,
            });

            // Store search data on row
            row._searchName = displayName.toLowerCase();
            row._searchId = appId.toLowerCase();

            // App icon
            const icon = appInfo.get_icon();
            if (icon) {
                row.add_prefix(new Gtk.Image({
                    gicon: icon,
                    pixel_size: 32,
                    valign: Gtk.Align.CENTER,
                }));
            }

            // Checkbox
            const check = new Gtk.CheckButton({
                valign: Gtk.Align.CENTER,
            });

            check.connect('toggled', () => {
                if (check.active) {
                    selectedApps.add(appId);
                } else {
                    selectedApps.delete(appId);
                }
                addButton.sensitive = selectedApps.size > 0;
                addButton.label = selectedApps.size > 0 
                    ? `Add Selected (${selectedApps.size})` 
                    : 'Add Selected';
            });

            row.add_suffix(check);
            row.activatable_widget = check;

            listBox.append(row);
            appRows.push(row);
        });

        // Search filtering
        searchEntry.connect('search-changed', () => {
            const query = searchEntry.text.toLowerCase().trim();
            
            appRows.forEach(row => {
                if (query === '') {
                    row.visible = true;
                } else {
                    const matchesName = row._searchName.includes(query);
                    const matchesId = row._searchId.includes(query);
                    row.visible = matchesName || matchesId;
                }
            });
        });

        // Handle add button
        addButton.connect('clicked', () => {
            selectedApps.forEach(appId => {
                this._addAppToList(window, listKey, appId);
            });
            dialog.close();
        });

        scrolled.set_child(listBox);
        contentBox.append(scrolled);
        toolbarView.set_content(contentBox);
        dialog.set_content(toolbarView);
        dialog.present();

        // Focus search entry on open
        searchEntry.grab_focus();
    }

    /**
     * Adds an app ID to the appropriate list
     * @private
     */
    _addAppToList(window, listKey, appId) {
        const list = window._settings.get_strv(listKey);
        if (list.includes(appId)) {
            return;
        }

        list.push(appId);
        window._settings.set_strv(listKey, list);
    }

    /**
     * Removes an app ID from the appropriate list
     * @private
     */
    _removeAppFromList(window, listKey, appId) {
        const list = window._settings.get_strv(listKey);
        const next = list.filter(id => id !== appId);
        window._settings.set_strv(listKey, next);
    }

    /**
     * Creates the about page
     * @private
     * @returns {Adw.PreferencesPage} The about page
     */
    _createAboutPage() {
        const page = new Adw.PreferencesPage({
            title: 'About',
            icon_name: 'help-about-symbolic',
        });
        
        const group = new Adw.PreferencesGroup();
        
        const aboutRow = new Adw.ActionRow({
            title: 'ScreenToSpace',
            subtitle: 'Automatically move maximized and fullscreen windows to empty workspaces',
        });
        aboutRow.add_prefix(new Gtk.Image({
            icon_name: 'view-grid-symbolic',
            pixel_size: 32,
            valign: Gtk.Align.CENTER,
        }));
        group.add(aboutRow);
        
        const authorRow = new Adw.ActionRow({
            title: 'Developed by',
            subtitle: 'DilZhaan',
        });
        authorRow.add_prefix(new Gtk.Image({
            icon_name: 'system-users-symbolic',
            valign: Gtk.Align.CENTER,
        }));
        group.add(authorRow);
        
        const versionRow = new Adw.ActionRow({
            title: 'Version',
            subtitle: this.metadata.version.toString(),
        });
        versionRow.add_prefix(new Gtk.Image({
            icon_name: 'emblem-default-symbolic',
            valign: Gtk.Align.CENTER,
        }));
        group.add(versionRow);
        
        const urlRow = new Adw.ActionRow({
            title: 'Repository',
            subtitle: ExtensionConstants.URL,
        });
        urlRow.add_prefix(new Gtk.Image({
            icon_name: 'web-browser-symbolic',
            valign: Gtk.Align.CENTER,
        }));
        group.add(urlRow);
        
        page.add(group);
        
        return page;
    }

    /**
     * Creates the maximized window toggle row
     * @private
     * @param {Adw.PreferencesWindow} window - The preferences window
     * @returns {Adw.ActionRow} The toggle row
     */
    _createTriggerModeRow(window) {
        const labels = ['Maximize', 'Full Screen', 'Both'];
        const values = ['maximize', 'fullscreen', 'both'];
        const stringList = Gtk.StringList.new(labels);

        const schema = window._settings.settings_schema;
        const hasKeys = schema?.has_key?.(ExtensionConstants.SETTING_TRIGGER_ON_MAXIMIZE) &&
            schema?.has_key?.(ExtensionConstants.SETTING_TRIGGER_ON_FULLSCREEN);

        const row = new Adw.ComboRow({
            title: 'Behavior',
            subtitle: 'Choose which window state triggers a workspace move',
            model: stringList,
            selected: 2,
        });

        row.add_prefix(new Gtk.Image({
            icon_name: 'view-fullscreen-symbolic',
            valign: Gtk.Align.CENTER,
        }));

        if (!hasKeys) {
            row.sensitive = false;
            row.subtitle = 'Choose which window state triggers a workspace move (update required)';
            return row;
        }

        const getModeFromSettings = () => {
            const onMax = window._settings.get_boolean(ExtensionConstants.SETTING_TRIGGER_ON_MAXIMIZE);
            const onFull = window._settings.get_boolean(ExtensionConstants.SETTING_TRIGGER_ON_FULLSCREEN);

            if (onMax && onFull) {
                return 'both';
            }

            if (onMax && !onFull) {
                return 'maximize';
            }

            if (!onMax && onFull) {
                return 'fullscreen';
            }

            // Not exposed by UI; keep it simple.
            return 'both';
        };

        let isUpdating = false;

        const syncRowFromSettings = () => {
            if (isUpdating) {
                return;
            }

            const mode = getModeFromSettings();
            const nextSelected = Math.max(values.indexOf(mode), 2);
            if (row.selected !== nextSelected) {
                isUpdating = true;
                row.selected = nextSelected;
                isUpdating = false;
            }
        };

        syncRowFromSettings();

        row.connect('notify::selected', combo => {
            if (isUpdating) {
                return;
            }

            const idx = combo.selected;
            const mode = values[idx] || 'both';

            isUpdating = true;
            window._settings.set_boolean(ExtensionConstants.SETTING_TRIGGER_ON_MAXIMIZE, mode === 'maximize' || mode === 'both');
            window._settings.set_boolean(ExtensionConstants.SETTING_TRIGGER_ON_FULLSCREEN, mode === 'fullscreen' || mode === 'both');
            isUpdating = false;
        });

        window._settings.connect(`changed::${ExtensionConstants.SETTING_TRIGGER_ON_MAXIMIZE}`, syncRowFromSettings);
        window._settings.connect(`changed::${ExtensionConstants.SETTING_TRIGGER_ON_FULLSCREEN}`, syncRowFromSettings);

        return row;
    }

    _createOverrideModifierRow(window) {
        const labels = ['None', 'Alt', 'Super', 'Ctrl', 'Shift'];
        const values = ['none', 'alt', 'super', 'ctrl', 'shift'];
        const stringList = Gtk.StringList.new(labels);

        const schema = window._settings.settings_schema;
        const hasKey = schema?.has_key?.(ExtensionConstants.SETTING_OVERRIDE_MODIFIER);
        const current = hasKey
            ? window._settings.get_string(ExtensionConstants.SETTING_OVERRIDE_MODIFIER)
            : 'none';

        const row = new Adw.ComboRow({
            title: 'Override modifier',
            subtitle: 'Hold while maximizing or fullscreening to use GNOME\'s default behavior',
            model: stringList,
            selected: Math.max(values.indexOf(current), 0),
        });

        if (hasKey) {
            row.connect('notify::selected', combo => {
                const idx = combo.selected;
                const nextValue = values[idx] || values[0];
                window._settings.set_string(ExtensionConstants.SETTING_OVERRIDE_MODIFIER, nextValue);
            });

            window._settings.connect(`changed::${ExtensionConstants.SETTING_OVERRIDE_MODIFIER}`, () => {
                row.selected = Math.max(values.indexOf(window._settings.get_string(ExtensionConstants.SETTING_OVERRIDE_MODIFIER)), 0);
            });
        } else {
            row.sensitive = false;
            row.subtitle = 'Hold while maximizing or fullscreening to use GNOME\'s default behavior (update required)';
        }

        return row;
    }
}
