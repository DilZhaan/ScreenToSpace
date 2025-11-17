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
        
        page.add(group);
        
        return page;
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
