import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';
import { isOwner } from '../utils/config.js';

const PERMISSION_CHOICES = [
  { name: 'Administrator', value: 'Administrator' },
  { name: 'Manage Server', value: 'ManageGuild' },
  { name: 'Manage Roles', value: 'ManageRoles' },
  { name: 'Manage Channels', value: 'ManageChannels' },
  { name: 'Kick Members', value: 'KickMembers' },
  { name: 'Ban Members', value: 'BanMembers' },
  { name: 'Manage Messages', value: 'ManageMessages' },
  { name: 'Manage Nicknames', value: 'ManageNicknames' },
  { name: 'Manage Webhooks', value: 'ManageWebhooks' },
  { name: 'View Audit Log', value: 'ViewAuditLog' },
  { name: 'Mention Everyone', value: 'MentionEveryone' },
  { name: 'Send Messages', value: 'SendMessages' },
  { name: 'Embed Links', value: 'EmbedLinks' },
  { name: 'Attach Files', value: 'AttachFiles' },
  { name: 'Read Message History', value: 'ReadMessageHistory' },
  { name: 'Connect (Voice)', value: 'Connect' },
  { name: 'Speak (Voice)', value: 'Speak' },
  { name: 'Mute Members', value: 'MuteMembers' },
  { name: 'Deafen Members', value: 'DeafenMembers' },
  { name: 'Move Members', value: 'MoveMembers' }
];

export const data = new SlashCommandBuilder()
  .setName('perms')
  .setDescription('Toggle permissions on a role (Owner only)')
  .addRoleOption(option =>
    option.setName('role')
      .setDescription('The role to modify')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('permission')
      .setDescription('The permission to toggle')
      .setRequired(true)
      .addChoices(...PERMISSION_CHOICES))
  .addStringOption(option =>
    option.setName('action')
      .setDescription('Add or remove the permission')
      .setRequired(true)
      .addChoices(
        { name: 'Add', value: 'add' },
        { name: 'Remove', value: 'remove' }
      ));

export async function execute(interaction) {
  try {
    if (!isOwner(interaction.guild, interaction.user.id)) {
      return await interaction.reply({
        content: 'Only the server owner can use this command.',
        ephemeral: true
      });
    }

    const role = interaction.options.getRole('role');
    const permission = interaction.options.getString('permission');
    const action = interaction.options.getString('action');

    if (!role.editable) {
      return await interaction.reply({
        content: 'I cannot edit this role. It may be higher than my role or be a managed role.',
        ephemeral: true
      });
    }

    if (role.id === interaction.guild.id) {
      return await interaction.reply({
        content: 'Cannot modify the @everyone role.',
        ephemeral: true
      });
    }

    const permissionFlag = PermissionsBitField.Flags[permission];
    const currentPermissions = role.permissions;
    const hasPermission = currentPermissions.has(permissionFlag);

    if (action === 'add' && hasPermission) {
      return await interaction.reply({
        content: `Role ${role.name} already has the ${permission} permission.`,
        ephemeral: true
      });
    }

    if (action === 'remove' && !hasPermission) {
      return await interaction.reply({
        content: `Role ${role.name} doesn't have the ${permission} permission.`,
        ephemeral: true
      });
    }

    let newPermissions;
    if (action === 'add') {
      newPermissions = currentPermissions.add(permissionFlag);
    } else {
      newPermissions = currentPermissions.remove(permissionFlag);
    }

    await role.setPermissions(newPermissions, `Permission ${action} by ${interaction.user.tag}`);

    const actionText = action === 'add' ? 'added to' : 'removed from';
    await interaction.reply({
      content: `✅ Successfully ${actionText} **${permission}** permission ${action === 'add' ? 'to' : 'from'} role **${role.name}**.`,
      ephemeral: true
    });

  } catch (error) {
    console.error('Perms command error:', error);
    await interaction.reply({
      content: 'An error occurred while modifying the role permissions.',
      ephemeral: true
    });
  }
}
