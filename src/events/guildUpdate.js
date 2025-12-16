import { AuditLogEvent, Events, PermissionsBitField } from 'discord.js';
import { guildAllowed, isOwner } from '../utils/config.js';
import { logToChannel } from '../utils/logger.js';
import { tryBanExecutor } from '../utils/moderation.js';

// Configuration for vanity URL protection
const VANITY_PROTECTION_CONFIG = {
  LOG_CHANNEL_ID: process.env.VANITY_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID,
  ENABLED: process.env.VANITY_PROTECTION_ENABLED !== 'false',
  BAN_VIOLATORS: process.env.VANITY_BAN_VIOLATORS !== 'false',
  REVERT_CHANGES: process.env.VANITY_REVERT_CHANGES !== 'false'
};

export default {
  name: Events.GuildUpdate,
  async execute(oldGuild, newGuild) {
    try {
      if (!VANITY_PROTECTION_CONFIG.ENABLED) return;
      if (!VANITY_PROTECTION_CONFIG.LOG_CHANNEL_ID) {
        console.warn('Vanity protection: No LOG_CHANNEL_ID configured');
        return;
      }

      if (!guildAllowed(newGuild)) return;
      
      const oldCode = oldGuild.vanityURLCode;
      const newCode = newGuild.vanityURLCode;

      // No vanity change detected
      if (oldCode === newCode) return;

      // Look for vanity change in audit logs
      const logs = await newGuild.fetchAuditLogs({ 
        type: AuditLogEvent.GuildUpdate, 
        limit: 5 
      }).catch(() => null);
      
      const entry = logs?.entries?.find(e => {
        // Find an entry where the change affected vanity_url_code
        return e.changes?.some(c => c.key === 'vanity_url_code');
      });
      
      if (!entry) return;
      
      const { executor, changes } = entry;
      if (!executor) return;

      const vanityChange = changes.find(c => c.key === 'vanity_url_code');
      const changedTo = vanityChange?.new ?? newCode;
      const changedFrom = vanityChange?.old ?? oldCode;

      // If the executor is the owner, just log the change
      if (isOwner(newGuild, executor.id)) {
        await logToChannel(
          newGuild,
          VANITY_PROTECTION_CONFIG.LOG_CHANNEL_ID,
          `ℹ️ **Vanity URL Changed by Owner**\n` +
          `**Owner:** <@${executor.id}> (${executor.tag || executor.username})\n` +
          `**Change:** \`${changedFrom || 'null'}\` ➜ \`${changedTo || 'null'}\``
        );
        return;
      }

      // Non-owner changed vanity - take action
      let didBan = false;
      let reverted = false;

      // Ban the violator if enabled
      if (VANITY_PROTECTION_CONFIG.BAN_VIOLATORS) {
        didBan = await tryBanExecutor(newGuild, executor, 'Unauthorized vanity URL change');
      }

      // Revert the vanity change if enabled
      if (VANITY_PROTECTION_CONFIG.REVERT_CHANGES) {
        try {
          if (typeof changedFrom !== 'undefined') {
            if (newGuild.features.includes('VANITY_URL') && 
                newGuild.members.me?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
              await newGuild.edit(
                { vanityURLCode: changedFrom || null }, 
                'Reverting unauthorized vanity change'
              );
              reverted = true;
            }
          }
        } catch (e) {
          console.error('Revert vanity error:', e.message);
        }
      }

      await logToChannel(
        newGuild,
        VANITY_PROTECTION_CONFIG.LOG_CHANNEL_ID,
        `🚨 **Unauthorized Vanity URL Change Detected**\n` +
        `**Violator:** <@${executor.id}> (${executor.tag || executor.username})\n` +
        `**Change:** \`${changedFrom || 'null'}\` ➜ \`${changedTo || 'null'}\`\n` +
        `**Actions Taken:**\n` +
        `• ${didBan ? '✅ Violator banned' : '❌ Failed to ban violator (insufficient permissions)'}\n` +
        `• ${reverted ? '✅ Vanity URL reverted' : '❌ Failed to revert vanity URL'}`
      );
    } catch (e) {
      console.error('Vanity protection error:', e.message);
    }
  }
};
