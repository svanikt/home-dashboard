const { readState, writeState } = require('./state');

/**
 * Message Board Module
 * Handles storing and retrieving messages displayed on the dashboard
 */

const MESSAGE_KEY = 'messageBoard';

/**
 * Get the current message
 * @returns {Object|null} Message object with {text, timestamp} or null if no message
 */
function getMessage() {
  const data = readState();
  return data[MESSAGE_KEY] || null;
}

/**
 * Set a new message
 * @param {string} text - The message text to display
 * @returns {Object} The saved message object
 */
function setMessage(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Message text must be a non-empty string');
  }

  const message = {
    text: text.trim(),
    timestamp: new Date().toISOString()
  };

  const data = readState();
  data[MESSAGE_KEY] = message;
  writeState(data);

  return message;
}

/**
 * Clear the current message
 * @returns {boolean} True if message was cleared
 */
function clearMessage() {
  const data = readState();
  if (data[MESSAGE_KEY]) {
    delete data[MESSAGE_KEY];
    writeState(data);
    return true;
  }
  return false;
}

module.exports = {
  getMessage,
  setMessage,
  clearMessage
};
