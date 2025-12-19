#!/usr/bin/env node

/**
 * CLI tool to send messages to the dashboard
 * Usage: node scripts/send-message.js "Your message here"
 *        npm run send-message "Your message here"
 */

require('dotenv').config();
const https = require('https');
const http = require('http');

const MESSAGE_API_URL = process.env.MESSAGE_API_URL || 'https://dashboard.svanik.xyz/api/message';
const AUTH_TOKEN = process.env.MESSAGE_AUTH_TOKEN;

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

// Show usage if no arguments
if (!command) {
  console.log('Usage:');
  console.log('  Send message:  node scripts/send-message.js "Your message"');
  console.log('  Clear message: node scripts/send-message.js --clear');
  console.log('  View message:  node scripts/send-message.js --view');
  process.exit(1);
}

// Check for auth token
if (!AUTH_TOKEN && command !== '--view') {
  console.error('Error: MESSAGE_AUTH_TOKEN not found in .env');
  process.exit(1);
}

/**
 * Make HTTP(S) request
 */
function makeRequest(method, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(MESSAGE_API_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (method !== 'GET' && AUTH_TOKEN) {
      options.headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
    }

    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * Main execution
 */
async function main() {
  try {
    let response;

    if (command === '--clear') {
      // Clear message
      console.log('Clearing message...');
      response = await makeRequest('DELETE');

      if (response.status === 200) {
        console.log('✓ Message cleared successfully');
      } else {
        console.error('✗ Failed to clear message:', response.data);
        process.exit(1);
      }

    } else if (command === '--view') {
      // View current message
      response = await makeRequest('GET');

      if (response.status === 200) {
        const { message } = response.data;
        if (message) {
          console.log('Current message:');
          console.log(`  "${message.text}"`);
          console.log(`  Set at: ${new Date(message.timestamp).toLocaleString()}`);
        } else {
          console.log('No message currently set');
        }
      } else {
        console.error('✗ Failed to get message:', response.data);
        process.exit(1);
      }

    } else {
      // Send message
      const messageText = args.join(' ');
      console.log(`Sending message: "${messageText}"`);

      response = await makeRequest('POST', { message: messageText });

      if (response.status === 200) {
        console.log('✓ Message sent successfully!');
        console.log(`  Your girlfriend will see it on her dashboard`);
      } else {
        console.error('✗ Failed to send message:', response.data);
        process.exit(1);
      }
    }

  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

main();
