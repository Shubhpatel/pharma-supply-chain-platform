/**
 * Escapes special characters in a string so it can be safely used in a regular expression.
 * This prevents Regular Expression Denial of Service (ReDoS) and unintended regex injections.
 * @param {string} text - The input string to escape.
 * @returns {string} The escaped string.
 */
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = { escapeRegex };
