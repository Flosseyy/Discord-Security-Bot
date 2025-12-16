import { AuditLogEvent, Events } from 'discord.js';
import { config, guildAllowed, isOwner } from '../utils/config.js';
import { logToChannel } from '../utils/logger.js';
import { recordAction, markPunished } from '../utils/actionTracker.js';
import { tryKickExecutor } from '../utils/moderation.js';

// Configuration for mass kick protection
const MASS_KICK_CONFIG = {
  LOG_CHANNEL_ID: process.env.MASS_KICK_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID,
  ENABLED: process.env.MASS_KICK_ENABLED !== 'false',
  THRESHOLD: Number(process.env.MASS_KICK_THRESHOLD || config.THRESHOLD),
  WINDOW_SECONDS: Number(process.env.MASS_KICK_WINDOW_SECONDS || config.WINDOW_SECONDS)
};

function now() { return Date.now(); }

export default {
  name: Events.GuildMemberRemove,
  async execute(member) {
    try {
      if (!MASS_KICK_CONFIG.ENABLED) return;
      if (!MASS_KICK_CONFIG.LOG_CHANNEL_ID) {
        console.warn('Mass kick protection: No LOG_CHANNEL_ID configured');
        return;
      }

      const guild = member.guild;
      if (!guildAllowed(guild)) return;

      const logs = await guild.fetchAuditLogs({ 
        type: AuditLogEvent.MemberKick, 
        limit: 1 
      }).catch(() => null);
      
      const entry = logs?.entries?.first();
      if (!entry) return;
      
      const { executor, target, createdTimestamp } = entry;
      
      if (!executor || !target || target.id !== member.id) return;
      if (createdTimestamp < now() - 5000) return;

      if (isOwner(guild, executor.id)) return;

      const counts = recordAction(guild.id, executor.id, 'kick');
      const total = counts.kicks.length;

      if (total >= MASS_KICK_CONFIG.THRESHOLD) {
        if (markPunished(guild.id, executor.id)) {
          const didKick = await tryKickExecutor(
            guild, 
            executor, 
            `Mass kick detected: ${total} kicks in ${MASS_KICK_CONFIG.WINDOW_SECONDS}s`
          );
          
          await logToChannel(
            guild,
            MASS_KICK_CONFIG.LOG_CHANNEL_ID,
            `**Mass Kick Protection Triggered**\n` +
            `**Executor:** <@${executor.id}> (${executor.tag || executor.username})\n` +
            `**Actions:** ${total} kicks in ${MASS_KICK_CONFIG.WINDOW_SECONDS}s\n` +
            `**Last Target:** <@${member.id}>\n` +
            `**Action Taken:** ${didKick ? 'Executor kicked' : 'Failed to kick executor (insufficient permissions)'}`
          );
        }
      }
    } catch (e) {
      console.error('Mass kick protection error:', e.message);
    }
  }
};
