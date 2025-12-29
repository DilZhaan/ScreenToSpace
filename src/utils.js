/**
 * ScreenToSpace - Utilities
 * 
 * Shared utility functions for logging and debugging.
 * 
 * @author DilZhaan
 * @license GPL-2.0-or-later
 */

/**
 * Debug mode flag - set to true to enable debug logging
 * Can be toggled via environment variable or settings
 */
export const DEBUG = false;

/**
 * Logs a debug message if debug mode is enabled
 * @param {string} msg - The message to log
 */
export function log_debug(msg) {
    if (DEBUG) {
        console.log(`[ScreenToSpace] ${msg}`);
    }
}

/**
 * Logs an error message
 * @param {string} msg - The error message to log
 */
export function log_error(msg) {
    console.error(`[ScreenToSpace] ${msg}`);
}

/**
 * Logs a warning message
 * @param {string} msg - The warning message to log
 */
export function log_warning(msg) {
    console.warn(`[ScreenToSpace] ${msg}`);
}

/**
 * Validates that a window is in a usable state
 * @param {Object} window - Meta window object
 * @returns {boolean} True if window is valid
 */
export function validateWindow(window) {
    if (!window) {
        return false;
    }

    try {
        // Check if window still exists and has necessary methods
        window.get_id();
        window.get_workspace();
        return true;
    } catch (error) {
        log_debug(`Window validation failed: ${error.message}`);
        return false;
    }
}

/**
 * Safely executes a function with error handling
 * @param {Function} fn - Function to execute
 * @param {string} context - Context description for error logging
 * @param {*} defaultReturn - Default value to return on error
 * @returns {*} Result of function or default value
 */
export function safeExecute(fn, context, defaultReturn = null) {
    try {
        return fn();
    } catch (error) {
        log_error(`Error in ${context}: ${error.message}`);
        return defaultReturn;
    }
}

