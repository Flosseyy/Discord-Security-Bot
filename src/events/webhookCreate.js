import { AuditLogEvent, Events } from 'discord.js';
import { guildAllowed, isOwner } from '../utils/config.js';
import { createSecurityEmbed, createModerationButtons } from '../utils/securityEmbed.js';

// Configuration for webhook monitoring
const WEBHOOK_MONITOR_CONFIG = {
  LOG_CHANNEL_ID: process.env.INTEGRATION_MONITOR_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID,
  ENABLED: process.env.INTEGRATION_MONITOR_ENABLED !== 'false',
  AUTO_DELETE_WEBHOOKS: process.env.AUTO_DELETE_WEBHOOKS !== 'false',
  ALERT_ON_MASS_WEBHOOKS: process.env.ALERT_MASS_WEBHOOKS !== 'false',
  MASS_WEBHOOK_THRESHOLD: Number(process.env.MASS_WEBHOOK_THRESHOLD || 3),
  MASS_WEBHOOK_WINDOW: Number(process.env.MASS_WEBHOOK_WINDOW || 60), // seconds
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
  const cutoff = now - (WEBHOOK_MONITOR_CONFIG.MASS_WEBHOOK_WINDOW * 1000);
  
  if (!guildMap.has(userId)) guildMap.set(userId, []);
  const userWebhooks = guildMap.get(userId);
  
  // Clean old entries
  const recentWebhooks = userWebhooks.filter(timestamp => timestamp > cutoff);
  recentWebhooks.push(now);
  guildMap.set(userId, recentWebhooks);
  
  return recentWebhooks.length >= WEBHOOK_MONITOR_CONFIG.MASS_WEBHOOK_THRESHOLD;
}

async function logWebhookCreation(guild, channel, executor, webhookName, isMassCreation = false, wasDeleted = false) {
  try {
    const logChannel = await guild.channels.fetch(WEBHOOK_MONITOR_CONFIG.LOG_CHANNEL_ID).catch(() => null);
    if (!logChannel) return;
    
    const fields = [
      { name: 'Webhook Name', value: webhookName || 'Unknown', inline: true },
      { name: 'Channel', value: `<#${channel.id}>`, inline: true },
      { name: 'Created By', value: executor ? `<@${executor.id}>\n\`${executor.tag}\`` : 'Unknown', inline: true }
    ];
    
    if (isMassCreation) {
      fields.push({ name: 'Alert', value: 'Mass webhook creation detected!', inline: false });
    }
    
    if (wasDeleted) {
      fields.push({ name: 'Action Taken', value: 'Webhook automatically deleted', inline: false });
    }
    
    const color = isMassCreation ? 0xff4757 : (wasDeleted ? 0xff6b6b : 0x2ed573);
    const title = isMassCreation ? 'Mass Webhook Creation Alert' : (wasDeleted ? 'Webhook Created & Auto-Deleted' : 'Webhook Created');
    
    const embed = createSecurityEmbed(title, color, fields);
    
    // Add moderation buttons if mass creation and executor isn't owner
    let components = [];
    if (isMassCreation && executor && !isOwner(guild, executor.id)) {
      components = [createModerationButtons(executor.id, 'webhook')];
    }
    
    await logChannel.send({ embeds: [embed], components });
  } catch (e) {
    console.error('Webhook creation log error:', e.message);
  }
}

export default {
  name: Events.WebhooksUpdate,
  async execute(channel) {
    try {
      if (!WEBHOOK_MONITOR_CONFIG.ENABLED) return;
      if (!WEBHOOK_MONITOR_CONFIG.LOG_CHANNEL_ID) return;
      if (!guildAllowed(channel.guild)) return;
      
      // Get audit log entry for webhook creation
      const logs = await channel.guild.fetchAuditLogs({ 
        type: AuditLogEvent.WebhookCreate, 
        limit: 1 
      }).catch(() => null);
      
      const entry = logs?.entries?.first();
      const executor = entry?.executor;
      const webhook = entry?.target;
      
      if (!entry || !webhook) return;
      
      // Check for mass creation
      let isMassCreation = false;
      if (WEBHOOK_MONITOR_CONFIG.ALERT_ON_MASS_WEBHOOKS && executor) {
        isMassCreation = checkMassWebhookCreation(channel.guild.id, executor.id);
      }
      
      // Auto-delete webhook if conditions are met
      let wasDeleted = false;
      if (executor && !isOwner(channel.guild, executor.id)) {
        const shouldDelete = (isMassCreation && WEBHOOK_MONITOR_CONFIG.AUTO_DELETE_ON_MASS) || 
                           WEBHOOK_MONITOR_CONFIG.AUTO_DELETE_WEBHOOKS;
        
        if (shouldDelete) {
          try {
            // Get all webhooks in the channel and delete the newest one
            const webhooks = await channel.fetchWebhooks();
            const newestWebhook = webhooks.sort((a, b) => b.createdTimestamp - a.createdTimestamp).first();
            
            if (newestWebhook && newestWebhook.name === webhook.name) {
              await newestWebhook.delete('Suspicious webhook creation detected');
              wasDeleted = true;
            }
          } catch (e) {
            console.error('Failed to auto-delete webhook:', e.message);
          }
        }
      }
      
      await logWebhookCreation(channel.guild, channel, executor, webhook.name, isMassCreation, wasDeleted);
      
    } catch (e) {
      console.error('Webhook creation monitor error:', e.message);
    }
  }
};
