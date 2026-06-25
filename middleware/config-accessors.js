import crypto from 'crypto';
import { getConfig } from '../services/config.js';

export function getPort() {
  return Number(getConfig().RECNOTES_PORT) || 3000;
}

export function getApiToken() {
  const config = getConfig();
  let token = config.RECNOTES_AUTH_API_TOKEN;
  if (!token) {
    const username = config.RECNOTES_AUTH_USERNAME;
    const password = config.RECNOTES_AUTH_PASSWORD;
    if (username && password) {
      token = crypto
        .createHash('sha256')
        .update(`${username}:${password}`)
        .digest('hex');
    }
  }
  return token;
}

export function wasApiTokenExplicitlySet() {
  return !!getConfig().RECNOTES_AUTH_API_TOKEN;
}

export function getAuthCredentials() {
  const config = getConfig();
  return {
    username: config.RECNOTES_AUTH_USERNAME,
    password: config.RECNOTES_AUTH_PASSWORD,
  };
}

export function authIsRequired() {
  const config = getConfig();
  return !!(config.RECNOTES_AUTH_USERNAME && config.RECNOTES_AUTH_PASSWORD);
}

export function getSessionSecret() {
  return getConfig().RECNOTES_SESSION_SECRET || crypto.randomBytes(32).toString('hex');
}

export function getExportTimezone() {
  return getConfig().RECNOTES_EXPORT_TIMEZONE || 'UTC';
}

/**
 * Validate that a timezone string is a valid IANA timezone name.
 * Returns true if valid, throws RangeError if not.
 * Note: 'UTC' is accepted as a special case (works with Intl.DateTimeFormat but not in Intl.supportedValuesOf).
 */
export function validateTimezone(tz) {
  if (!tz || typeof tz !== 'string') {
    throw new RangeError(`Invalid timezone: ${JSON.stringify(tz)}`);
  }
  // 'UTC' is valid for Intl.DateTimeFormat but not in Intl.supportedValuesOf('timeZone')
  if (tz === 'UTC') return true;
  const valid = Intl.supportedValuesOf('timeZone');
  if (!valid.includes(tz)) {
    throw new RangeError(`Invalid timezone '${tz}'. Must be a valid IANA timezone name (e.g. UTC, America/New_York, Europe/London).`);
  }
  return true;
}
