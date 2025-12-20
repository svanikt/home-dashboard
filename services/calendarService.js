const fs = require('fs');
const { google } = require('googleapis');
const { BaseService } = require('../lib/BaseService');
const { AUTH_PATH } = require('../lib/paths');

/**
 * Calendar Service (Google Calendar) - OPTIONAL
 * Provides upcoming calendar events
 */
class CalendarService extends BaseService {
  constructor(cacheTTLMinutes = 30) {
    super({
      name: 'Calendar',
      cacheKey: 'calendar',
      cacheTTL: cacheTTLMinutes * 60 * 1000,
      retryAttempts: 2,
      retryCooldown: 1000,
    });
  }

  isEnabled() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const auth = this.loadTokens();
    const hasTokens = auth.google?.tokens != null;
    return !!(clientId && clientSecret && hasTokens);
  }

  loadTokens() {
    try {
      if (fs.existsSync(AUTH_PATH)) {
        const auth = JSON.parse(fs.readFileSync(AUTH_PATH, 'utf-8'));
        return auth;
      }
    } catch (_) {}
    return {};
  }

  getOAuthClient(baseUrl) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${baseUrl}/auth/google/callback`;
    
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  getAuthorizedClient(baseUrl) {
    const oauth2Client = this.getOAuthClient(baseUrl);
    const auth = this.loadTokens();
    const tokens = auth.google?.tokens;
    if (!tokens) return null;

    oauth2Client.setCredentials(tokens);
    oauth2Client.on('tokens', (newTokens) => {
      const merged = { ...(tokens || {}), ...newTokens };
      this.saveTokens(merged);
    });

    return oauth2Client;
  }

  saveTokens(tokens) {
    try {
      const auth = fs.existsSync(AUTH_PATH) 
        ? JSON.parse(fs.readFileSync(AUTH_PATH, 'utf-8')) 
        : {};
      auth.google = auth.google || {};
      auth.google.tokens = tokens;
      fs.writeFileSync(AUTH_PATH, JSON.stringify(auth, null, 2));
    } catch (e) {
      console.warn('Failed to save Google tokens:', e.message);
    }
  }

  async fetchData(config, logger) {
    const authClient = this.getAuthorizedClient(config.baseUrl);
    if (!authClient) throw new Error('Google not authenticated');

    // Read selected calendars from auth.json
    const authData = this.loadTokens();
    const calendarIds = authData.google?.selectedCalendars || [];
    const timezone = config.timezone || 'America/New_York';

    if (calendarIds.length === 0) {
      throw new Error('No calendars selected');
    }

    const calendar = google.calendar({ version: 'v3', auth: authClient });

    const now = new Date();
    const timeMin = now.toISOString();
    // Fetch events for the next 7 days to have more events available
    const endOfWeek = new Date(now);
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    endOfWeek.setHours(23, 59, 59, 999);
    const timeMax = endOfWeek.toISOString();

    const allEvents = [];
    for (const calId of calendarIds) {
      try {
        const res = await calendar.events.list({
          calendarId: calId,
          timeMin,
          timeMax,
          maxResults: 50,
          singleEvents: true,
          orderBy: 'startTime',
          timeZone: timezone,
        });

        const items = res.data.items || [];
        for (const ev of items) {
          // Skip all-day events
          if (ev.start && ev.start.date && !ev.start.dateTime) continue;

          const start = ev.start.dateTime || ev.start.date;
          const end = ev.end?.dateTime || ev.end?.date;
          const startDate = new Date(start);
          const endDate = end ? new Date(end) : null;

          allEvents.push({
            title: ev.summary || 'Untitled',
            start,
            end,
            startDate,
            endDate,
            location: ev.location || null,
          });
        }
      } catch (e) {
        logger.warn?.(`[Calendar] Failed to fetch events for ${calId}: ${e.message}`);
      }
    }

    allEvents.sort((a, b) => a.startDate - b.startDate);

    // Time-adaptive filtering
    const cutoverHour = parseInt(process.env.CALENDAR_DISPLAY_HOUR_CUTOVER || '20', 10);
    const filteredEvents = this.filterEventsTimeAdaptive(allEvents, now, timezone, cutoverHour);

    return { events: filteredEvents, timezone, cutoverHour };
  }

  /**
   * Filter events based on time-adaptive logic with smart future event filling
   * - Always show remaining events from today
   * - Before cutover hour: show top 3 tomorrow events
   * - After cutover hour: show ALL tomorrow events
   * - If tomorrow is sparse (< 3 events), fill with future events up to ~8 total
   */
  filterEventsTimeAdaptive(allEvents, now, timezone, cutoverHour) {
    // Get current hour in the target timezone
    const currentHourInTz = parseInt(now.toLocaleString('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: timezone
    }), 10);

    // Determine date boundaries in target timezone
    const todayStr = now.toLocaleDateString('en-US', { timeZone: timezone });
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toLocaleDateString('en-US', { timeZone: timezone });

    const todayEvents = [];
    const tomorrowEvents = [];
    const futureEvents = [];

    for (const ev of allEvents) {
      const eventDateStr = ev.startDate.toLocaleDateString('en-US', { timeZone: timezone });
      const eventEnded = ev.endDate ? now >= ev.endDate : false;

      if (eventDateStr === todayStr && !eventEnded) {
        todayEvents.push(ev);
      } else if (eventDateStr === tomorrowStr) {
        tomorrowEvents.push(ev);
      } else if (ev.startDate > tomorrow) {
        futureEvents.push(ev);
      }
    }

    // Apply smart prioritization
    let result = [...todayEvents];
    const maxTotalEvents = 5; // Limit to 5 events to fit screen comfortably (800x480 display)

    if (currentHourInTz >= cutoverHour) {
      // After cutover: show ALL tomorrow events
      result = result.concat(tomorrowEvents);

      // If we have room and tomorrow is sparse, add future events
      const remainingSlots = maxTotalEvents - result.length;
      if (remainingSlots > 0 && tomorrowEvents.length < 3) {
        result = result.concat(futureEvents.slice(0, remainingSlots));
      }
    } else {
      // Before cutover: show top 3 tomorrow events
      const tomorrowToShow = Math.min(3, tomorrowEvents.length);
      result = result.concat(tomorrowEvents.slice(0, tomorrowToShow));

      // If tomorrow has fewer than 3 events, fill with future events
      if (tomorrowToShow < 3) {
        const remainingSlots = maxTotalEvents - result.length;
        if (remainingSlots > 0) {
          result = result.concat(futureEvents.slice(0, remainingSlots));
        }
      }
    }

    // Ensure we never exceed max events to fit screen
    return result.slice(0, maxTotalEvents);
  }

  mapToDashboard(apiData, config) {
    const now = new Date();
    const timezone = apiData.timezone || 'America/New_York';

    const todayStr = now.toLocaleDateString('en-US', { timeZone: timezone });
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toLocaleDateString('en-US', { timeZone: timezone });

    return apiData.events.map(ev => {
      const eventDateStr = ev.startDate.toLocaleDateString('en-US', { timeZone: timezone });
      const isToday = eventDateStr === todayStr;
      const isTomorrow = eventDateStr === tomorrowStr;

      const timeStr = ev.startDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: timezone
      }).toLowerCase();

      let dayLabel = '';
      if (isToday) {
        dayLabel = 'TODAY';
      } else if (isTomorrow) {
        dayLabel = 'TOMORROW';
      } else {
        // For future days, show day of week and date (e.g., "SUN DEC 22")
        const dayOfWeek = ev.startDate.toLocaleDateString('en-US', {
          weekday: 'short',
          timeZone: timezone
        }).toUpperCase();
        const month = ev.startDate.toLocaleDateString('en-US', {
          month: 'short',
          timeZone: timezone
        }).toUpperCase();
        const day = ev.startDate.toLocaleDateString('en-US', {
          day: 'numeric',
          timeZone: timezone
        });
        dayLabel = `${dayOfWeek} ${month} ${day}`;
      }

      return {
        title: ev.title,
        time: timeStr,
        dayLabel,
        location: ev.location,
      };
    });
  }

  formatRelativeTime(dateStr, now, tz) {
    const target = new Date(dateStr);
    const sameDay = target.toLocaleDateString('en-US', { timeZone: tz }) === now.toLocaleDateString('en-US', { timeZone: tz });
    
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrow = target.toLocaleDateString('en-US', { timeZone: tz }) === tomorrow.toLocaleDateString('en-US', { timeZone: tz });
    
    const timeStr = target.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz }).toLowerCase();
    
    if (sameDay) return `Today at ${timeStr}`;
    if (isTomorrow) return `Tomorrow at ${timeStr}`;
    
    const diffDays = Math.round((target - now) / (1000 * 60 * 60 * 24));
    if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days at ${timeStr}`;
    
    const weekday = target.toLocaleDateString('en-US', { weekday: 'long', timeZone: tz });
    return `${weekday} at ${timeStr}`;
  }
}

// OAuth helper functions for server.js
const service = new CalendarService();

function buildAuthUrl(baseUrl) {
  const oauth2Client = service.getOAuthClient(baseUrl);
  const scopes = ['https://www.googleapis.com/auth/calendar.readonly'];
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
  });
}

async function handleOAuthCallback(baseUrl, code) {
  const oauth2Client = service.getOAuthClient(baseUrl);
  const { tokens } = await oauth2Client.getToken(code);
  service.saveTokens(tokens);
  return tokens;
}

function isAuthed() {
  const auth = service.loadTokens();
  const tokens = auth.google?.tokens;
  return !!(tokens && (tokens.refresh_token || tokens.access_token));
}

async function listCalendars(baseUrl, logger = console) {
  const auth = service.getAuthorizedClient(baseUrl);
  if (!auth) throw new Error('Google not authenticated');
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.calendarList.list({ maxResults: 250 });
  const items = res.data.items || [];
  return items.map(it => ({ id: it.id, summary: it.summary, primary: !!it.primary }));
}

module.exports = {
  CalendarService,
  buildAuthUrl,
  handleOAuthCallback,
  isAuthed,
  listCalendars,
};
