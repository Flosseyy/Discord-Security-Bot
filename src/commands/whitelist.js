import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } from 'discord.js';
import { guildAllowed } from '../utils/config.js';

export const data = new SlashCommandBuilder()
  .setName('whitelist')
  .setDescription('Manage bot whitelist (Admin only)')
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Add a bot to the whitelist')
      .addStringOption(option =>
        option.setName('bot_id')
          .setDescription('Bot ID to whitelist')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Remove a bot from the whitelist')
      .addStringOption(option =>
        option.setName('bot_id')
          .setDescription('Bot ID to remove from whitelist')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List all whitelisted bots'));

export async function execute(interaction) {
  try {
    if (!guildAllowed(interaction.guild)) {
      return await interaction.reply({
        content: 'This bot is not authorized for this server.',
        ephemeral: true
      });
    }

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return await interaction.reply({
        content: 'You need Administrator permissions to manage the bot whitelist.',
        ephemeral: true
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'list') {
      return await showWhitelist(interaction);
    }

    const botId = interaction.options.getString('bot_id');

    if (!/^\d{17,19}$/.test(botId)) {
      return await interaction.reply({
        content: 'Invalid bot ID format. Please provide a valid Discord ID.',
        ephemeral: true
      });
    }

    if (subcommand === 'add') {
      await addToWhitelist(interaction, botId);
    } else {
      await removeFromWhitelist(interaction, botId);
    }

  } catch (error) {
    console.error('Whitelist command error:', error);
    await interaction.reply({
      content: 'An error occurred while managing the bot whitelist.',
      ephemeral: true
    });
  }
}

async function addToWhitelist(interaction, botId) {
  try {
    const whitelist = await getWhitelist(interaction.guild.id);
    
    if (whitelist.includes(botId)) {
      return await interaction.reply({
        content: 'This bot is already whitelisted.',
        ephemeral: true
      });
    }

    whitelist.push(botId);
    await saveWhitelist(interaction.guild.id, whitelist);

    let botInfo = 'Unknown Bot';
    try {
      const bot = await interaction.client.users.fetch(botId);
      botInfo = `${bot.tag} (${bot.id})`;
    } catch (e) {
      botInfo = `Bot ID: ${botId}`;
    }

    await logWhitelistAction(interaction.guild, interaction.user, botId, botInfo, 'added');

    await interaction.reply({
      content: `✅ Added **${botInfo}** to the bot whitelist.`,
      ephemeral: true
    });

  } catch (error) {
    console.error('Add whitelist error:', error);
    await interaction.reply({
      content: 'Failed to add bot to whitelist.',
      ephemeral: true
    });
  }
}

async function removeFromWhitelist(interaction, botId) {
  try {
    const whitelist = await getWhitelist(interaction.guild.id);
    
    if (!whitelist.includes(botId)) {
      return await interaction.reply({
        content: 'This bot is not in the whitelist.',
        ephemeral: true
      });
    }

    const newWhitelist = whitelist.filter(id => id !== botId);
    await saveWhitelist(interaction.guild.id, newWhitelist);

    let botInfo = 'Unknown Bot';
    try {
      const bot = await interaction.client.users.fetch(botId);
      botInfo = `${bot.tag} (${bot.id})`;
    } catch (e) {
      botInfo = `Bot ID: ${botId}`;
    }

    await logWhitelistAction(interaction.guild, interaction.user, botId, botInfo, 'removed');

    await interaction.reply({
      content: `❌ Removed **${botInfo}** from the bot whitelist.`,
      ephemeral: true
    });

  } catch (error) {
    console.error('Remove whitelist error:', error);
    await interaction.reply({
      content: 'Failed to remove bot from whitelist.',
      ephemeral: true
    });
  }
}

async function showWhitelist(interaction) {
  try {
    const whitelist = await getWhitelist(interaction.guild.id);
    
    const embed = new EmbedBuilder()
      .setTitle(`🤖 Bot Whitelist - ${interaction.guild.name}`)
      .setColor(0x5865f2)
      .setTimestamp();

    if (whitelist.length === 0) {
      embed.setDescription('No bots are currently whitelisted.');
    } else {
      const botList = [];
      
      for (const botId of whitelist) {
        try {
          const bot = await interaction.client.users.fetch(botId);
          botList.push(`<@${botId}> - \`${bot.tag}\``);
        } catch (e) {
          botList.push(`\`${botId}\` - *Unknown Bot*`);
        }
      }
      
      embed.setDescription(botList.join('\n'));
    }

    embed.setFooter({ text: `${whitelist.length} whitelisted bot(s)` });

    await interaction.reply({ embeds: [embed], ephemeral: true });

  } catch (error) {
    console.error('Show whitelist error:', error);
    await interaction.reply({
      content: 'Failed to display whitelist.',
      ephemeral: true
    });
  }
}

async function getWhitelist(guildId) {
  const fs = await import('fs');
  const path = await import('path');
  
  const dataDir = path.join(process.cwd(), 'data');
  const filePath = path.join(dataDir, 'bot-whitelist.json');
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  if (!fs.existsSync(filePath)) {
    return [];
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return data[guildId] || [];
  } catch (e) {
    return [];
  }
}

async function saveWhitelist(guildId, whitelist) {
  const fs = await import('fs');
  const path = await import('path');
  
  const dataDir = path.join(process.cwd(), 'data');
  const filePath = path.join(dataDir, 'bot-whitelist.json');
  
  let data = {};
  if (fs.existsSync(filePath)) {
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      data = {};
    }
  }
  
  data[guildId] = whitelist;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function logWhitelistAction(guild, moderator, botId, botInfo, action) {
  try {
    const logChannelId = process.env.BOT_WHITELIST_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID;
    if (!logChannelId) return;

    const channel = await guild.channels.fetch(logChannelId).catch(() => null);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle(`🤖 Bot ${action === 'added' ? 'Whitelisted' : 'Removed from Whitelist'}`)
      .setColor(action === 'added' ? 0x00ff00 : 0xff0000)
      .addFields(
        { name: 'Moderator', value: `<@${moderator.id}>\n\`${moderator.tag}\``, inline: true },
        { name: 'Bot', value: `<@${botId}>\n\`${botInfo}\``, inline: true },
        { name: 'Action', value: action === 'added' ? 'Added to whitelist' : 'Removed from whitelist', inline: true }
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Whitelist log error:', error);
  }
}

export { getWhitelist };
