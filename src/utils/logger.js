import { ChannelType, EmbedBuilder } from 'discord.js';

export async function logToChannel(guild, channelId, description) {
  try {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildText) return;
    
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setDescription(description)
      .setTimestamp(new Date());
    
    await channel.send({ embeds: [embed] });
  } catch (e) {
    console.error('Log error:', e.message);
  }
}
