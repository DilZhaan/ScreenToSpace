/**
 * ScreenToSpace - Internationalization Support
 * 
 * Provides translation utilities for the extension.
 * 
 * @author DilZhaan
 * @license GPL-2.0-or-later
 */

import Gettext from 'gettext';

const Domain = Gettext.domain('screentospace');

/**
 * Translation function
 * @param {string} str - String to translate
 * @returns {string} Translated string
 */
export function _(str) {
    return Domain.gettext(str);
}

/**
 * Translation function with context
 * @param {string} context - Context for translation
 * @param {string} str - String to translate
 * @returns {string} Translated string
 */
export function C_(context, str) {
    return Domain.pgettext(context, str);
}

/**
 * Plural translation function
 * @param {string} str - Singular string
 * @param {string} strPlural - Plural string
 * @param {number} n - Count
 * @returns {string} Translated string
 */
export function ngettext(str, strPlural, n) {
    return Domain.ngettext(str, strPlural, n);
}
