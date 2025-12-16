import { AuditLogEvent, Events, ChannelType } from 'discord.js';
import { guildAllowed, isOwner } from '../utils/config.js';
import { createSecurityEmbed, createModerationButtons } from '../utils/securityEmbed.js';

// Configuration for channel monitoring
const CHANNEL_MONITOR_CONFIG = {
  LOG_CHANNEL_ID: process.env.CHANNEL_MONITOR_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID,
  ENABLED: process.env.CHANNEL_MONITOR_ENABLED !== 'false',
  ALERT_ON_MASS_DELETION: process.env.ALERT_MASS_CHANNEL_DELETION !== 'false',
  MASS_DELETION_THRESHOLD: Number(process.env.MASS_DELETION_THRESHOLD || 3),
  MASS_DELETION_WINDOW: Number(process.env.MASS_DELETION_WINDOW || 60) // seconds
};

// Track channel deletion: Map<guildId, Map<userId, timestamp[]>>
const deletionTracker = new Map();

function getDeletionMap(guildId) {
  if (!deletionTracker.has(guildId)) deletionTracker.set(guildId, new Map());
  return deletionTracker.get(guildId);
}

function checkMassDeletion(guildId, userId) {
  const guildMap = getDeletionMap(guildId);
  const now = Date.now();
  const cutoff = now - (CHANNEL_MONITOR_CONFIG.MASS_DELETION_WINDOW * 1000);
  
  if (!guildMap.has(userId)) guildMap.set(userId, []);
  const userDeletions = guildMap.get(userId);
  
  // Clean old entries
  const recentDeletions = userDeletions.filter(timestamp => timestamp > cutoff);
  recentDeletions.push(now);
  guildMap.set(userId, recentDeletions);
  
  return recentDeletions.length >= CHANNEL_MONITOR_CONFIG.MASS_DELETION_THRESHOLD;
}

function getChannelTypeString(type) {
  const types = {
    [ChannelType.GuildText]: 'Text Channel',
    [ChannelType.GuildVoice]: 'Voice Channel',
    [ChannelType.GuildCategory]: 'Category',
    [ChannelType.GuildAnnouncement]: 'Announcement',
    [ChannelType.GuildStageVoice]: 'Stage Channel',
    [ChannelType.GuildForum]: 'Forum Channel',
    [ChannelType.GuildDirectory]: 'Directory'
  };
  return types[type] || 'Unknown Channel';
}

async function logChannelDeletion(guild, channel, executor, isMassDeletion = false) {
  try {
    const logChannel = await guild.channels.fetch(CHANNEL_MONITOR_CONFIG.LOG_CHANNEL_ID).catch(() => null);
    if (!logChannel) return;
    
    const fields = [
      { name: 'Channel', value: `\`#${channel.name}\`\nID: \`${channel.id}\``, inline: true },
      { name: 'Type', value: getChannelTypeString(channel.type), inline: true },
      { name: 'Deleted By', value: executor ? `<@${executor.id}>\n\`${executor.tag}\`` : 'Unknown', inline: true }
    ];
    
    if (channel.parent) {
      fields.push({ name: 'Category', value: `${channel.parent.name}`, inline: true });
    }
    
    if (isMassDeletion) {
      fields.push({ name: 'Alert', value: 'Mass channel deletion detected!', inline: false });
    }
    
    const color = isMassDeletion ? 0xff4757 : 0xff6b6b;
    const title = isMassDeletion ? 'Mass Channel Deletion Alert' : 'Channel Deleted';
    
    const embed = createSecurityEmbed(title, color, fields);
    
    // Add moderation buttons if mass deletion and executor isn't owner
    let components = [];
    if (isMassDeletion && executor && !isOwner(guild, executor.id)) {
      components = [createModerationButtons(executor.id, 'channel')];
    }
    
    await logChannel.send({ embeds: [embed], components });
  } catch (e) {
    console.error('Channel deletion log error:', e.message);
  }
}

export default {
  name: Events.ChannelDelete,
  async execute(channel) {
    try {
      if (!CHANNEL_MONITOR_CONFIG.ENABLED) return;
      if (!CHANNEL_MONITOR_CONFIG.LOG_CHANNEL_ID) return;
      if (!channel.guild) return;
      if (!guildAllowed(channel.guild)) return;
      
      // Get audit log entry
      const logs = await channel.guild.fetchAuditLogs({ 
        type: AuditLogEvent.ChannelDelete, 
        limit: 1 
      }).catch(() => null);
      
      const entry = logs?.entries?.first();
      const executor = entry?.executor;
      
      // Check for mass deletion
      let isMassDeletion = false;
      if (CHANNEL_MONITOR_CONFIG.ALERT_ON_MASS_DELETION && executor) {
        isMassDeletion = checkMassDeletion(channel.guild.id, executor.id);
      }
      
      await logChannelDeletion(channel.guild, channel, executor, isMassDeletion);
      
    } catch (e) {
      console.error('Channel deletion monitor error:', e.message);
    }
  }
};
