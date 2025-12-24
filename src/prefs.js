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
        const aboutPage = this._createAboutPage();
        
        window.add(behaviorPage);
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
            title: 'Window Behavior',
            icon_name: 'preferences-system-symbolic',
        });
        
        const group = new Adw.PreferencesGroup({
            title: 'Window Behavior',
            description: 'Configure how windows are moved between workspaces',
        });
        
        const maximizedRow = this._createMaximizedToggleRow(window);
        group.add(maximizedRow);
        
        const filterModeGroup = this._createFilterModeGroup(window);
        const filterListGroup = this._createFilterListGroup(window);

        // Keep UI in sync with settings changes
        const refreshList = () => this._refreshAppList(window, filterListGroup);
        window._settings.connect(`changed::${ExtensionConstants.SETTING_FILTER_MODE}`, refreshList);
        window._settings.connect(`changed::${ExtensionConstants.SETTING_BLACKLIST_APPS}`, refreshList);
        window._settings.connect(`changed::${ExtensionConstants.SETTING_WHITELIST_APPS}`, refreshList);

        page.add(group);
        page.add(filterModeGroup);
        page.add(filterListGroup);
        
        return page;
    }

    /**
     * Creates the app filter mode group
     * @private
     */
    _createFilterModeGroup(window) {
        const group = new Adw.PreferencesGroup({
            title: 'App Filtering',
            description: 'Choose whether to ignore listed apps (blacklist) or manage only listed apps (whitelist).',
        });

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

        // Update combo if settings change externally
        window._settings.connect(`changed::${ExtensionConstants.SETTING_FILTER_MODE}`, () => {
            combo.selected = Math.max(values.indexOf(window._settings.get_string(ExtensionConstants.SETTING_FILTER_MODE)), 0);
        });

        group.add(combo);
        return group;
    }

    /**
     * Creates the list group for blacklist/whitelist entries
     * @private
     */
    _createFilterListGroup(window) {
        const group = new Adw.PreferencesGroup();
        this._refreshAppList(window, group);
        return group;
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
        const listKey = mode === 'whitelist' ? ExtensionConstants.SETTING_WHITELIST_APPS : ExtensionConstants.SETTING_BLACKLIST_APPS;
        const apps = window._settings.get_strv(listKey);

        group.title = mode === 'whitelist' ? 'Whitelisted applications' : 'Blacklisted applications';
        group.description = mode === 'whitelist'
            ? 'Only windows from these apps are managed.'
            : 'Windows from these apps are ignored.';

        if (apps.length === 0) {
            const emptyRow = new Adw.ActionRow({
                title: 'No applications added',
                subtitle: 'Use “Add application” to choose apps.',
                sensitive: false,
            });
            group.add(emptyRow);
            group._rowsCache.push(emptyRow);
        } else {
            apps.forEach(appId => {
                const row = new Adw.ActionRow({
                    title: this._getAppName(appId),
                    subtitle: appId,
                });

                const removeButton = new Gtk.Button({
                    icon_name: 'user-trash-symbolic',
                    valign: Gtk.Align.CENTER,
                    tooltip_text: 'Remove',
                });
                removeButton.add_css_class('flat');
                removeButton.connect('clicked', () => this._removeAppFromList(window, listKey, appId));

                row.add_suffix(removeButton);
                row.activatable_widget = removeButton;
                group.add(row);
                group._rowsCache.push(row);
            });
        }

        const addRow = new Adw.ActionRow({
            title: 'Add application',
            subtitle: mode === 'whitelist' ? 'Select apps to manage' : 'Select apps to ignore',
        });

        const addButton = new Gtk.Button({
            label: 'Add',
            icon_name: 'list-add-symbolic',
            valign: Gtk.Align.CENTER,
        });
        addButton.add_css_class('suggested-action');
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
     * Attempts to resolve a friendly app name for display
     * @private
     */
    _getAppName(appId) {
        const appInfo = Gio.DesktopAppInfo.new(appId);
        return appInfo ? appInfo.get_display_name() : appId;
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
        group.add(aboutRow);
        
        const authorRow = new Adw.ActionRow({
            title: 'Developed by',
            subtitle: 'DilZhaan',
        });
        group.add(authorRow);
        
        const versionRow = new Adw.ActionRow({
            title: 'Version',
            subtitle: this.metadata.version.toString(),
        });
        group.add(versionRow);
        
        const urlRow = new Adw.ActionRow({
            title: 'Repository',
            subtitle: ExtensionConstants.URL,
        });
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
