import fs from 'fs';
import path from 'path';

const logsDir = path.join(process.cwd(), 'data', 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const logFile = path.join(logsDir, `events.csv`);
if (!fs.existsSync(logFile)) {
  fs.writeFileSync(logFile, 'ts,sessionId,event,payload\n');
}

export const logEvent = (sessionId: string, event: string, payload: any) => {
  const ts = new Date().toISOString();
  const line = `${ts},${sessionId},${event},${JSON.stringify(payload).replaceAll(',', ';')}\n`;
  fs.appendFileSync(logFile, line);
};

export const saveResultJson = (sessionId: string, result: any) => {
  const out = path.join(logsDir, `${sessionId}.result.json`);
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
};

