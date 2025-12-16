import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { guildAllowed, isOwner } from '../utils/config.js';
import { 
  getGuildRole, 
  setGuildRole, 
  getGuildUser,
  setGuildUser,
  hasBypassPermission
} from '../utils/guildPermissions.js';

const BYPASS_TYPES = [
  'MESSAGE_SECURITY_BYPASS_ROLES',
  'ALT_DETECTION_BYPASS_ROLES', 
  'MASS_KICK_BYPASS_ROLES',
  'MASS_BAN_BYPASS_ROLES',
  'VANITY_PROTECTION_BYPASS_ROLES',
  'ROLE_MONITOR_BYPASS_ROLES',
  'CHANNEL_MONITOR_BYPASS_ROLES',
  'MEMBER_UPDATE_BYPASS_ROLES',
  'SERVER_SETTINGS_BYPASS_ROLES',
  'INTEGRATION_MONITOR_BYPASS_ROLES'
];

export const data = new SlashCommandBuilder()
  .setName('bypass')
  .setDescription('Manage bypass permissions for users and roles (Owner only)')
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Add bypass permission')
      .addStringOption(option =>
        option.setName('type')
          .setDescription('Type of bypass to add')
          .setRequired(true)
          .addChoices(...BYPASS_TYPES.map(t => ({ 
            name: t.toLowerCase().replace(/_/g, ' '), 
            value: t 
          }))))
      .addRoleOption(option =>
        option.setName('role')
          .setDescription('Role to give bypass permission')
          .setRequired(false))
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to give bypass permission (creates temporary role)')
          .setRequired(false)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Remove bypass permission')
      .addStringOption(option =>
        option.setName('type')
          .setDescription('Type of bypass to remove')
          .setRequired(true)
          .addChoices(...BYPASS_TYPES.map(t => ({ 
            name: t.toLowerCase().replace(/_/g, ' '), 
            value: t 
          }))))
      .addRoleOption(option =>
        option.setName('role')
          .setDescription('Role to remove bypass permission from')
          .setRequired(false))
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to remove bypass permission from')
          .setRequired(false)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List all bypass permissions'));

export async function execute(interaction) {
  try {
    if (!guildAllowed(interaction.guild)) {
      return await interaction.reply({
        content: 'This bot is not authorized for this server.',
        ephemeral: true
      });
    }

    if (!isOwner(interaction.guild, interaction.user.id)) {
      return await interaction.reply({
        content: 'Only the server owner can manage bypass permissions.',
        ephemeral: true
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'list') {
      return await showBypassList(interaction);
    }

    const bypassType = interaction.options.getString('type');
    const role = interaction.options.getRole('role');
    const user = interaction.options.getUser('user');

    if (!role && !user) {
      return await interaction.reply({
        content: 'You must specify either a role or a user.',
        ephemeral: true
      });
    }

    if (role && user) {
      return await interaction.reply({
        content: 'You can only specify either a role OR a user, not both.',
        ephemeral: true
      });
    }

    if (subcommand === 'add') {
      await addBypass(interaction, bypassType, role, user);
    } else {
      await removeBypass(interaction, bypassType, role, user);
    }

  } catch (error) {
    console.error('Bypass command error:', error);
    await interaction.reply({
      content: 'An error occurred while managing bypass permissions.',
      ephemeral: true
    });
  }
}

async function addBypass(interaction, bypassType, role, user) {
  try {
    if (user) {
      // Handle user bypass directly
      const currentUsers = getGuildUser(interaction.guild.id, bypassType);
      
      if (currentUsers.includes(user.id)) {
        return await interaction.reply({
          content: `${user} already has ${formatBypassType(bypassType)} bypass.`,
          ephemeral: true
        });
      }

      currentUsers.push(user.id);
      setGuildUser(interaction.guild.id, bypassType, currentUsers);
      
      await logBypassAction(interaction.guild, interaction.user, null, user, bypassType, 'added');
      
      return await interaction.reply({
        content: `✅ Added ${formatBypassType(bypassType)} bypass to ${user}.`,
        ephemeral: true
      });
    }

    // Handle role bypass (existing functionality)
    const currentRoles = getGuildRole(interaction.guild.id, bypassType) || [];
    
    if (currentRoles.includes(role.id)) {
      return await interaction.reply({
        content: `${role} already has ${formatBypassType(bypassType)} bypass.`,
        ephemeral: true
      });
    }

    currentRoles.push(role.id);
    setGuildRole(interaction.guild.id, bypassType, currentRoles);

    await logBypassAction(interaction.guild, interaction.user, role, null, bypassType, 'added');

    await interaction.reply({
      content: `✅ Added ${formatBypassType(bypassType)} bypass to ${role}.`,
      ephemeral: true
    });

  } catch (error) {
    console.error('Add bypass error:', error);
    await interaction.reply({
      content: 'Failed to add bypass permission.',
      ephemeral: true
    });
  }
}

async function removeBypass(interaction, bypassType, role, user) {
  try {
    if (user) {
      // Handle user bypass removal
      const currentUsers = getGuildUser(interaction.guild.id, bypassType);
      
      if (!currentUsers.includes(user.id)) {
        return await interaction.reply({
          content: `${user} doesn't have ${formatBypassType(bypassType)} bypass.`,
          ephemeral: true
        });
      }

      const newUsers = currentUsers.filter(id => id !== user.id);
      setGuildUser(interaction.guild.id, bypassType, newUsers);
      
      await logBypassAction(interaction.guild, interaction.user, null, user, bypassType, 'removed');
      
      return await interaction.reply({
        content: `❌ Removed ${formatBypassType(bypassType)} bypass from ${user}.`,
        ephemeral: true
      });
    }

    // Handle role bypass removal (existing functionality)
    const currentRoles = getGuildRole(interaction.guild.id, bypassType) || [];
    
    if (!currentRoles.includes(role.id)) {
      return await interaction.reply({
        content: `${role} doesn't have ${formatBypassType(bypassType)} bypass.`,
        ephemeral: true
      });
    }

    const newRoles = currentRoles.filter(id => id !== role.id);
    setGuildRole(interaction.guild.id, bypassType, newRoles);

    await logBypassAction(interaction.guild, interaction.user, role, null, bypassType, 'removed');

    await interaction.reply({
      content: `❌ Removed ${bypassType.toLowerCase().replace(/_/g, ' ')} bypass from ${targetRole.name}${user ? ` (for user ${user.tag})` : ''}.`,
      ephemeral: true
    });

  } catch (error) {
    console.error('Remove bypass error:', error);
    await interaction.reply({
      content: 'Failed to remove bypass permission.',
      ephemeral: true
    });
  }
}

async function showBypassList(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('Bypass Permissions')
    .setColor(0x3498db)
    .setTimestamp();

  let roleDescription = '';
  let userDescription = '';
  const availableRoles = getAvailableRoles().filter(r => r.endsWith('_ROLES'));

  // Get role bypasses
  for (const roleType of availableRoles) {
    const roles = getGuildRole(interaction.guild.id, roleType) || [];
    if (roles.length > 0) {
      const roleMentions = roles.map(id => `<@&${id}>`).join(', ');
      roleDescription += `**${formatBypassType(roleType)}**:\n${roleMentions}\n\n`;
    }
  }

  // Get user bypasses
  const allPermissions = loadGuildPermissions();
  const guildPerms = allPermissions[interaction.guild.id] || {};
  const userBypasses = guildPerms.userBypasses || {};

  for (const [bypassType, userIds] of Object.entries(userBypasses)) {
    if (userIds && userIds.length > 0) {
      const userMentions = userIds.map(id => `<@${id}>`).join(', ');
      userDescription += `**${formatBypassType(bypassType)}**:\n${userMentions}\n\n`;
    }
  }

  let description = '';
  
  if (roleDescription) {
    description += '**Role Bypasses**\n' + roleDescription + '\n';
  }
  
  if (userDescription) {
    description += '**User Bypasses**\n' + userDescription;
  }

  if (description === '') {
    description = 'No bypass permissions have been set up yet.';
  } else if (description.length > 4096) {
    description = description.substring(0, 4093) + '...';
  }

  embed.setDescription(description);
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function logBypassAction(guild, moderator, role, user, bypassType, action) {
  try {
    const logChannelId = process.env.BYPASS_LOG_CHANNEL_ID;
    if (!logChannelId) return;

    const logChannel = await guild.channels.fetch(logChannelId);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor(action === 'added' ? 0x2ecc71 : 0xe74c3c)
      .setTitle(`Bypass ${action === 'added' ? 'Added' : 'Removed'}`)
      .addFields(
        { name: 'Moderator', value: `${moderator} (${moderator.id})`, inline: true },
        { name: 'Type', value: formatBypassType(bypassType), inline: true },
        { name: 'Target', value: user ? `👤 ${user} (${user.id})` : `🎭 ${role} (${role.id})`, inline: true },
        { name: 'Action', value: `\`${action.toUpperCase()}\``, inline: true }
      )
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error logging bypass action:', error);
  }
}

function formatBypassType(type) {
  return type
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}
