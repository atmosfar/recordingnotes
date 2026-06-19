import { Router } from 'express';
import { getDb } from '../services/db.js';
import * as sessions from '../services/sessions.js';
import * as notes from '../services/notes.js';
import { getExportTimezone } from '../middleware/config-accessors.js';

const router = Router();

const FRAMERATES = {
  '23.976': 24000/1001,
  '24': 24,
  '25': 25,
  '29.97DF': 30000/1001,
  '29.97NDF': 30000/1001,
  '30': 30
};

/**
 * Converts seconds to SMPTE timecode (HH:MM:SS:FF or HH:MM:SS;FF)
 *
 * Algorithm: wall-clock seconds → integer frame count → decompose into H:M:S;F
 * Drop-frame uses 10-minute blocks (17982 frames) where minute 0 has no drop
 * and minutes 1-9 each skip 2 frame numbers (displayed ;02-;29 instead of ;00-;27).
 */
export function timeToHmsf(totalSeconds, frameRate, isDfMode) {
  const nominalFps = Math.round(frameRate);
  let hh, mm, ss, ff;

  if (isDfMode) {
    // Drop-frame: convert frame count to DF timecode
    // 10-minute block = 17982 frames (1800 + 9*1798)
    const totalFrames = Math.round(totalSeconds * frameRate);
    const blocks = Math.floor(totalFrames / 17982);
    const remainder = totalFrames % 17982;

    let offM, offsetInMin;
    if (remainder < 1800) {
      // Minute 0 within block (no drop)
      offM = 0;
      offsetInMin = remainder;
    } else {
      // Minutes 1-9 (each has 1798 frames, 2 dropped)
      offM = 1 + Math.floor((remainder - 1800) / 1798);
      offsetInMin = (remainder - 1800) % 1798;
    }

    if (offM % 10 === 0) {
      ss = Math.floor(offsetInMin / nominalFps);
      ff = offsetInMin % nominalFps;
    } else {
      ss = Math.floor(offsetInMin / nominalFps);
      ff = (offsetInMin % nominalFps) + 2;
      // Handle overflow: frame 28+2=30 carries to next second
      if (ff >= nominalFps) {
        ss += 1;
        ff -= nominalFps;
      }
    }

    const totalM = blocks * 10 + offM;
    hh = Math.floor(totalM / 60) % 24;
    mm = totalM % 60;
  } else {
    // Non-drop-frame: straightforward decomposition using nominal fps
    const totalFrames = Math.round(totalSeconds * frameRate);
    const totalSecs = Math.floor(totalFrames / nominalFps);
    ff = totalFrames % nominalFps;
    ss = totalSecs % 60;
    mm = Math.floor(totalSecs / 60) % 60;
    hh = Math.floor(totalSecs / 3600) % 24;
  }

  const separator = isDfMode ? ';' : ':';
  return [
    hh.toString().padStart(2, '0'),
    mm.toString().padStart(2, '0'),
    ss.toString().padStart(2, '0')
  ].join(':') + separator + ff.toString().padStart(2, '0');
}

/**
 * Maps hex colors to Resolve-compatible color strings
 */
export function mapColorToResolve(hex) {
  const colorMap = {
    '#FF4D4D': 'Red',
    '#2ECC71': 'Green',
    '#3498DB': 'Blue',
    '#F1C40F': 'Yellow'
  };
  const upperHex = (hex || '').toUpperCase();
  return colorMap[upperHex] || 'Blue';
}

/**
 * Formats duration in seconds to HH:MM:SS.mmm
 */
export function formatDuration(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [
    hrs.toString().padStart(2, '0'),
    mins.toString().padStart(2, '0'),
    secs.toFixed(3).padStart(6, '0')
  ].join(':');
}

router.get('/:id/export', (req, res) => {
  try {
    const db = getDb();
    const session = sessions.getSession(db, req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const list = notes.listNotesBySession(db, req.params.id);
    const format = req.query.format || 'reaper';
    
    let content = '';
    let contentType = 'text/csv';
    let extension = 'csv';

    // Helper: convert timestamp_ms to seconds-since-midnight in the configured export timezone
    function timestampToSeconds(note) {
      const ts = note.timestamp_ms;
      if (session.timestamp_mode === 'timer') {
        // Use stored timer position if available (correct for multi-run sessions)
        if (note.timer_position_ms != null) {
          return note.timer_position_ms / 1000;
        }
        const sessionStartMs = session.started_at ? new Date(session.started_at).getTime() : 0;
        return (ts - sessionStartMs) / 1000;
      } else {
        const exportTimezone = getExportTimezone();
        const parts = new Intl.DateTimeFormat('en-GB', {
          timeZone: exportTimezone,
          hour: 'numeric', hour12: false,
          minute: 'numeric',
          second: 'numeric',
          fractionalSecondDigits: 3
        }).formatToParts(ts);

        const get = (type) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
        const hrs = get('hour');
        const mins = get('minute');
        const secs = get('second');
        const ms = Math.round(ts % 1000);
        return (hrs * 3600) + (mins * 60) + secs + ms / 1000;
      }
    }

    if (format === 'edl') {
      const fpsKey = req.query.fps || '23.976';
      const frameRate = FRAMERATES[fpsKey] || FRAMERATES['23.976'];
      const isDfMode = fpsKey.includes('DF');
      
      content = `TITLE: ${session.name.substring(0, 255)}\n`;
      content += `FCM: ${isDfMode ? 'DROP FRAME' : 'NON-DROP FRAME'}\n\n`;
      
      list.forEach((note, index) => {
        const entryNum = (index + 1).toString().padStart(3, '0');
        const color = mapColorToResolve(note.color);
        const seconds = timestampToSeconds(note);
        const startTimecode = timeToHmsf(seconds, frameRate, isDfMode);
        const endTimecode = timeToHmsf(seconds + (1 / frameRate), frameRate, isDfMode);
        
        content += `${entryNum}  001      V     C        ${startTimecode} ${endTimecode} ${startTimecode} ${endTimecode}  \n`;
        content += ` |C:ResolveColor${color} |M:${note.content.replace(/[|]/g, '')} |D:1\n\n`;
      });
      
      contentType = 'text/plain';
      extension = 'edl';
    } else if (format === 'audition') {
      content = 'Name\tStart\tDuration\tTime Format\tType\tDescription\n';
      list.forEach((note) => {
        const name = note.content.replace(/"/g, '""');
        const seconds = timestampToSeconds(note);
        const start = formatDuration(seconds);
        const duration = '0:00.000';
        content += `${name}\t${start}\t${duration}\tdecimal\tCue\t\n`;
      });
    } else {
      // Default to REAPER
      content = '#,Name,Start,End,Length,Color\n';
      list.forEach((note, index) => {
        const name = `"${note.content.replace(/"/g, '""')}"`;
        const marker = `M${index + 1}`;
        const color = note.color ? note.color.replace('#', '').toUpperCase() : '';
        const seconds = timestampToSeconds(note);
        const timestamp = formatDuration(seconds);
        content += `${marker},${name},${timestamp},,,${color}\n`;
      });
    }

    const sanitizedName = session.name.trim().replace(/\s+/g, '_').replace(/[^a-z0-9_.-]/gi, '') || `session-${req.params.id}`;
    const filename = format === extension ? `${sanitizedName}.${extension}` : `${sanitizedName}_${format}.${extension}`;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    console.error('GET /api/sessions/:id/export error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
