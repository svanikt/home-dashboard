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

/**
 * Get time-based greeting message with icon
 * @returns {Object} Greeting object with {text, icon} where icon is a Phosphor icon class
 */
function getTimeBasedGreeting() {
  const now = new Date();
  const hour = now.getHours();

  if (hour >= 5 && hour < 12) {
    return {
      text: 'good morning chripro!',
      icon: 'ph-coffee'
    };
  } else if (hour >= 12 && hour < 18) {
    return {
      text: 'good afternoon chripro!',
      icon: 'ph-sun'
    };
  } else if (hour >= 18 && hour < 22) {
    return {
      text: 'good evening chripro',
      icon: 'ph-sunset'
    };
  } else {
    // 10PM to 4AM
    return {
      text: 'goodnight chripro',
      icon: 'ph-moon'
    };
  }
}

/**
 * Get display message (either actual message or time-based greeting)
 * @returns {Object} Message object with {text, icon, isGreeting}
 */
function getDisplayMessage() {
  const message = getMessage();

  if (message && message.text) {
    return {
      text: message.text,
      icon: 'ph-envelope',
      isGreeting: false
    };
  }

  return {
    ...getTimeBasedGreeting(),
    isGreeting: true
  };
}

module.exports = {
  getMessage,
  setMessage,
  clearMessage,
  getTimeBasedGreeting,
  getDisplayMessage
};
