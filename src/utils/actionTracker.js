import { config } from './config.js';

function now() { return Date.now(); }
function cutoff() { return now() - config.WINDOW_SECONDS * 1000; }

// actionCounts: Map<guildId, Map<executorId, { kicks: number[], bans: number[] }>>
const actionCounts = new Map();
// punishedRecently: Map<guildId, Set<executorId>> to avoid double punishment bursts
const punishedRecently = new Map();

function getGuildMap(guildId) {
  if (!actionCounts.has(guildId)) actionCounts.set(guildId, new Map());
  return actionCounts.get(guildId);
}

function getPunishedSet(guildId) {
  if (!punishedRecently.has(guildId)) punishedRecently.set(guildId, new Set());
  return punishedRecently.get(guildId);
}

export function recordAction(guildId, executorId, kind) {
  const gmap = getGuildMap(guildId);
  if (!gmap.has(executorId)) gmap.set(executorId, { kicks: [], bans: [] });
  const entry = gmap.get(executorId);
  const t = now();
  
  // prune old entries
  entry.kicks = entry.kicks.filter(ts => ts >= cutoff());
  entry.bans = entry.bans.filter(ts => ts >= cutoff());
  
  // add new entry
  if (kind === 'kick') entry.kicks.push(t);
  if (kind === 'ban') entry.bans.push(t);
  
  return entry;
}

export function markPunished(guildId, executorId) {
  const punished = getPunishedSet(guildId);
  if (punished.has(executorId)) return false; // already punished
  
  punished.add(executorId);
  // clear after short cooldown
  setTimeout(() => punished.delete(executorId), 60_000);
  return true;
}
