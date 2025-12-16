import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

export function createSecurityEmbed(title, color, fields, user = null, thumbnail = null) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setTimestamp()
    .setFooter({ text: 'Security' });

  if (fields && fields.length > 0) {
    embed.addFields(fields);
  }

  if (user) {
    embed.addFields({ 
      name: 'User', 
      value: `<@${user.id}>\n\`${user.tag}\``, 
      inline: true 
    });
  }

  if (thumbnail) {
    embed.setThumbnail(thumbnail);
  }

  return embed;
}

export function createModerationButtons(userId, prefix = 'sec') {
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`${prefix}_ban_${userId}`)
        .setLabel('Ban')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`${prefix}_verify_${userId}`)
        .setLabel('Verify')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`${prefix}_kick_${userId}`)
        .setLabel('Kick')
        .setStyle(ButtonStyle.Secondary)
    );

  return row;
}

export function createActionOnlyButtons(userId, prefix = 'sec') {
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`${prefix}_ban_${userId}`)
        .setLabel('Ban')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`${prefix}_kick_${userId}`)
        .setLabel('Kick')
        .setStyle(ButtonStyle.Secondary)
    );

  return row;
}
