import { Events } from 'discord.js';
import { guildAllowed, isOwner } from '../utils/config.js';
import { createSecurityEmbed, createModerationButtons } from '../utils/securityEmbed.js';
import { containsBlacklistedContent, getContentSeverity } from '../utils/blacklist.js';

// Configuration for member monitoring
const MEMBER_MONITOR_CONFIG = {
  LOG_CHANNEL_ID: process.env.MEMBER_MONITOR_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID,
  ENABLED: process.env.MEMBER_MONITOR_ENABLED !== 'false',
  CHECK_NSFW_NICKNAMES: process.env.CHECK_NSFW_NICKNAMES !== 'false',
  CHECK_NSFW_AVATARS: process.env.CHECK_NSFW_AVATARS !== 'false',
  AUTO_RESET_NICKNAME: process.env.AUTO_RESET_NICKNAME !== 'false'
};

// NSFW/inappropriate nickname patterns
const NSFW_NICKNAME_PATTERNS = [
  /n[i1]gg[ae3]r/gi,
  /f[a4@]gg[o0]t/gi,
  /r[e3]t[a4@]rd/gi,
  /b[i1]tch/gi,
  /wh[o0]r[e3]/gi,
  /sl[u]t/gi,
  /c[u]nt/gi,
  /d[i1]ck/gi,
  /p[e3]n[i1]s/gi,
  /v[a4@]g[i1]n[a4@]/gi,
  /p[u]ssy/gi,
  /t[i1]ts/gi,
  /b[o0][o0]bs/gi,
  /[a4@]ss/gi,
  /sh[i1]t/gi,
  /f[u]ck/gi,
  /d[a4@]mn/gi,
  /h[e3]ll/gi,
  /cr[a4@]p/gi,
  /p[o0]rn/gi,
  /s[e3]x/gi,
  /n[a4@]k[e3]d/gi,
  /n[u]d[e3]/gi,
  /xxx/gi,
  /69/g,
  /420/g
];

// Suspicious avatar patterns (basic checks)
const SUSPICIOUS_AVATAR_INDICATORS = [
  'nsfw',
  'porn',
  'nude',
  'naked',
  'sex'
];

function checkNSFWNickname(nickname) {
  if (!nickname) return { isNSFW: false };
  
  // First check against comprehensive blacklist
  const blacklistCheck = containsBlacklistedContent(nickname);
  if (blacklistCheck.isBlacklisted) {
    const severity = getContentSeverity(nickname);
    return {
      isNSFW: true,
      reason: `Prohibited nickname detected: "${nickname}" (${severity} severity)`,
      severity: severity
    };
  }
  
  // Then check against additional NSFW patterns
  const cleanNickname = nickname.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  for (const pattern of NSFW_NICKNAME_PATTERNS) {
    if (pattern.test(nickname) || pattern.test(cleanNickname)) {
      return { 
        isNSFW: true, 
        reason: `Inappropriate nickname detected: "${nickname}"`,
        pattern: pattern.source
      };
    }
  }
  
  return { isNSFW: false };
}

function checkSuspiciousAvatar(avatarURL) {
  if (!avatarURL) return { isSuspicious: false };
  
  const lowerURL = avatarURL.toLowerCase();
  
  for (const indicator of SUSPICIOUS_AVATAR_INDICATORS) {
    if (lowerURL.includes(indicator)) {
      return {
        isSuspicious: true,
        reason: `Suspicious avatar URL contains: "${indicator}"`
      };
    }
  }
  
  return { isSuspicious: false };
}

async function logMemberViolation(guild, member, violationType, details, oldValue = null, newValue = null) {
  try {
    const channel = await guild.channels.fetch(MEMBER_MONITOR_CONFIG.LOG_CHANNEL_ID).catch(() => null);
    if (!channel) return;
    
    const fields = [
      { name: 'Violation Type', value: violationType, inline: true },
      { name: 'Details', value: details, inline: false }
    ];
    
    if (oldValue && newValue) {
      fields.push({ 
        name: 'Change', 
        value: `**Before:** ${oldValue}\n**After:** ${newValue}`, 
        inline: false 
      });
    }
    
    const embed = createSecurityEmbed(
      'Member Content Violation',
      0xff4757,
      fields,
      member.user,
      member.user.displayAvatarURL({ dynamic: true })
    );
    
    const buttons = createModerationButtons(member.user.id, 'member');
    
    await channel.send({ embeds: [embed], components: [buttons] });
  } catch (e) {
    console.error('Member monitor log error:', e.message);
  }
}

export default {
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember) {
    try {
      if (!MEMBER_MONITOR_CONFIG.ENABLED) return;
      if (!MEMBER_MONITOR_CONFIG.LOG_CHANNEL_ID) return;
      if (!guildAllowed(newMember.guild)) return;
      if (isOwner(newMember.guild, newMember.user.id)) return;
      
      // Check nickname changes for NSFW content
      if (MEMBER_MONITOR_CONFIG.CHECK_NSFW_NICKNAMES) {
        const oldNickname = oldMember.nickname;
        const newNickname = newMember.nickname;
        
        if (oldNickname !== newNickname && newNickname) {
          const nicknameCheck = checkNSFWNickname(newNickname);
          
          if (nicknameCheck.isNSFW) {
            // Auto-reset nickname if enabled
            if (MEMBER_MONITOR_CONFIG.AUTO_RESET_NICKNAME) {
              try {
                await newMember.setNickname(oldNickname || null, 'Inappropriate nickname detected');
              } catch (e) {
                console.error('Failed to reset nickname:', e.message);
              }
            }
            
            await logMemberViolation(
              newMember.guild,
              newMember,
              'Inappropriate Nickname',
              nicknameCheck.reason,
              oldNickname || 'None',
              newNickname
            );
          }
        }
      }
      
      // Check avatar changes for suspicious content
      if (MEMBER_MONITOR_CONFIG.CHECK_NSFW_AVATARS) {
        const oldAvatar = oldMember.user.displayAvatarURL({ dynamic: true });
        const newAvatar = newMember.user.displayAvatarURL({ dynamic: true });
        
        if (oldAvatar !== newAvatar) {
          const avatarCheck = checkSuspiciousAvatar(newAvatar);
          
          if (avatarCheck.isSuspicious) {
            await logMemberViolation(
              newMember.guild,
              newMember,
              'Suspicious Avatar',
              avatarCheck.reason,
              'Previous avatar',
              'Current avatar (see thumbnail)'
            );
          }
        }
      }
      
    } catch (e) {
      console.error('Member monitor error:', e.message);
    }
  }
};
