import { SlashCommandBuilder } from 'discord.js';
import { hasBypassRole } from '../utils/config.js';
import { getGuildRole } from '../utils/guildPermissions.js';
import { createSecurityEmbed, createModerationButtons } from '../utils/securityEmbed.js';

const CENSOR_CONFIG = {
  CENSORED_ROLE: process.env.CENSORED_ROLE || null,
  LOG_CHANNEL_ID: process.env.CENSOR_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID
};

export const data = new SlashCommandBuilder()
  .setName('censor')
  .setDescription('Censor a user (Moderator only)')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('The user to censor')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for censoring')
      .setRequired(false));

export async function execute(interaction) {
  try {
    if (!CENSOR_CONFIG.CENSORED_ROLE) {
      return await interaction.reply({
        content: 'Censor system not configured. Missing CENSORED_ROLE in environment.',
        ephemeral: true
      });
    }

    const moderatorRoles = getGuildRole(interaction.guild.id, 'CENSOR_MODERATOR_ROLES');
    if (!hasBypassRole(interaction.member, moderatorRoles)) {
      return await interaction.reply({
        content: 'You do not have permission to use this command.',
        ephemeral: true
      });
    }

    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      return await interaction.reply({
        content: 'User not found in this server.',
        ephemeral: true
      });
    }

    const censoredRole = await interaction.guild.roles.fetch(CENSOR_CONFIG.CENSORED_ROLE).catch(() => null);
    if (!censoredRole) {
      return await interaction.reply({
        content: 'Censored role not found. Please check the CENSORED_ROLE configuration.',
        ephemeral: true
      });
    }

    if (targetMember.roles.cache.has(CENSOR_CONFIG.CENSORED_ROLE)) {
      return await interaction.reply({
        content: `${targetUser.tag} is already censored.`,
        ephemeral: true
      });
    }

    // Save current roles (excluding @everyone)
    const currentRoles = targetMember.roles.cache
      .filter(role => role.id !== interaction.guild.id)
      .map(role => role.id);
    
    // Remove all roles except @everyone
    await targetMember.roles.set([], `Censored by ${interaction.user.tag}: ${reason}`);
    
    // Add the censored role
    await targetMember.roles.add(censoredRole, `Censored by ${interaction.user.tag}: ${reason}`);
    
    await addToCensoredList(interaction.guild.id, targetUser.id, reason, interaction.user.id, currentRoles);

    await logCensorAction(interaction.guild, targetUser, interaction.user, reason, 'censored');

    await interaction.reply({
      content: `✅ Successfully censored **${targetUser.tag}**.\nReason: ${reason}`,
      ephemeral: true
    });

  } catch (error) {
    console.error('Censor command error:', error);
    await interaction.reply({
      content: 'An error occurred while censoring the user.',
      ephemeral: true
    });
  }
}

async function addToCensoredList(guildId, userId, reason, moderatorId, previousRoles = []) {
  const fs = await import('fs');
  const path = await import('path');
  
  const dataDir = path.join(process.cwd(), 'data');
  const filePath = path.join(dataDir, 'censored.json');
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  let censoredData = {};
  if (fs.existsSync(filePath)) {
    try {
      censoredData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      censoredData = {};
    }
  }
  
  if (!censoredData[guildId]) censoredData[guildId] = {};
  
  censoredData[guildId][userId] = {
    reason,
    moderatorId,
    timestamp: Date.now(),
    previousRoles // Save roles so they can be restored when uncensored
  };
  
  fs.writeFileSync(filePath, JSON.stringify(censoredData, null, 2));
}

async function logCensorAction(guild, targetUser, moderator, reason, action) {
  try {
    if (!CENSOR_CONFIG.LOG_CHANNEL_ID) return;
    
    const channel = await guild.channels.fetch(CENSOR_CONFIG.LOG_CHANNEL_ID).catch(() => null);
    if (!channel) return;
    
    const fields = [
      { name: 'Target User', value: `<@${targetUser.id}>\n\`${targetUser.tag}\``, inline: true },
      { name: 'Moderator', value: `<@${moderator.id}>\n\`${moderator.tag}\``, inline: true },
      { name: 'Action', value: action === 'censored' ? 'Censored' : 'Uncensored', inline: true },
      { name: 'Reason', value: reason, inline: false }
    ];
    
    const color = action === 'censored' ? 0xff4757 : 0x2ed573;
    const title = action === 'censored' ? 'User Censored' : 'User Uncensored';
    
    const embed = createSecurityEmbed(title, color, fields);
    const buttons = createModerationButtons(targetUser.id, 'censor');
    
    await channel.send({ embeds: [embed], components: [buttons] });
  } catch (e) {
    console.error('Censor log error:', e.message);
  }
}
