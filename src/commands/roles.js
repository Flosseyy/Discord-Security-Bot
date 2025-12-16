import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { guildAllowed, isOwner } from '../utils/config.js';
import { getGuildRole, addRoleToGuildRole, removeRoleFromGuildRole, getAvailableRoles, setGuildRole } from '../utils/guildPermissions.js';

const ROLE_DESCRIPTIONS = {
  CENSOR_MODERATOR_ROLES: 'Roles that can use /censor and /uncensor commands',
  MESSAGE_SECURITY_BYPASS_ROLES: 'Roles that bypass message security checks',
  ALT_DETECTION_BYPASS_ROLES: 'Roles that bypass alt detection',
  MASS_KICK_BYPASS_ROLES: 'Roles that bypass mass kick protection',
  MASS_BAN_BYPASS_ROLES: 'Roles that bypass mass ban protection',
  VANITY_PROTECTION_BYPASS_ROLES: 'Roles that bypass vanity URL protection',
  ROLE_MONITOR_BYPASS_ROLES: 'Roles that bypass role permission monitoring',
  CHANNEL_MONITOR_BYPASS_ROLES: 'Roles that bypass channel monitoring',
  MEMBER_UPDATE_BYPASS_ROLES: 'Roles that bypass avatar/nickname monitoring',
  SERVER_SETTINGS_BYPASS_ROLES: 'Roles that bypass server settings monitoring',
  INTEGRATION_MONITOR_BYPASS_ROLES: 'Roles that bypass webhook/integration monitoring',
  UNIVERSAL_BYPASS_ROLE: 'Role that bypasses ALL security features'
};

export const data = new SlashCommandBuilder()
  .setName('roles')
  .setDescription('Manage bot roles for this server (Owner only)')
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Add a role to a permission group')
      .addStringOption(option =>
        option.setName('type')
          .setDescription('The role type to modify')
          .setRequired(true)
          .addChoices(...getAvailableRoles().map(r => ({ 
            name: r.toLowerCase().replace(/_/g, ' '), 
            value: r 
          }))))
      .addRoleOption(option =>
        option.setName('role')
          .setDescription('The role to add')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Remove a role from a permission group')
      .addStringOption(option =>
        option.setName('type')
          .setDescription('The role type to modify')
          .setRequired(true)
          .addChoices(...getAvailableRoles().map(r => ({ 
            name: r.toLowerCase().replace(/_/g, ' '), 
            value: r 
          }))))
      .addRoleOption(option =>
        option.setName('role')
          .setDescription('The role to remove')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List all role configurations'));

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
        content: 'Only the server owner can manage bot roles.',
        ephemeral: true
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'list') {
      const embed = new EmbedBuilder()
        .setTitle(`🎭 Bot Role Configuration - ${interaction.guild.name}`)
        .setColor(0x5865f2)
        .setTimestamp();

      for (const roleType of getAvailableRoles()) {
        const roles = getGuildRole(interaction.guild.id, roleType);
        const description = ROLE_DESCRIPTIONS[roleType] || roleType;
        
        let roleList = 'None configured';
        if (roleType === 'UNIVERSAL_BYPASS_ROLE' && roles) {
          const role = interaction.guild.roles.cache.get(roles);
          roleList = role ? `<@&${roles}>` : 'Role not found';
        } else if (Array.isArray(roles) && roles.length > 0) {
          roleList = roles.map(roleId => {
            const role = interaction.guild.roles.cache.get(roleId);
            return role ? `<@&${roleId}>` : 'Role not found';
          }).join(', ');
        }

        embed.addFields({
          name: roleType.toLowerCase().replace(/_/g, ' '),
          value: `${description}\n**Roles:** ${roleList}`,
          inline: false
        });
      }

      embed.setFooter({ text: 'Use /roles add/remove to modify role assignments' });

      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const roleType = interaction.options.getString('type');
    const role = interaction.options.getRole('role');
    const action = subcommand;

    if (roleType === 'UNIVERSAL_BYPASS_ROLE') {
      if (action === 'add') {
        setGuildRole(interaction.guild.id, roleType, role.id);
        return await interaction.reply({
          content: `✅ Set **${role.name}** as the universal bypass role.`,
          ephemeral: true
        });
      } else {
        setGuildRole(interaction.guild.id, roleType, null);
        return await interaction.reply({
          content: `❌ Removed universal bypass role.`,
          ephemeral: true
        });
      }
    }

    const currentRoles = getGuildRole(interaction.guild.id, roleType) || [];
    
    if (action === 'add') {
      if (currentRoles.includes(role.id)) {
        return await interaction.reply({
          content: `Role **${role.name}** is already in **${roleType.toLowerCase().replace(/_/g, ' ')}**.`,
          ephemeral: true
        });
      }
      
      addRoleToGuildRole(interaction.guild.id, roleType, role.id);
      
      return await interaction.reply({
        content: `✅ Added **${role.name}** to **${roleType.toLowerCase().replace(/_/g, ' ')}**.`,
        ephemeral: true
      });
    } else {
      if (!currentRoles.includes(role.id)) {
        return await interaction.reply({
          content: `Role **${role.name}** is not in **${roleType.toLowerCase().replace(/_/g, ' ')}**.`,
          ephemeral: true
        });
      }
      
      removeRoleFromGuildRole(interaction.guild.id, roleType, role.id);
      
      return await interaction.reply({
        content: `❌ Removed **${role.name}** from **${roleType.toLowerCase().replace(/_/g, ' ')}**.`,
        ephemeral: true
      });
    }

  } catch (error) {
    console.error('Roles command error:', error);
    await interaction.reply({
      content: 'An error occurred while managing roles.',
      ephemeral: true
    });
  }
}
