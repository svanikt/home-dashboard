const axios = require('axios');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;

async function listModels() {
  console.log('Fetching available Gemini models...\n');

  try {
    const response = await axios.get(
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
    );

    console.log('Available models:');
    console.log(JSON.stringify(response.data, null, 2));

    // Filter for models that support generateContent
    const generateContentModels = response.data.models?.filter(m =>
      m.supportedGenerationMethods?.includes('generateContent')
    );

    console.log('\n\nModels that support generateContent:');
    generateContentModels?.forEach(m => {
      console.log(`- ${m.name}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

listModels();
