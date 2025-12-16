import { EmbedBuilder, Events, PermissionsBitField } from 'discord.js';
import { guildAllowed } from '../utils/config.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      
      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }
      
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error('Command execution error:', error);
        const reply = { content: 'There was an error while executing this command!', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      }
      return;
    }
    
    try {
      if (!interaction.isButton()) return;
      if (!guildAllowed(interaction.guild)) return;

      const customId = interaction.customId;
      
      // Handle different button types
      if (customId.startsWith('alt_')) {
        await handleModerationButton(interaction, 'Alt Detection');
      } else if (customId.startsWith('msg_')) {
        await handleModerationButton(interaction, 'Message Security');
      } else if (customId.startsWith('role_')) {
        await handleModerationButton(interaction, 'Role Monitor');
      } else if (customId.startsWith('channel_')) {
        await handleModerationButton(interaction, 'Channel Monitor');
      } else if (customId.startsWith('member_')) {
        await handleModerationButton(interaction, 'Member Monitor');
      } else if (customId.startsWith('server_')) {
        await handleModerationButton(interaction, 'Server Monitor');
      } else if (customId.startsWith('webhook_')) {
        await handleModerationButton(interaction, 'Integration Monitor');
      } else if (customId.startsWith('sec_')) {
        await handleModerationButton(interaction, 'Security System');
      }
    } catch (e) {
      console.error('Interaction handler error:', e.message);
    }
  }
};

async function handleModerationButton(interaction, systemName) {
  const [prefix, type, userId] = interaction.customId.split('_');

  const guild = interaction.guild;
  const member = interaction.member;
  
  // Check if user has permission to use moderation buttons
  if (!member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
    await interaction.reply({ 
      content: '❌ You need **Kick Members** permission to use these buttons.', 
      ephemeral: true 
    });
    return;
  }

  // Get the target member
  const targetMember = await guild.members.fetch(userId).catch(() => null);
  
  switch (type) {
    case 'ban':
      await handleBanAction(interaction, targetMember, userId, systemName);
      break;
    case 'verify':
      await handleVerifyAction(interaction, targetMember, systemName);
      break;
    case 'kick':
      await handleKickAction(interaction, targetMember, userId, systemName);
      break;
  }
}

async function handleBanAction(interaction, targetMember, userId, systemName) {
  try {
    const guild = interaction.guild;
    
    if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      await interaction.reply({ 
        content: '❌ I don\'t have permission to ban members.', 
        ephemeral: true 
      });
      return;
    }

    if (targetMember && !targetMember.bannable) {
      await interaction.reply({ 
        content: '❌ I cannot ban this user (higher role or owner).', 
        ephemeral: true 
      });
      return;
    }

    // Ban the user
    await guild.members.ban(userId, { 
      reason: `${systemName} violation - banned by ${interaction.user.tag}` 
    });

    // Update embed
    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(0xff0000) // Red for banned
      .setTitle(`${systemName} - BANNED`)
      .addFields({ 
        name: 'Action Taken', 
        value: `Banned by <@${interaction.user.id}>`, 
        inline: false 
      });

    await interaction.update({ 
      embeds: [updatedEmbed], 
      components: [] // Remove buttons
    });

  } catch (e) {
    await interaction.reply({ 
      content: `❌ Failed to ban user: ${e.message}`, 
      ephemeral: true 
    });
  }
}

async function handleVerifyAction(interaction, targetMember, systemName) {
  try {
    // Update embed to show verified
    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(0x00ff00) // Green for verified
      .setTitle(`${systemName} - VERIFIED`)
      .addFields({ 
        name: 'Status', 
        value: `Verified as legitimate by <@${interaction.user.id}>`, 
        inline: false 
      });

    await interaction.update({ 
      embeds: [updatedEmbed], 
      components: [] // Remove buttons
    });

  } catch (e) {
    await interaction.reply({ 
      content: `❌ Failed to verify user: ${e.message}`, 
      ephemeral: true 
    });
  }
}

async function handleKickAction(interaction, targetMember, userId, systemName) {
  try {
    const guild = interaction.guild;
    
    if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      await interaction.reply({ 
        content: '❌ I don\'t have permission to kick members.', 
        ephemeral: true 
      });
      return;
    }

    if (!targetMember) {
      await interaction.reply({ 
        content: '❌ User has already left the server.', 
        ephemeral: true 
      });
      return;
    }

    if (!targetMember.kickable) {
      await interaction.reply({ 
        content: '❌ I cannot kick this user (higher role or owner).', 
        ephemeral: true 
      });
      return;
    }

    // Kick the user
    await targetMember.kick(`${systemName} violation - kicked by ${interaction.user.tag}`);

    // Update embed
    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(0xffa500) // Orange for kicked
      .setTitle(`${systemName} - KICKED`)
      .addFields({ 
        name: 'Action Taken', 
        value: `Kicked by <@${interaction.user.id}>`, 
        inline: false 
      });

    await interaction.update({ 
      embeds: [updatedEmbed], 
      components: [] // Remove buttons
    });

  } catch (e) {
    await interaction.reply({ 
      content: `❌ Failed to kick user: ${e.message}`, 
      ephemeral: true 
    });
  }
}
