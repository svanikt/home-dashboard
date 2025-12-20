const axios = require('axios');
const { BaseService } = require('../lib/BaseService');

/**
 * LLM Service (AI Insights) - OPTIONAL
 * Supports Google Gemini (free tier) and Anthropic Claude
 * Provider auto-detected based on which API key is set
 */
class LLMService extends BaseService {

  constructor(cacheTTLMinutes = 90) {
    super({
      name: 'LLM',
      cacheKey: 'llm',
      cacheTTL: cacheTTLMinutes * 60 * 1000,
      retryAttempts: 3,
      retryCooldown: 300,
    });
  }

  isEnabled() {
    const geminiKey = process.env.GEMINI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    return !!(geminiKey || anthropicKey);
  }

  getProvider() {
    if (process.env.GEMINI_API_KEY) return 'gemini';
    if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
    return null;
  }

  // Pricing per token (Gemini free tier = $0, Claude 3.5 Haiku = paid)
  static PRICING = {
    gemini: {
      input: 0,   // Free tier
      output: 0,  // Free tier
    },
    anthropic: {
      input: 0.80 / 1_000_000,   // $0.80 per million
      output: 4.00 / 1_000_000,  // $4.00 per million
    }
  };
  
  async fetchData(config, logger) {
    const provider = this.getProvider();
    if (!provider) throw new Error('No LLM API key configured (GEMINI_API_KEY or ANTHROPIC_API_KEY)');

    const { systemPrompt, userMessage } = this.buildPrompt(config.input);

    logger.info?.(`[LLM] Calling ${provider} API`);

    let response, text, inputTokens, outputTokens;

    if (provider === 'gemini') {
      response = await this.callGeminiAPI(systemPrompt, userMessage, logger);
      text = response.text;
      inputTokens = response.inputTokens;
      outputTokens = response.outputTokens;
    } else {
      response = await this.callAnthropicAPI(systemPrompt, userMessage, logger);
      text = response.text;
      inputTokens = response.inputTokens;
      outputTokens = response.outputTokens;
    }

    logger.info?.(`[LLM] Raw response text (${text.length} chars):`, text);

    // Calculate cost
    const pricing = LLMService.PRICING[provider];
    const costUsd = (inputTokens * pricing.input) + (outputTokens * pricing.output);

    logger.info?.(`[LLM] Tokens: ${inputTokens} input, ${outputTokens} output | Cost: $${costUsd.toFixed(6)}`);

    let parsed;
    try {
      // Strip markdown code blocks just in case
      let cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      logger.info?.('[LLM] After stripping markdown:', cleanText);

      // Extract just the JSON object (in case LLM adds extra commentary)
      const jsonStart = cleanText.indexOf('{');
      const jsonEnd = cleanText.lastIndexOf('}');

      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleanText = cleanText.substring(jsonStart, jsonEnd + 1);
        logger.info?.('[LLM] Extracted JSON:', cleanText);
      }

      parsed = JSON.parse(cleanText);
      logger.info?.('[LLM] Successfully parsed:', parsed);
    } catch (e) {
      logger.error?.('[LLM] Failed to parse response:', e.message);
      logger.error?.('[LLM] Text that failed to parse:', text);
      parsed = { clothing_suggestion: null, daily_summary: null };
    }

    // Attach cost and prompt metadata to the parsed result 
    // for easier debugging and cost tracking
    return {
      ...parsed,
      _meta: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costUsd,
        prompt: `SYSTEM:\n${systemPrompt}\n\nUSER:\n${userMessage}`,
      }
    };
  }

  async callGeminiAPI(systemPrompt, userMessage, logger) {
    const apiKey = process.env.GEMINI_API_KEY;

    // Combine system and user prompts for Gemini
    const fullPrompt = `${systemPrompt}\n\n${userMessage}`;

    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
        {
          contents: [{
            parts: [{
              text: fullPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 300,
          }
        },
        {
          timeout: 8000,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      // Log full response structure for debugging
      logger.info?.('[LLM Gemini] Raw response structure:', JSON.stringify(response.data, null, 2));

      const text = response?.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const usage = response?.data?.usageMetadata || {};

      logger.info?.(`[LLM Gemini] Extracted text: "${text}"`);
      logger.info?.(`[LLM Gemini] Usage:`, usage);

      return {
        text,
        inputTokens: usage.promptTokenCount || 0,
        outputTokens: usage.candidatesTokenCount || 0,
      };
    } catch (error) {
      logger.error?.(`[LLM Gemini] API Error: ${error.message}`);
      if (error.response) {
        logger.error?.(`[LLM Gemini] Status: ${error.response.status}, Data:`, JSON.stringify(error.response.data));
      }
      throw error;
    }
  }

  async callAnthropicAPI(systemPrompt, userMessage, logger) {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-5-haiku-latest',
        max_tokens: 300,
        temperature: 0.5,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      },
      {
        timeout: 8000,
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
      }
    );

    const text = response?.data?.content?.[0]?.text || '';
    const usage = response?.data?.usage || {};

    return {
      text,
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
    };
  }

  mapToDashboard(apiData, config) {
    return {
      clothing_suggestion: apiData.clothing_suggestion,
      daily_summary: apiData.daily_summary,
      _meta: apiData._meta,
    };
  }

  /**
   * Get current cached cost information
   * @returns {Object|null} Cost info or null if no cache
   */
  getCostInfo() {
    const cached = this.getCache(true); // Allow stale
    if (!cached || !cached._meta) return null;

    const { input_tokens, output_tokens, cost_usd, prompt } = cached._meta;

    // Calculate projected daily/monthly costs based on cache TTL
    const cacheTTLHours = this.cacheTTL / (1000 * 60 * 60);
    const callsPerDay = (24 - 5) / cacheTTLHours;
    const projectedDailyCost = cost_usd * callsPerDay;
    const projectedMonthlyCost = projectedDailyCost * 30;

    return {
      last_call: {
        input_tokens,
        output_tokens,
        total_tokens: input_tokens + output_tokens,
        cost_usd,
        prompt,
      },
      projections: {
        calls_per_day: Math.round(callsPerDay * 10) / 10,
        daily_cost_usd: projectedDailyCost,
        monthly_cost_usd: projectedMonthlyCost,
      }
    };
  }

  buildPrompt({ current, forecast, hourlyForecast, location, timezone, sun, moon, air_quality }) {
    const timeContext = this.getTimeContext();
    const tz = timezone || 'America/Los_Angeles';

    // Determine scope
    // Note: forecast[0] is always the "next full day"
    // During daytime: forecast[0] = today, during nighttime: forecast[0] = tomorrow
    const isNight = timeContext.period === 'night';
    const hoursToShow = timeContext.period === 'morning' ? 8 : 6;
    const relevantHourly = isNight ? hourlyForecast : hourlyForecast.slice(0, hoursToShow);
    const relevantForecast = forecast?.[0]; // Always use forecast[0] for the next full day

    // Build context intelligently
    const weatherContext = this.buildWeatherContext({
      current,
      relevantForecast,
      relevantHourly,
      isNight,
      moon,
      air_quality,
      timeContext
    });

    const systemPrompt = `You generate accurate and helpful weather insights for a kitchen e-ink display. The dashboard shows temps/numbers, so describe the FEEL and STORY of the weather to help the user plan their day.

Return JSON:
{
  "clothing_suggestion": "practical clothing advice for women, max 6 words",
  "daily_summary": "vivid weather narrative, 60-78 chars total (including spaces and punctuation), no ending punctuation"
}

Style:
- Comment specifically on things that are normal or out of the ordinary, help the user plan their day
- Write like a friendly late night weather reporter providing informative updates
- Keep observations factual and helpful
- Describe changes: "warming up", "heating up fast", "cooling down", "drying out", "getting wetter", "clearing up", "getting cloudy"

Rules:
- DO NOT mention specific temps (dashboard shows these) - use "cool", "warm", "hot", "chilly", "mild"
- DO NOT mention specific month or date, but you can describe the season (e.g. Summer, Spring, Fall, Winter)
- For clothing suggestions, use women's wardrobe items: sweaters, cardigans, coats, jackets, light tops, airy blouses, layered outfits, etc.
- CRITICAL: When rain chance is >30% or it's actively raining, ALWAYS mention rain gear: raincoat, umbrella, waterproof jacket, rain boots, etc.
- Prioritize rain protection over temperature comfort when precipitation is significant

Examples:
{"clothing_suggestion": "Raincoat and umbrella", "daily_summary": "Rainy throughout the day. Keep dry with waterproof layers"}
{"clothing_suggestion": "Waterproof jacket, boots", "daily_summary": "Wet and dreary morning, rain continuing into afternoon. Stay dry"}
{"clothing_suggestion": "Umbrella and warm coat", "daily_summary": "Cold and rainy most of the day. Bundle up and bring rain protection"}
{"clothing_suggestion": "Cardigan you can remove", "daily_summary": "Cool start warming up fast, sunny and pleasant by afternoon"}
{"clothing_suggestion": "Cozy sweater for today", "daily_summary": "Chilly and misty this morning, staying fairly cool throughout the day"}
{"clothing_suggestion": "Light jacket for evening", "daily_summary": "Breezy and mild now, cooling down with clear skies come evening"}
{"clothing_suggestion": "Airy top and light layers", "daily_summary": "Tomorrow foggy and cool early, clearing to sunny skies and warm temperatures"}
{"clothing_suggestion": "Warm jacket and scarf", "daily_summary": "Misty morning transforming into a gorgeous mild but sunny afternoon"}

Remember:
- Daily summary must be at least 60 characters and CANNOT be more than 78 total characters (including spaces and punctuation)
- You MUST return valid JSON ONLY
`;

    const now = new Date();
    const month = now.toLocaleString('default', { month: 'long' });
    const day = now.getDate();
    const hour = now.getHours();
    const ampm = hour < 12 ? 'AM' : 'PM';
    const time = `${hour % 12}:${String(now.getMinutes()).padStart(2, '0')} ${ampm}`;

    const userMessage = `Today is ${month} ${day}. It is ${timeContext.period.toUpperCase()}, ${time}. Planning for ${timeContext.planningFocus}

CURRENT WEATHER: ${current?.temp_f}°F, ${current?.description}
${weatherContext.dailyInfo}

HOURLY FORECAST:
${weatherContext.hourlyData}${weatherContext.contextNotes ? '\n\nNOTES: ' + weatherContext.contextNotes : ''}`;

    return { systemPrompt, userMessage };
  }

  buildWeatherContext({ current, relevantForecast, relevantHourly, isNight, moon, air_quality, timeContext }) {
    const context = { contextNotes: [] };

    // Daily info with smart rain mention
    const maxRainChance = Math.max(
      relevantForecast?.rain_chance || 0,
      ...relevantHourly.map(h => h.rain_chance || 0)
    );
    const rainMention = maxRainChance > 0 ? `, ${maxRainChance}% rain` : '';

    context.dailyInfo = isNight
      ? `TOMORROW: High ${relevantForecast?.high}°, Low ${relevantForecast?.low}°${rainMention}`
      : `TODAY: High ${relevantForecast?.high}°, Low ${relevantForecast?.low}°${rainMention}`;

    // Hourly data
    context.hourlyData = relevantHourly
      .map(h => `${h.time}: ${h.temp_f}° ${h.condition.trim()}${h.rain_chance > 0 ? ` (${h.rain_chance}%)` : ''}`)
      .join('\n');

    // Temperature swing
    const temps = relevantHourly.map(h => h.temp_f);
    const tempRange = Math.max(...temps) - Math.min(...temps);
    if (tempRange >= 15) {
      context.contextNotes.push(`${tempRange}° temperature swing`);
    }

    // Wind
    const maxWind = Math.max(...relevantHourly.map(h => h.wind_mph || 0));
    if (maxWind >= 12) {
      context.contextNotes.push(`Windy, gusts ${maxWind} mph`);
    }

    // Humidity extremes
    const humidity = current?.humidity;
    if (humidity >= 80) {
      context.contextNotes.push(`Humid (${humidity}%, muggy feel)`);
    } else if (humidity <= 30) {
      context.contextNotes.push(`Dry (${humidity}%, crisp feel)`);
    }

    // Sky transitions - enhanced with more detail
    const conditions = relevantHourly.map(h => h.condition.trim().toLowerCase());
    const uniqueConditions = [...new Set(conditions)];

    if (uniqueConditions.length > 1) {
      const firstCond = conditions[0];
      const lastCond = conditions[conditions.length - 1];

      // Find the transition point
      const transitionIndex = conditions.findIndex((c, i) => i > 0 && c !== conditions[i - 1]);
      if (transitionIndex > 0) {
        const transitionTime = relevantHourly[transitionIndex].time;
        context.contextNotes.push(`${firstCond} → ${lastCond} around ${transitionTime}`);
      } else if (firstCond !== lastCond) {
        context.contextNotes.push(`${firstCond} → ${lastCond}`);
      }
    }

    // Moon - enhanced descriptions
    if (moon && (timeContext.period === 'evening' || timeContext.period === 'night')) {
      if (moon.phase === 'full' || moon.illumination >= 95) {
        context.contextNotes.push('Full moon (bright night)');
      } else if (moon.phase === 'new' || moon.illumination <= 5) {
        context.contextNotes.push('New moon');
      } else if (moon.illumination >= 50 && moon.direction === 'waxing') {
        context.contextNotes.push(`Bright ${moon.phase.replace('_', ' ')} moon`);
      }
    }

    // Air quality
    if (air_quality?.aqi > 100) {
      context.contextNotes.push(`AQI ${air_quality.aqi} (${air_quality.category})`);
    }

    // Special conditions - enhanced
    const fogHours = relevantHourly.filter(h => 
      h.condition.toLowerCase().includes('fog') || h.condition.toLowerCase().includes('mist')
    );
    if (fogHours.length >= 2) {
      const fogStart = fogHours[0].time;
      const fogEnd = fogHours[fogHours.length-1].time;
      context.contextNotes.push(`Marine layer ${fogStart}-${fogEnd}`);
    }

    // Heat advisory
    const hotHours = relevantHourly.filter(h => h.temp_f >= 90);
    if (hotHours.length >= 2) {
      context.contextNotes.push(`Heat peak ${hotHours[0].time}-${hotHours[hotHours.length-1].time}`);
    }

    // Feels-like delta - when significantly different
    if (current?.feels_like_f && Math.abs(current.temp_f - current.feels_like_f) >= 5) {
      const delta = current.feels_like_f - current.temp_f;
      context.contextNotes.push(`Feels ${delta > 0 ? 'warmer' : 'cooler'} (${Math.abs(delta)}° diff)`);
    }

    // Limit to top 5
    context.contextNotes = context.contextNotes.slice(0, 5).join(' • ');
    return context;
  }

  getTimeContext() {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 11) {
      return { period: 'morning', planningFocus: 'the full day ahead. Describe how the day is starting and what to expect ahead. You MUST mention "today" or "this morning" once' };
    } else if (hour >= 11 && hour < 16) {
      return { period: 'afternoon', planningFocus: 'this afternoon and evening. Describe the current and upcoming conditions.' };
    } else if (hour >= 16 && hour < 20) {
      return { period: 'evening', planningFocus: 'tonight. Describe how the day is ending.' };
    } else {
      return { period: 'night', planningFocus: 'tomorrow. You MUST mention "tomorrow" once' };
    }
  }
}

module.exports = { LLMService };
