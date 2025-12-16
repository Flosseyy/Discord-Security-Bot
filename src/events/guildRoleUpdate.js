import { AuditLogEvent, Events, PermissionsBitField } from 'discord.js';
import { guildAllowed, isOwner } from '../utils/config.js';
import { createSecurityEmbed, createModerationButtons } from '../utils/securityEmbed.js';

// Configuration for role monitoring
const ROLE_MONITOR_CONFIG = {
  LOG_CHANNEL_ID: process.env.ROLE_MONITOR_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID,
  ENABLED: process.env.ROLE_MONITOR_ENABLED !== 'false',
  BLOCK_DANGEROUS_PERMS: process.env.BLOCK_DANGEROUS_ROLE_PERMS !== 'false',
  MONITOR_ROLE_HIERARCHY: process.env.MONITOR_ROLE_HIERARCHY !== 'false',
  AUTO_REVERT_ROLES: process.env.AUTO_REVERT_ROLES !== 'false',
  AUTO_DELETE_NEW_ROLES: process.env.AUTO_DELETE_NEW_ROLES !== 'false'
};

// All permissions to monitor
const ALL_PERMISSIONS = [
  'CreateInstantInvite', 'KickMembers', 'BanMembers', 'Administrator', 'ManageChannels',
  'ManageGuild', 'AddReactions', 'ViewAuditLog', 'PrioritySpeaker', 'Stream',
  'ViewChannel', 'SendMessages', 'SendTTSMessages', 'ManageMessages', 'EmbedLinks',
  'AttachFiles', 'ReadMessageHistory', 'MentionEveryone', 'UseExternalEmojis',
  'ViewGuildInsights', 'Connect', 'Speak', 'MuteMembers', 'DeafenMembers',
  'MoveMembers', 'UseVAD', 'ChangeNickname', 'ManageNicknames', 'ManageRoles',
  'ManageWebhooks', 'ManageEmojisAndStickers', 'UseApplicationCommands',
  'RequestToSpeak', 'ManageEvents', 'ManageThreads', 'CreatePublicThreads',
  'CreatePrivateThreads', 'UseExternalStickers', 'SendMessagesInThreads',
  'UseEmbeddedActivities', 'ModerateMembers'
];

function getPermissionChanges(oldPerms, newPerms) {
  const changes = [];
  
  for (const perm of ALL_PERMISSIONS) {
    if (PermissionsBitField.Flags[perm]) {
      const hadPerm = oldPerms.has(PermissionsBitField.Flags[perm]);
      const hasPerm = newPerms.has(PermissionsBitField.Flags[perm]);
      
      if (!hadPerm && hasPerm) {
        changes.push(`+ ${perm}`);
      } else if (hadPerm && !hasPerm) {
        changes.push(`- ${perm}`);
      }
    }
  }
  
  return changes;
}

async function logRoleChange(guild, oldRole, newRole, executor, changes) {
  try {
    const channel = await guild.channels.fetch(ROLE_MONITOR_CONFIG.LOG_CHANNEL_ID).catch(() => null);
    if (!channel) return;
    
    const fields = [
      { name: 'Role', value: `<@&${newRole.id}>\n\`${newRole.name}\``, inline: true },
      { name: 'Modified By', value: executor ? `<@${executor.id}>\n\`${executor.tag}\`` : 'Unknown', inline: true },
      { name: 'Position', value: `${oldRole.position} → ${newRole.position}`, inline: true }
    ];
    
    if (changes.length > 0) {
      fields.push({ name: 'Permission Changes', value: changes.join('\n'), inline: false });
    }
    
    const hasNewDangerousPerms = changes.some(change => change.startsWith('+'));
    const color = hasNewDangerousPerms ? 0xff4757 : 0xffa502;
    const title = hasNewDangerousPerms ? 'Dangerous Role Permissions Granted' : 'Role Permissions Modified';
    
    const embed = createSecurityEmbed(title, color, fields);
    
    // Add moderation buttons if dangerous permissions were granted and executor isn't owner
    let components = [];
    if (hasNewDangerousPerms && executor && !isOwner(guild, executor.id)) {
      components = [createModerationButtons(executor.id, 'role')];
    }
    
    await channel.send({ embeds: [embed], components });
  } catch (e) {
    console.error('Role monitor log error:', e.message);
  }
}

export default {
  name: Events.GuildRoleUpdate,
  async execute(oldRole, newRole) {
    try {
      if (!ROLE_MONITOR_CONFIG.ENABLED) return;
      if (!ROLE_MONITOR_CONFIG.LOG_CHANNEL_ID) return;
      if (!guildAllowed(newRole.guild)) return;
      
      // Get audit log entry
      const logs = await newRole.guild.fetchAuditLogs({ 
        type: AuditLogEvent.RoleUpdate, 
        limit: 1 
      }).catch(() => null);
      
      const entry = logs?.entries?.first();
      const executor = entry?.executor;
      
      // Check for permission changes
      const permissionChanges = getPermissionChanges(oldRole.permissions, newRole.permissions);
      
      // Check for position changes (hierarchy)
      const positionChanged = oldRole.position !== newRole.position;
      
      // Check for name/color changes
      const nameChanged = oldRole.name !== newRole.name;
      const colorChanged = oldRole.color !== newRole.color;
      
      // Log if there are significant changes
      if (permissionChanges.length > 0 || (ROLE_MONITOR_CONFIG.MONITOR_ROLE_HIERARCHY && positionChanged)) {
        const changes = [];
        
        if (permissionChanges.length > 0) {
          changes.push(...permissionChanges);
        }
        
        if (positionChanged) {
          changes.push(`Position: ${oldRole.position} → ${newRole.position}`);
        }
        
        if (nameChanged) {
          changes.push(`Name: "${oldRole.name}" → "${newRole.name}"`);
        }
        
        if (colorChanged) {
          changes.push(`Color: ${oldRole.hexColor} → ${newRole.hexColor}`);
        }
        
        await logRoleChange(newRole.guild, oldRole, newRole, executor, changes);
      }
      
    } catch (e) {
      console.error('Role monitor error:', e.message);
    }
  }
};
