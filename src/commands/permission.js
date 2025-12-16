import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { guildAllowed, isOwner } from '../utils/config.js';
import { getGuildPermission, setGuildPermission, getAvailablePermissions, getGuildPermissions } from '../utils/guildPermissions.js';

const PERMISSION_DESCRIPTIONS = {
  MESSAGE_SECURITY_ENABLED: 'Message security system (spam, links, mentions, blacklist)',
  ALT_DETECTION_ENABLED: 'Alt account detection system',
  MASS_KICK_ENABLED: 'Mass kick protection',
  MASS_BAN_ENABLED: 'Mass ban protection', 
  VANITY_PROTECTION_ENABLED: 'Vanity URL protection',
  ROLE_MONITOR_ENABLED: 'Role permission monitoring',
  CHANNEL_MONITOR_ENABLED: 'Channel creation/deletion monitoring',
  MEMBER_UPDATE_ENABLED: 'Avatar and nickname monitoring',
  SERVER_SETTINGS_ENABLED: 'Server settings monitoring',
  INTEGRATION_MONITOR_ENABLED: 'Webhook and integration monitoring',
  BLOCK_LINKS: 'Block unauthorized links',
  ENABLE_BLACKLIST: 'Enable blacklist filtering',
  AUTO_DELETE_VIOLATIONS: 'Auto-delete violating messages',
  AUTO_DELETE_CHANNELS: 'Auto-delete suspicious channels',
  AUTO_DELETE_ROLES: 'Auto-delete suspicious roles',
  AUTO_DELETE_WEBHOOKS: 'Auto-delete suspicious webhooks'
};

export const data = new SlashCommandBuilder()
  .setName('permission')
  .setDescription('Manage bot permissions for this server (Owner only)')
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Enable a permission')
      .addStringOption(option =>
        option.setName('feature')
          .setDescription('The feature to enable')
          .setRequired(true)
          .addChoices(...getAvailablePermissions().map(p => ({ name: p.toLowerCase().replace(/_/g, ' '), value: p })))))
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Disable a permission')
      .addStringOption(option =>
        option.setName('feature')
          .setDescription('The feature to disable')
          .setRequired(true)
          .addChoices(...getAvailablePermissions().map(p => ({ name: p.toLowerCase().replace(/_/g, ' '), value: p })))))
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List all permissions and their status'));

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
        content: 'Only the server owner can manage bot permissions.',
        ephemeral: true
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'list') {
      const permissions = getGuildPermissions(interaction.guild.id);
      
      const embed = new EmbedBuilder()
        .setTitle(`Bot Permissions - ${interaction.guild.name}`)
        .setColor(0x5865f2)
        .setTimestamp();

      let enabledFeatures = [];
      let disabledFeatures = [];

      for (const [permission, enabled] of Object.entries(permissions)) {
        const description = PERMISSION_DESCRIPTIONS[permission] || permission;
        const formattedName = permission.toLowerCase().replace(/_/g, ' ');
        
        if (enabled) {
          enabledFeatures.push(`${formattedName}`);
        } else {
          disabledFeatures.push(`${formattedName}`);
        }
      }

      if (enabledFeatures.length > 0) {
        embed.addFields({ name: 'Enabled Features', value: enabledFeatures.join('\n'), inline: false });
      }
      
      if (disabledFeatures.length > 0) {
        embed.addFields({ name: 'Disabled Features', value: disabledFeatures.join('\n'), inline: false });
      }

      embed.setFooter({ text: 'Use /permission add/remove to modify settings' });

      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const feature = interaction.options.getString('feature');
    const action = subcommand;
    const newValue = action === 'add';

    const currentValue = getGuildPermission(interaction.guild.id, feature);
    
    if (currentValue === newValue) {
      const status = newValue ? 'already enabled' : 'already disabled';
      return await interaction.reply({
        content: `Feature **${feature.toLowerCase().replace(/_/g, ' ')}** is ${status}.`,
        ephemeral: true
      });
    }

    setGuildPermission(interaction.guild.id, feature, newValue);

    const actionText = newValue ? 'enabled' : 'disabled';
    
    await interaction.reply({
      content: `Successfully **${actionText}** feature: **${feature.toLowerCase().replace(/_/g, ' ')}**`,
      ephemeral: true
    });

  } catch (error) {
    console.error('Permission command error:', error);
    await interaction.reply({
      content: 'An error occurred while managing permissions.',
      ephemeral: true
    });
  }
}
