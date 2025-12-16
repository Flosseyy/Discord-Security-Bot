import { AuditLogEvent, Events } from 'discord.js';
import { config, guildAllowed, isOwner } from '../utils/config.js';
import { logToChannel } from '../utils/logger.js';
import { recordAction, markPunished } from '../utils/actionTracker.js';
import { tryKickExecutor } from '../utils/moderation.js';

const MASS_BAN_CONFIG = {
  LOG_CHANNEL_ID: process.env.MASS_BAN_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID,
  ENABLED: process.env.MASS_BAN_ENABLED !== 'false',
  THRESHOLD: Number(process.env.MASS_BAN_THRESHOLD || config.THRESHOLD),
  WINDOW_SECONDS: Number(process.env.MASS_BAN_WINDOW_SECONDS || config.WINDOW_SECONDS)
};

function now() { return Date.now(); }

export default {
  name: Events.GuildBanAdd,
  async execute(ban) {
    try {
      if (!MASS_BAN_CONFIG.ENABLED) return;
      if (!MASS_BAN_CONFIG.LOG_CHANNEL_ID) {
        console.warn('Mass ban protection: No LOG_CHANNEL_ID configured');
        return;
      }

      const guild = ban.guild;
      if (!guildAllowed(guild)) return;

      // Look for ban in audit logs
      const logs = await guild.fetchAuditLogs({ 
        type: AuditLogEvent.MemberBanAdd, 
        limit: 1 
      }).catch(() => null);
      
      const entry = logs?.entries?.first();
      if (!entry) return;
      
      const { executor, target, createdTimestamp } = entry;
      
      // Only consider very recent and matching target
      if (!executor || !target || target.id !== ban.user.id) return;
      if (createdTimestamp < now() - 5000) return; // within 5s window

      // Don't punish the owner
      if (isOwner(guild, executor.id)) return;

      // Record the action and check threshold
      const counts = recordAction(guild.id, executor.id, 'ban');
      const total = counts.bans.length;

      if (total >= MASS_BAN_CONFIG.THRESHOLD) {
        // Check if we can punish (avoid double punishment)
        if (markPunished(guild.id, executor.id)) {
          const didKick = await tryKickExecutor(
            guild, 
            executor, 
            `Mass ban detected: ${total} bans in ${MASS_BAN_CONFIG.WINDOW_SECONDS}s`
          );
          
          await logToChannel(
            guild,
            MASS_BAN_CONFIG.LOG_CHANNEL_ID,
            `🚨 **Mass Ban Protection Triggered**\n` +
            `**Executor:** <@${executor.id}> (${executor.tag || executor.username})\n` +
            `**Actions:** ${total} bans in ${MASS_BAN_CONFIG.WINDOW_SECONDS}s\n` +
            `**Last Target:** <@${ban.user.id}>\n` +
            `**Action Taken:** ${didKick ? 'Executor kicked' : 'Failed to kick executor (insufficient permissions)'}`
          );
        }
      }
    } catch (e) {
      console.error('Mass ban protection error:', e.message);
    }
  }
};
