import { AuditLogEvent, Events } from 'discord.js';
import { guildAllowed, isOwner } from '../utils/config.js';
import { createSecurityEmbed, createModerationButtons } from '../utils/securityEmbed.js';

// Configuration for role creation monitoring
const ROLE_CREATE_CONFIG = {
  LOG_CHANNEL_ID: process.env.ROLE_MONITOR_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID,
  ENABLED: process.env.ROLE_MONITOR_ENABLED !== 'false',
  AUTO_DELETE_ROLES: process.env.AUTO_DELETE_NEW_ROLES !== 'false',
  ALERT_ON_MASS_CREATION: process.env.ALERT_MASS_ROLE_CREATION !== 'false',
  MASS_CREATION_THRESHOLD: Number(process.env.MASS_ROLE_THRESHOLD || 3),
  MASS_CREATION_WINDOW: Number(process.env.MASS_ROLE_WINDOW || 60) // seconds
};

// Track role creation: Map<guildId, Map<userId, timestamp[]>>
const roleCreationTracker = new Map();

function getRoleCreationMap(guildId) {
  if (!roleCreationTracker.has(guildId)) roleCreationTracker.set(guildId, new Map());
  return roleCreationTracker.get(guildId);
}

function checkMassRoleCreation(guildId, userId) {
  const guildMap = getRoleCreationMap(guildId);
  const now = Date.now();
  const cutoff = now - (ROLE_CREATE_CONFIG.MASS_CREATION_WINDOW * 1000);
  
  if (!guildMap.has(userId)) guildMap.set(userId, []);
  const userRoles = guildMap.get(userId);
  
  // Clean old entries
  const recentRoles = userRoles.filter(timestamp => timestamp > cutoff);
  recentRoles.push(now);
  guildMap.set(userId, recentRoles);
  
  return recentRoles.length >= ROLE_CREATE_CONFIG.MASS_CREATION_THRESHOLD;
}

async function logRoleCreation(guild, role, executor, isMassCreation = false, wasDeleted = false) {
  try {
    const channel = await guild.channels.fetch(ROLE_CREATE_CONFIG.LOG_CHANNEL_ID).catch(() => null);
    if (!channel) return;
    
    const fields = [
      { name: 'Role', value: wasDeleted ? `\`@${role.name}\` (ID: ${role.id})` : `<@&${role.id}>\n\`${role.name}\``, inline: true },
      { name: 'Created By', value: executor ? `<@${executor.id}>\n\`${executor.tag}\`` : 'Unknown', inline: true },
      { name: 'Color', value: role.hexColor || 'Default', inline: true }
    ];
    
    if (role.permissions.bitfield > 0) {
      const perms = role.permissions.toArray().slice(0, 5); // Show first 5 permissions
      fields.push({ name: 'Permissions', value: perms.length > 0 ? perms.join(', ') + (role.permissions.toArray().length > 5 ? '...' : '') : 'None', inline: false });
    }
    
    if (isMassCreation) {
      fields.push({ name: 'Alert', value: 'Mass role creation detected!', inline: false });
    }
    
    if (wasDeleted) {
      fields.push({ name: 'Action Taken', value: 'Role automatically deleted', inline: false });
    }
    
    const color = isMassCreation ? 0xff4757 : (wasDeleted ? 0xff6b6b : 0x2ed573);
    const title = isMassCreation ? 'Mass Role Creation Alert' : (wasDeleted ? 'Role Created & Auto-Deleted' : 'Role Created');
    
    const embed = createSecurityEmbed(title, color, fields);
    
    // Add moderation buttons if mass creation and executor isn't owner
    let components = [];
    if (isMassCreation && executor && !isOwner(guild, executor.id)) {
      components = [createModerationButtons(executor.id, 'role')];
    }
    
    await channel.send({ embeds: [embed], components });
  } catch (e) {
    console.error('Role creation log error:', e.message);
  }
}

export default {
  name: Events.GuildRoleCreate,
  async execute(role) {
    try {
      if (!ROLE_CREATE_CONFIG.ENABLED) return;
      if (!ROLE_CREATE_CONFIG.LOG_CHANNEL_ID) return;
      if (!guildAllowed(role.guild)) return;
      
      // Get audit log entry
      const logs = await role.guild.fetchAuditLogs({ 
        type: AuditLogEvent.RoleCreate, 
        limit: 1 
      }).catch(() => null);
      
      const entry = logs?.entries?.first();
      const executor = entry?.executor;
      
      // Check for mass creation
      let isMassCreation = false;
      if (ROLE_CREATE_CONFIG.ALERT_ON_MASS_CREATION && executor) {
        isMassCreation = checkMassRoleCreation(role.guild.id, executor.id);
      }
      
      // Auto-delete role if conditions are met
      let wasDeleted = false;
      if (executor && !isOwner(role.guild, executor.id)) {
        if (ROLE_CREATE_CONFIG.AUTO_DELETE_ROLES || isMassCreation) {
          try {
            await role.delete('Suspicious role creation detected');
            wasDeleted = true;
          } catch (e) {
            console.error('Failed to auto-delete role:', e.message);
          }
        }
      }
      
      await logRoleCreation(role.guild, role, executor, isMassCreation, wasDeleted);
      
    } catch (e) {
      console.error('Role creation monitor error:', e.message);
    }
  }
};
