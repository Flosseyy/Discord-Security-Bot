import { AuditLogEvent, Events, ChannelType } from 'discord.js';
import { guildAllowed, isOwner } from '../utils/config.js';
import { createSecurityEmbed, createModerationButtons } from '../utils/securityEmbed.js';

const CHANNEL_MONITOR_CONFIG = {
  LOG_CHANNEL_ID: process.env.CHANNEL_MONITOR_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID,
  ENABLED: process.env.CHANNEL_MONITOR_ENABLED !== 'false',
  ALERT_ON_MASS_CREATION: process.env.ALERT_MASS_CHANNEL_CREATION !== 'false',
  MASS_CREATION_THRESHOLD: Number(process.env.MASS_CREATION_THRESHOLD || 5),
  MASS_CREATION_WINDOW: Number(process.env.MASS_CREATION_WINDOW || 60),
  AUTO_DELETE_CHANNELS: process.env.AUTO_DELETE_CHANNELS !== 'false',
  AUTO_DELETE_ON_MASS: process.env.AUTO_DELETE_ON_MASS !== 'false'
};

const creationTracker = new Map();

function getCreationMap(guildId) {
  if (!creationTracker.has(guildId)) creationTracker.set(guildId, new Map());
  return creationTracker.get(guildId);
}

function checkMassCreation(guildId, userId) {
  const guildMap = getCreationMap(guildId);
  const now = Date.now();
  const cutoff = now - (CHANNEL_MONITOR_CONFIG.MASS_CREATION_WINDOW * 1000);
  
  if (!guildMap.has(userId)) guildMap.set(userId, []);
  const userCreations = guildMap.get(userId);
  
  const recentCreations = userCreations.filter(timestamp => timestamp > cutoff);
  recentCreations.push(now);
  guildMap.set(userId, recentCreations);
  
  return recentCreations.length >= CHANNEL_MONITOR_CONFIG.MASS_CREATION_THRESHOLD;
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

async function logChannelCreation(guild, channel, executor, isMassCreation = false, wasDeleted = false) {
  try {
    const logChannel = await guild.channels.fetch(CHANNEL_MONITOR_CONFIG.LOG_CHANNEL_ID).catch(() => null);
    if (!logChannel) return;
    
    const fields = [
      { name: 'Channel', value: wasDeleted ? `\`#${channel.name}\` (ID: ${channel.id})` : `<#${channel.id}>\n\`${channel.name}\``, inline: true },
      { name: 'Type', value: getChannelTypeString(channel.type), inline: true },
      { name: 'Created By', value: executor ? `<@${executor.id}>\n\`${executor.tag}\`` : 'Unknown', inline: true }
    ];
    
    if (channel.parent) {
      fields.push({ name: 'Category', value: `${channel.parent.name}`, inline: true });
    }
    
    if (isMassCreation) {
      fields.push({ name: 'Alert', value: 'Mass channel creation detected!', inline: false });
    }
    
    if (wasDeleted) {
      fields.push({ name: 'Action Taken', value: 'Channel automatically deleted', inline: false });
    }
    
    const color = isMassCreation ? 0xff4757 : (wasDeleted ? 0xff6b6b : 0x2ed573);
    const title = isMassCreation ? 'Mass Channel Creation Alert' : (wasDeleted ? 'Channel Created & Auto-Deleted' : 'Channel Created');
    
    const embed = createSecurityEmbed(title, color, fields);
    
    // Add moderation buttons if mass creation and executor isn't owner
    let components = [];
    if (isMassCreation && executor && !isOwner(guild, executor.id)) {
      components = [createModerationButtons(executor.id, 'channel')];
    }
    
    await logChannel.send({ embeds: [embed], components });
  } catch (e) {
    console.error('Channel creation log error:', e.message);
  }
}

export default {
  name: Events.ChannelCreate,
  async execute(channel) {
    try {
      if (!CHANNEL_MONITOR_CONFIG.ENABLED) return;
      if (!CHANNEL_MONITOR_CONFIG.LOG_CHANNEL_ID) return;
      if (!channel.guild) return;
      if (!guildAllowed(channel.guild)) return;
      
      // Get audit log entry
      const logs = await channel.guild.fetchAuditLogs({ 
        type: AuditLogEvent.ChannelCreate, 
        limit: 1 
      }).catch(() => null);
      
      const entry = logs?.entries?.first();
      const executor = entry?.executor;
      
      // Check for mass creation
      let isMassCreation = false;
      if (CHANNEL_MONITOR_CONFIG.ALERT_ON_MASS_CREATION && executor) {
        isMassCreation = checkMassCreation(channel.guild.id, executor.id);
      }
      
      // Auto-delete channel if conditions are met
      let wasDeleted = false;
      if (executor && !isOwner(channel.guild, executor.id)) {
        const shouldDelete = (isMassCreation && CHANNEL_MONITOR_CONFIG.AUTO_DELETE_ON_MASS) || 
                           CHANNEL_MONITOR_CONFIG.AUTO_DELETE_CHANNELS;
        
        if (shouldDelete) {
          try {
            await channel.delete('Suspicious channel creation detected');
            wasDeleted = true;
          } catch (e) {
            console.error('Failed to auto-delete channel:', e.message);
          }
        }
      }
      
      await logChannelCreation(channel.guild, channel, executor, isMassCreation, wasDeleted);
      
    } catch (e) {
      console.error('Channel creation monitor error:', e.message);
    }
  }
};
