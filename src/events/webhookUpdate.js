import { AuditLogEvent, Events } from 'discord.js';
import { guildAllowed, isOwner } from '../utils/config.js';
import { createSecurityEmbed, createModerationButtons } from '../utils/securityEmbed.js';

// Configuration for integration monitoring
const INTEGRATION_MONITOR_CONFIG = {
  LOG_CHANNEL_ID: process.env.INTEGRATION_MONITOR_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID,
  ENABLED: process.env.INTEGRATION_MONITOR_ENABLED !== 'false',
  MONITOR_WEBHOOK_CREATION: process.env.MONITOR_WEBHOOK_CREATION !== 'false',
  MONITOR_WEBHOOK_DELETION: process.env.MONITOR_WEBHOOK_DELETION !== 'false',
  MONITOR_WEBHOOK_UPDATES: process.env.MONITOR_WEBHOOK_UPDATES !== 'false',
  ALERT_ON_MASS_WEBHOOKS: process.env.ALERT_MASS_WEBHOOKS !== 'false',
  MASS_WEBHOOK_THRESHOLD: Number(process.env.MASS_WEBHOOK_THRESHOLD || 3),
  MASS_WEBHOOK_WINDOW: Number(process.env.MASS_WEBHOOK_WINDOW || 60), // seconds
  AUTO_DELETE_WEBHOOKS: process.env.AUTO_DELETE_WEBHOOKS !== 'false',
  AUTO_DELETE_ON_MASS: process.env.AUTO_DELETE_WEBHOOKS_ON_MASS !== 'false'
};

// Track webhook creation: Map<guildId, Map<userId, timestamp[]>>
const webhookTracker = new Map();

function getWebhookMap(guildId) {
  if (!webhookTracker.has(guildId)) webhookTracker.set(guildId, new Map());
  return webhookTracker.get(guildId);
}

function checkMassWebhookCreation(guildId, userId) {
  const guildMap = getWebhookMap(guildId);
  const now = Date.now();
  const cutoff = now - (INTEGRATION_MONITOR_CONFIG.MASS_WEBHOOK_WINDOW * 1000);
  
  if (!guildMap.has(userId)) guildMap.set(userId, []);
  const userWebhooks = guildMap.get(userId);
  
  // Clean old entries
  const recentWebhooks = userWebhooks.filter(timestamp => timestamp > cutoff);
  recentWebhooks.push(now);
  guildMap.set(userId, recentWebhooks);
  
  return recentWebhooks.length >= INTEGRATION_MONITOR_CONFIG.MASS_WEBHOOK_THRESHOLD;
}

async function logWebhookActivity(guild, activityType, details, executor, webhookInfo = null, isMassCreation = false, wasDeleted = false) {
  try {
    const channel = await guild.channels.fetch(INTEGRATION_MONITOR_CONFIG.LOG_CHANNEL_ID).catch(() => null);
    if (!channel) return;
    
    const fields = [
      { name: 'Activity Type', value: activityType, inline: true },
      { name: 'User', value: executor ? `<@${executor.id}>\n\`${executor.tag}\`` : 'Unknown', inline: true },
      { name: 'Details', value: details, inline: false }
    ];
    
    if (webhookInfo) {
      fields.push({ 
        name: 'Webhook Info', 
        value: `**Name:** ${webhookInfo.name || 'Unknown'}\n**Channel:** <#${webhookInfo.channelId}>`, 
        inline: false 
      });
    }
    
    if (isMassCreation) {
      fields.push({ name: 'Alert', value: 'Mass webhook creation detected!', inline: false });
    }
    
    if (wasDeleted) {
      fields.push({ name: 'Action Taken', value: 'Webhook automatically deleted', inline: false });
    }
    
    const color = isMassCreation ? 0xff4757 : (wasDeleted ? 0xff6b6b : (activityType.includes('Created') ? 0x2ed573 : 0xff6b6b));
    const title = isMassCreation ? 'Mass Webhook Creation Alert' : (wasDeleted ? 'Webhook Created & Auto-Deleted' : `Webhook ${activityType}`);
    
    const embed = createSecurityEmbed(title, color, fields);
    
    // Add moderation buttons for mass creation or suspicious activity
    let components = [];
    if ((isMassCreation || activityType.includes('Created')) && executor && !isOwner(guild, executor.id)) {
      components = [createModerationButtons(executor.id, 'webhook')];
    }
    
    await channel.send({ embeds: [embed], components });
  } catch (e) {
    console.error('Integration monitor log error:', e.message);
  }
}

// Webhook creation monitoring
export const webhookCreate = {
  name: Events.WebhooksUpdate,
  async execute(channel) {
    try {
      if (!INTEGRATION_MONITOR_CONFIG.ENABLED) return;
      if (!INTEGRATION_MONITOR_CONFIG.MONITOR_WEBHOOK_CREATION) return;
      if (!INTEGRATION_MONITOR_CONFIG.LOG_CHANNEL_ID) return;
      if (!guildAllowed(channel.guild)) return;
      
      // Get audit log entry for webhook creation
      const logs = await channel.guild.fetchAuditLogs({ 
        type: AuditLogEvent.WebhookCreate, 
        limit: 1 
      }).catch(() => null);
      
      const entry = logs?.entries?.first();
      const executor = entry?.executor;
      const webhook = entry?.target;
      
      // Check for mass webhook creation
      let isMassCreation = false;
      if (INTEGRATION_MONITOR_CONFIG.ALERT_ON_MASS_WEBHOOKS && executor) {
        isMassCreation = checkMassWebhookCreation(channel.guild.id, executor.id);
      }
      
      await logWebhookActivity(
        channel.guild,
        'Created',
        `Webhook created in ${channel.name}`,
        executor,
        webhook ? { name: webhook.name, channelId: channel.id } : null,
        isMassCreation
      );
      
    } catch (e) {
      console.error('Webhook creation monitor error:', e.message);
    }
  }
};

// For bot integration monitoring, we'll use guildMemberAdd to detect bot additions
export const botAddition = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    try {
      if (!INTEGRATION_MONITOR_CONFIG.ENABLED) return;
      if (!INTEGRATION_MONITOR_CONFIG.LOG_CHANNEL_ID) return;
      if (!member.user.bot) return; // Only monitor bot additions
      if (!guildAllowed(member.guild)) return;
      
      // Get audit log entry for bot addition
      const logs = await member.guild.fetchAuditLogs({ 
        type: AuditLogEvent.BotAdd, 
        limit: 1 
      }).catch(() => null);
      
      const entry = logs?.entries?.first();
      const executor = entry?.executor;
      
      if (entry && entry.target && entry.target.id === member.user.id) {
        await logWebhookActivity(
          member.guild,
          'Bot Added',
          `Bot "${member.user.tag}" was added to the server`,
          executor,
          { name: member.user.tag, channelId: 'N/A' }
        );
      }
      
    } catch (e) {
      console.error('Bot addition monitor error:', e.message);
    }
  }
};

// Export the webhook monitoring as default
export default webhookCreate;
