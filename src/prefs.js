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
        
        const maximizedRow = this._createMaximizedToggleRow(window);
        behaviorGroup.add(maximizedRow);
        page.add(behaviorGroup);

        // App Filtering group (mode selector + link to app list page)
        const filterGroup = new Adw.PreferencesGroup({
            title: 'App Filtering',
            description: 'Control which apps are affected by this extension',
        });

        // Filter mode combo
        const labels = ['Blacklist (ignore listed apps)', 'Whitelist (manage only listed apps)'];
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
            this._updateManageAppsRow(window, manageAppsRow);
        });

        filterGroup.add(combo);

        // Link to manage app list
        const manageAppsRow = new Adw.ActionRow({
            title: 'Manage app list',
            subtitle: this._getManageAppsSubtitle(window),
            activatable: true,
        });

        const chevron = new Gtk.Image({
            icon_name: 'go-next-symbolic',
            valign: Gtk.Align.CENTER,
        });
        manageAppsRow.add_suffix(chevron);

        manageAppsRow.connect('activated', () => {
            window.present_subpage(window._appListPage);
        });

        filterGroup.add(manageAppsRow);
        page.add(filterGroup);
        
        return page;
    }

    /**
     * Creates the app list management page (subpage)
     * @private
     */
    _createAppListPage(window) {
        const page = new Adw.NavigationPage({
            title: 'Manage Apps',
        });

        const toolbar = new Adw.ToolbarView();
        const header = new Adw.HeaderBar();
        toolbar.add_top_bar(header);

        const content = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup();

        // Store reference for refresh
        window._appListPage = page;
        window._appListGroup = group;

        this._refreshAppList(window, group);

        // Listen for changes to refresh list
        window._settings.connect(`changed::${ExtensionConstants.SETTING_FILTER_MODE}`, () => {
            this._refreshAppList(window, group);
        });
        window._settings.connect(`changed::${ExtensionConstants.SETTING_BLACKLIST_APPS}`, () => {
            this._refreshAppList(window, group);
        });
        window._settings.connect(`changed::${ExtensionConstants.SETTING_WHITELIST_APPS}`, () => {
            this._refreshAppList(window, group);
        });

        content.add(group);
        toolbar.set_content(content);
        page.set_child(toolbar);

        return page;
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
     * Updates the manage apps row subtitle
     * @private
     */
    _updateManageAppsRow(window, row) {
        row.subtitle = this._getManageAppsSubtitle(window);
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
                subtitle: 'Tap the button below to add apps.',
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

        // Add application button
        const addRow = new Adw.ActionRow({
            title: 'Add application',
            subtitle: mode === 'whitelist' ? 'Select apps to manage' : 'Select apps to ignore',
        });
        addRow.add_prefix(new Gtk.Image({
            icon_name: 'list-add-symbolic',
            valign: Gtk.Align.CENTER,
        }));

        const addButton = new Gtk.Button({
            icon_name: 'plus-large-symbolic',
            valign: Gtk.Align.CENTER,
            tooltip_text: 'Add app',
        });
        addButton.add_css_class('suggested-action');
        addButton.add_css_class('circular');
        addButton.connect('clicked', () => this._openAppChooser(window, listKey));

        addRow.add_suffix(addButton);
        addRow.activatable_widget = addButton;
        group.add(addRow);
        group._rowsCache.push(addRow);
    }

    /**
     * Opens the app chooser dialog and adds the selected app
     * @private
     */
    _openAppChooser(window, listKey) {
        const dialog = new Gtk.AppChooserDialog({
            transient_for: window,
            modal: true,
            heading: 'Select an application',
        });

        dialog.connect('response', (dlg, response) => {
            if (response === Gtk.ResponseType.OK) {
                const appInfo = dlg.get_app_info();
                if (appInfo) {
                    this._addAppToList(window, listKey, appInfo.get_id());
                }
            }

            dlg.destroy();
        });

        dialog.show();
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
            icon_name: 'info-symbolic',
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
    _createMaximizedToggleRow(window) {
        const row = new Adw.ActionRow({
            title: 'Move window when maximized',
            subtitle: 'Automatically move maximized windows to empty workspaces',
        });

        row.add_prefix(new Gtk.Image({
            icon_name: 'view-fullscreen-symbolic',
            valign: Gtk.Align.CENTER,
        }));

        const toggle = new Gtk.Switch({
            active: window._settings.get_boolean(ExtensionConstants.SETTING_MOVE_WHEN_MAXIMIZED),
            valign: Gtk.Align.CENTER,
        });

        window._settings.bind(
            ExtensionConstants.SETTING_MOVE_WHEN_MAXIMIZED,
            toggle,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        row.add_suffix(toggle);
        row.activatable_widget = toggle;

        return row;
    }
}
