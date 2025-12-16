export const config = {
  TOKEN: 'MTQzNjgxMDI5NDY5MjQxMzQ5MA.G-SCJH.gznqnnIPEOIwLZgPiFM3K7nQ9x2RsjYwf4Y8Pw',
  OWNER_IDS: ['YOUR_USER_ID_HERE', 'SECOND_USER_ID_HERE'], // Add your Discord user IDs here
  APPROVED_GUILDS: (process.env.APPROVED_GUILDS || '').split(',').filter(g => g.trim()),
  THRESHOLD: Number(process.env.THRESHOLD || 3),
  WINDOW_SECONDS: Number(process.env.WINDOW_SECONDS || 10),
  UNIVERSAL_BYPASS_ROLE: process.env.UNIVERSAL_BYPASS_ROLE || null
};

export function validateConfig() {
  if (!config.TOKEN) {
    console.error('Missing DISCORD_TOKEN in config');
    process.exit(1);
  }
}

export function guildAllowed(guild) {
  if (config.APPROVED_GUILDS.length === 0) return true;
  return config.APPROVED_GUILDS.includes(guild.id);
}

export function isOwner(guild, userId) {
  if (config.OWNER_IDS.length > 0 && config.OWNER_IDS.includes(userId)) {
    return true;
  }
  return userId === guild.ownerId;
}

export function hasBypassRole(member, bypassRoles = []) {
  if (!member || !member.roles) return false;
  
  if (config.UNIVERSAL_BYPASS_ROLE && member.roles.cache.has(config.UNIVERSAL_BYPASS_ROLE)) {
    return true;
  }
  
  return bypassRoles.some(roleId => roleId && member.roles.cache.has(roleId));
}
