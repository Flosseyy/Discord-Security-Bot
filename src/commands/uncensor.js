import { SlashCommandBuilder } from 'discord.js';
import { hasBypassRole } from '../utils/config.js';
import { getGuildRole } from '../utils/guildPermissions.js';
import { createSecurityEmbed, createModerationButtons } from '../utils/securityEmbed.js';

const CENSOR_CONFIG = {
  CENSORED_ROLE: process.env.CENSORED_ROLE || null,
  LOG_CHANNEL_ID: process.env.CENSOR_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID
};

export const data = new SlashCommandBuilder()
  .setName('uncensor')
  .setDescription('Uncensor a user (Moderator only)')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('The user to uncensor')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for uncensoring')
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

    if (!targetMember.roles.cache.has(CENSOR_CONFIG.CENSORED_ROLE)) {
      return await interaction.reply({
        content: `${targetUser.tag} is not censored.`,
        ephemeral: true
      });
    }

    // Get saved roles from censored list
    const previousRoles = await getPreviousRoles(interaction.guild.id, targetUser.id);
    
    // Remove censored role
    await targetMember.roles.remove(censoredRole, `Uncensored by ${interaction.user.tag}: ${reason}`);
    
    // Restore previous roles if they exist
    if (previousRoles && previousRoles.length > 0) {
      const validRoles = previousRoles.filter(roleId => interaction.guild.roles.cache.has(roleId));
      if (validRoles.length > 0) {
        await targetMember.roles.add(validRoles, `Restored roles after uncensor by ${interaction.user.tag}`);
      }
    }
    
    await removeFromCensoredList(interaction.guild.id, targetUser.id);

    await logCensorAction(interaction.guild, targetUser, interaction.user, reason, 'uncensored');

    await interaction.reply({
      content: `✅ Successfully uncensored **${targetUser.tag}**.\nReason: ${reason}`,
      ephemeral: true
    });

  } catch (error) {
    console.error('Uncensor command error:', error);
    await interaction.reply({
      content: 'An error occurred while uncensoring the user.',
      ephemeral: true
    });
  }
}

async function getPreviousRoles(guildId, userId) {
  const fs = await import('fs');
  const path = await import('path');
  
  const dataDir = path.join(process.cwd(), 'data');
  const filePath = path.join(dataDir, 'censored.json');
  
  if (!fs.existsSync(filePath)) return [];
  
  try {
    const censoredData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (censoredData[guildId] && censoredData[guildId][userId]) {
      return censoredData[guildId][userId].previousRoles || [];
    }
  } catch (e) {
    console.error('Error getting previous roles:', e);
  }
  
  return [];
}

async function removeFromCensoredList(guildId, userId) {
  const fs = await import('fs');
  const path = await import('path');
  
  const dataDir = path.join(process.cwd(), 'data');
  const filePath = path.join(dataDir, 'censored.json');
  
  if (!fs.existsSync(filePath)) return;
  
  try {
    const censoredData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (censoredData[guildId] && censoredData[guildId][userId]) {
      delete censoredData[guildId][userId];
      
      if (Object.keys(censoredData[guildId]).length === 0) {
        delete censoredData[guildId];
      }
      
      fs.writeFileSync(filePath, JSON.stringify(censoredData, null, 2));
    }
  } catch (e) {
    console.error('Error removing from censored list:', e);
  }
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
