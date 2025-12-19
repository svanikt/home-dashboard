const express = require('express');
const router = express.Router();
const messageBoard = require('../lib/messageBoard');

/**
 * Middleware to verify auth token for protected endpoints
 */
function requireAuth(req, res, next) {
  const authToken = process.env.MESSAGE_AUTH_TOKEN;

  if (!authToken) {
    return res.status(500).json({
      error: 'Server configuration error',
      details: 'MESSAGE_AUTH_TOKEN not configured'
    });
  }

  const providedToken = req.headers.authorization?.replace('Bearer ', '');

  if (!providedToken || providedToken !== authToken) {
    return res.status(401).json({
      error: 'Unauthorized',
      details: 'Invalid or missing authentication token'
    });
  }

  next();
}

/**
 * GET /api/message
 * Get the current message (public - used by dashboard)
 */
router.get('/', (req, res) => {
  try {
    const message = messageBoard.getMessage();
    res.json({ message });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get message',
      details: error.message
    });
  }
});

/**
 * POST /api/message
 * Set a new message (requires auth)
 * Body: { "message": "text" }
 */
router.post('/', requireAuth, (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        error: 'Bad request',
        details: 'Message text is required'
      });
    }

    const saved = messageBoard.setMessage(message);
    res.json({
      success: true,
      message: saved
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to set message',
      details: error.message
    });
  }
});

/**
 * DELETE /api/message
 * Clear the current message (requires auth)
 */
router.delete('/', requireAuth, (req, res) => {
  try {
    const cleared = messageBoard.clearMessage();
    res.json({
      success: true,
      cleared
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to clear message',
      details: error.message
    });
  }
});

module.exports = router;
