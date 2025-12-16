import { Events, EmbedBuilder } from 'discord.js';
import { guildAllowed } from '../utils/config.js';
import { getGuildPermission } from '../utils/guildPermissions.js';
import { getWhitelist } from '../commands/whitelist.js';

const ANTI_BOT_CONFIG = {
  ENABLED: process.env.ANTI_BOT_ENABLED !== 'false',
  LOG_CHANNEL_ID: process.env.ANTI_BOT_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID,
  KICK_DELAY_SECONDS: Number(process.env.BOT_KICK_DELAY_SECONDS || 5)
};

export default {
  name: Events.GuildMemberAdd,
  async execute(member) {
    try {
      if (!ANTI_BOT_CONFIG.ENABLED) return;
      if (!guildAllowed(member.guild)) return;
      if (!getGuildPermission(member.guild.id, 'ANTI_BOT_ENABLED')) return;
      if (!member.user.bot) return;

      console.log(`Bot detected joining ${member.guild.name}: ${member.user.tag} (${member.user.id})`);

      const whitelist = await getWhitelist(member.guild.id);
      
      if (whitelist.includes(member.user.id)) {
        console.log(`Bot ${member.user.tag} is whitelisted, allowing entry`);
        await logBotAction(member.guild, member.user, 'allowed', 'Bot is whitelisted');
        return;
      }

      if (member.guild.members.me.id === member.user.id) {
        console.log('Ignoring self (this bot)');
        return;
      }

      console.log(`Unauthorized bot ${member.user.tag} detected, will kick in ${ANTI_BOT_CONFIG.KICK_DELAY_SECONDS} seconds`);

      await logBotAction(member.guild, member.user, 'detected', 'Unauthorized bot detected, preparing to kick');

      setTimeout(async () => {
        try {
          const stillInGuild = member.guild.members.cache.has(member.user.id);
          if (!stillInGuild) {
            console.log(`Bot ${member.user.tag} already left the server`);
            return;
          }

          await member.kick(`Unauthorized bot - not whitelisted`);
          console.log(`Successfully kicked unauthorized bot: ${member.user.tag}`);
          
          await logBotAction(member.guild, member.user, 'kicked', 'Bot was not whitelisted');

        } catch (kickError) {
          console.error(`Failed to kick bot ${member.user.tag}:`, kickError.message);
          await logBotAction(member.guild, member.user, 'kick_failed', `Failed to kick: ${kickError.message}`);
        }
      }, ANTI_BOT_CONFIG.KICK_DELAY_SECONDS * 1000);

    } catch (error) {
      console.error('Anti-bot protection error:', error);
    }
  }
};

async function logBotAction(guild, bot, action, reason) {
  try {
    if (!ANTI_BOT_CONFIG.LOG_CHANNEL_ID) return;

    const channel = await guild.channels.fetch(ANTI_BOT_CONFIG.LOG_CHANNEL_ID).catch(() => null);
    if (!channel) return;

    const colors = {
      allowed: 0x00ff00,
      detected: 0xffaa00,
      kicked: 0xff0000,
      kick_failed: 0x800080
    };

    const titles = {
      allowed: '✅ Bot Allowed',
      detected: '⚠️ Unauthorized Bot Detected',
      kicked: '🚫 Bot Kicked',
      kick_failed: '❌ Bot Kick Failed'
    };

    const embed = new EmbedBuilder()
      .setTitle(titles[action] || '🤖 Bot Action')
      .setColor(colors[action] || 0x5865f2)
      .addFields(
        { name: 'Bot', value: `<@${bot.id}>\n\`${bot.tag}\``, inline: true },
        { name: 'Bot ID', value: `\`${bot.id}\``, inline: true },
        { name: 'Account Created', value: `<t:${Math.floor(bot.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Reason', value: reason, inline: false }
      )
      .setThumbnail(bot.displayAvatarURL({ dynamic: true, size: 256 }))
      .setTimestamp();

    if (action === 'detected') {
      embed.addFields({ 
        name: 'Action', 
        value: `Bot will be kicked in ${ANTI_BOT_CONFIG.KICK_DELAY_SECONDS} seconds if not whitelisted`, 
        inline: false 
      });
    }

    await channel.send({ embeds: [embed] });

  } catch (error) {
    console.error('Bot action log error:', error);
  }
}
