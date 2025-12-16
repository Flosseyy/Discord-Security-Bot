import { AuditLogEvent, Events } from 'discord.js';
import { guildAllowed, isOwner } from '../utils/config.js';
import { createSecurityEmbed, createModerationButtons } from '../utils/securityEmbed.js';

// Configuration for server settings monitoring
const SERVER_MONITOR_CONFIG = {
  LOG_CHANNEL_ID: process.env.SERVER_MONITOR_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID,
  ENABLED: process.env.SERVER_MONITOR_ENABLED !== 'false',
  MONITOR_NAME_CHANGES: process.env.MONITOR_NAME_CHANGES !== 'false',
  MONITOR_ICON_CHANGES: process.env.MONITOR_ICON_CHANGES !== 'false',
  MONITOR_REGION_CHANGES: process.env.MONITOR_REGION_CHANGES !== 'false',
  MONITOR_VERIFICATION_CHANGES: process.env.MONITOR_VERIFICATION_CHANGES !== 'false',
  MONITOR_EXPLICIT_FILTER_CHANGES: process.env.MONITOR_EXPLICIT_FILTER_CHANGES !== 'false'
};

async function logServerChange(guild, changeType, details, executor, oldValue = null, newValue = null) {
  try {
    const channel = await guild.channels.fetch(SERVER_MONITOR_CONFIG.LOG_CHANNEL_ID).catch(() => null);
    if (!channel) return;
    
    const fields = [
      { name: 'Change Type', value: changeType, inline: true },
      { name: 'Modified By', value: executor ? `<@${executor.id}>\n\`${executor.tag}\`` : 'Unknown', inline: true },
      { name: 'Details', value: details, inline: false }
    ];
    
    if (oldValue !== null && newValue !== null) {
      fields.push({ 
        name: 'Change', 
        value: `**Before:** ${oldValue}\n**After:** ${newValue}`, 
        inline: false 
      });
    }
    
    // Determine if this is a potentially dangerous change
    const isDangerous = changeType.includes('Verification') || changeType.includes('Filter') || changeType.includes('Name');
    const color = isDangerous ? 0xff4757 : 0xffa502;
    const title = isDangerous ? 'Critical Server Setting Changed' : 'Server Setting Changed';
    
    const embed = createSecurityEmbed(title, color, fields);
    
    // Add moderation buttons for dangerous changes by non-owners
    let components = [];
    if (isDangerous && executor && !isOwner(guild, executor.id)) {
      components = [createModerationButtons(executor.id, 'server')];
    }
    
    await channel.send({ embeds: [embed], components });
  } catch (e) {
    console.error('Server monitor log error:', e.message);
  }
}

function getVerificationLevelString(level) {
  const levels = {
    0: 'None',
    1: 'Low (verified email)',
    2: 'Medium (registered for 5+ minutes)',
    3: 'High (member for 10+ minutes)',
    4: 'Very High (verified phone)'
  };
  return levels[level] || `Unknown (${level})`;
}

function getExplicitFilterString(level) {
  const levels = {
    0: 'Disabled',
    1: 'Members without roles',
    2: 'All members'
  };
  return levels[level] || `Unknown (${level})`;
}

export default {
  name: Events.GuildUpdate,
  async execute(oldGuild, newGuild) {
    try {
      if (!SERVER_MONITOR_CONFIG.ENABLED) return;
      if (!SERVER_MONITOR_CONFIG.LOG_CHANNEL_ID) return;
      if (!guildAllowed(newGuild)) return;
      
      // Skip vanity URL changes (handled by existing vanity protection)
      if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) return;
      
      // Get audit log entry
      const logs = await newGuild.fetchAuditLogs({ 
        type: AuditLogEvent.GuildUpdate, 
        limit: 1 
      }).catch(() => null);
      
      const entry = logs?.entries?.first();
      const executor = entry?.executor;
      
      // Check for server name changes
      if (SERVER_MONITOR_CONFIG.MONITOR_NAME_CHANGES && oldGuild.name !== newGuild.name) {
        await logServerChange(
          newGuild,
          'Server Name Change',
          'Server name has been modified',
          executor,
          oldGuild.name,
          newGuild.name
        );
      }
      
      // Check for icon changes
      if (SERVER_MONITOR_CONFIG.MONITOR_ICON_CHANGES && oldGuild.icon !== newGuild.icon) {
        await logServerChange(
          newGuild,
          'Server Icon Change',
          'Server icon has been modified',
          executor,
          oldGuild.icon ? 'Had custom icon' : 'No icon',
          newGuild.icon ? 'New custom icon' : 'Icon removed'
        );
      }
      
      // Check for verification level changes
      if (SERVER_MONITOR_CONFIG.MONITOR_VERIFICATION_CHANGES && oldGuild.verificationLevel !== newGuild.verificationLevel) {
        await logServerChange(
          newGuild,
          'Verification Level Change',
          'Server verification level has been modified',
          executor,
          getVerificationLevelString(oldGuild.verificationLevel),
          getVerificationLevelString(newGuild.verificationLevel)
        );
      }
      
      // Check for explicit content filter changes
      if (SERVER_MONITOR_CONFIG.MONITOR_EXPLICIT_FILTER_CHANGES && oldGuild.explicitContentFilter !== newGuild.explicitContentFilter) {
        await logServerChange(
          newGuild,
          'Content Filter Change',
          'Explicit content filter has been modified',
          executor,
          getExplicitFilterString(oldGuild.explicitContentFilter),
          getExplicitFilterString(newGuild.explicitContentFilter)
        );
      }
      
    } catch (e) {
      console.error('Server monitor error:', e.message);
    }
  }
};
