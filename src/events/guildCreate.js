import { Events } from 'discord.js';
import { guildAllowed } from '../utils/config.js';

export default {
  name: Events.GuildCreate,
  async execute(guild) {
    try {
      if (!guildAllowed(guild)) {
        console.log(`🚫 Bot added to non-approved guild: ${guild.name} (${guild.id}). Leaving...`);
        
        try {
          const owner = await guild.fetchOwner();
          await owner.send(`Hello! I was added to your server **${guild.name}**, but I'm currently only available for approved servers. If you'd like to use this bot, please contact the bot owner for approval.`);
        } catch (e) {
          console.log('Could not DM guild owner about non-approved server');
        }
        
        await guild.leave();
        console.log(`✅ Left non-approved guild: ${guild.name} (${guild.id})`);
      } else {
        console.log(`✅ Bot added to approved guild: ${guild.name} (${guild.id})`);
      }
    } catch (error) {
      console.error('Guild create error:', error);
    }
  }
};
