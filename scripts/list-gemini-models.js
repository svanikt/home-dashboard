#!/usr/bin/env node
const axios = require('axios');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('Error: GEMINI_API_KEY not found in .env file');
  process.exit(1);
}

async function listModels() {
  console.log('Fetching available Gemini models...\n');

  try {
    const response = await axios.get(
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
    );

    console.log('='.repeat(60));
    console.log('AVAILABLE MODELS');
    console.log('='.repeat(60));

    // Filter for models that support generateContent
    const generateContentModels = response.data.models?.filter(m =>
      m.supportedGenerationMethods?.includes('generateContent')
    );

    if (!generateContentModels || generateContentModels.length === 0) {
      console.log('No models found that support generateContent');
      return;
    }

    console.log('\nModels that support generateContent:\n');
    generateContentModels.forEach(m => {
      console.log(`Name: ${m.name}`);
      console.log(`Display Name: ${m.displayName}`);
      console.log(`Description: ${m.description || 'N/A'}`);
      console.log(`Methods: ${m.supportedGenerationMethods.join(', ')}`);
      console.log('-'.repeat(60));
    });

    console.log(`\nTotal: ${generateContentModels.length} models\n`);

    // Show the first model name to use
    if (generateContentModels.length > 0) {
      const firstModel = generateContentModels[0].name;
      console.log(`\nRECOMMENDED MODEL TO USE:`);
      console.log(`  ${firstModel}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

listModels();
