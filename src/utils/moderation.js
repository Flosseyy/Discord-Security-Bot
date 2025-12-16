import { PermissionsBitField } from 'discord.js';

export async function tryKickExecutor(guild, executor, reason) {
  try {
    if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.KickMembers)) return false;
    const member = await guild.members.fetch(executor.id).catch(() => null);
    if (!member) return false;
    if (!member.kickable) return false;
    await member.kick(reason);
    return true;
  } catch (e) {
    console.error('Kick executor error:', e.message);
    return false;
  }
}

export async function tryBanExecutor(guild, executor, reason) {
  try {
    if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.BanMembers)) return false;
    const member = await guild.members.fetch(executor.id).catch(() => null);
    if (!member) return false;
    if (!member.bannable) return false;
    await guild.members.ban(executor.id, { reason });
    return true;
  } catch (e) {
    console.error('Ban executor error:', e.message);
    return false;
  }
}
