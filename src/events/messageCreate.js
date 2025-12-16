import { Events, PermissionsBitField } from 'discord.js';
import { guildAllowed, isOwner, hasBypassRole } from '../utils/config.js';
import { createSecurityEmbed, createModerationButtons } from '../utils/securityEmbed.js';
import { containsBlacklistedContent, getContentSeverity } from '../utils/blacklist.js';
import { getGuildPermission } from '../utils/guildPermissions.js';

const MESSAGE_SECURITY_CONFIG = {
  LOG_CHANNEL_ID: process.env.MESSAGE_SECURITY_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID,
  ENABLED: process.env.MESSAGE_SECURITY_ENABLED !== 'false',
  BLOCK_LINKS: process.env.BLOCK_LINKS !== 'false',
  ALLOWED_DOMAINS: (process.env.ALLOWED_DOMAINS || 'discord.com,github.com,youtube.com').split(','),
  SPAM_THRESHOLD: Number(process.env.SPAM_THRESHOLD || 5),
  SPAM_WINDOW_SECONDS: Number(process.env.SPAM_WINDOW_SECONDS || 10),
  MAX_MENTIONS: Number(process.env.MAX_MENTIONS || 5),
  BLOCK_EVERYONE_HERE: process.env.BLOCK_EVERYONE_HERE !== 'false',
  MAX_CAPS_PERCENTAGE: Number(process.env.MAX_CAPS_PERCENTAGE || 70),
  MAX_EMOJI_COUNT: Number(process.env.MAX_EMOJI_COUNT || 10),
  ENABLE_BLACKLIST: process.env.ENABLE_BLACKLIST !== 'false',
  AUTO_DELETE_BLACKLISTED: process.env.AUTO_DELETE_BLACKLISTED !== 'false',
  AUTO_DELETE: process.env.AUTO_DELETE_VIOLATIONS !== 'false',
  BYPASS_ROLES: (process.env.MESSAGE_SECURITY_BYPASS_ROLES || '').split(',').filter(r => r.trim())
};

const spamTracker = new Map();

const SUSPICIOUS_PATTERNS = [
  /discord\.gg\/[a-zA-Z0-9]+/g,
  /discordapp\.com\/gifts\//g,
  /free.*nitro/gi,
  /steam.*community/gi,
  /bit\.ly|tinyurl|t\.co/gi
];

function getSpamMap(guildId) {
  if (!spamTracker.has(guildId)) spamTracker.set(guildId, new Map());
  return spamTracker.get(guildId);
}

function checkSpam(guildId, userId) {
  const guildMap = getSpamMap(guildId);
  const now = Date.now();
  const cutoff = now - (MESSAGE_SECURITY_CONFIG.SPAM_WINDOW_SECONDS * 1000);
  
  if (!guildMap.has(userId)) guildMap.set(userId, []);
  const userMessages = guildMap.get(userId);
  
  const recentMessages = userMessages.filter(timestamp => timestamp > cutoff);
  recentMessages.push(now);
  guildMap.set(userId, recentMessages);
  
  return recentMessages.length >= MESSAGE_SECURITY_CONFIG.SPAM_THRESHOLD;
}

function checkLinks(content) {
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = content.match(urlRegex) || [];
  
  for (const url of urls) {
    try {
      const domain = new URL(url).hostname.toLowerCase();
      if (!MESSAGE_SECURITY_CONFIG.ALLOWED_DOMAINS.some(allowed => domain.includes(allowed))) {
        return { blocked: true, url, reason: 'Unauthorized domain' };
      }
    } catch (e) {
      return { blocked: true, url, reason: 'Invalid URL format' };
    }
  }
  
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(content)) {
      return { blocked: true, url: 'suspicious pattern', reason: 'Suspicious link pattern detected' };
    }
  }
  
  return { blocked: false };
}

function checkMassMentions(message) {
  const mentions = message.mentions.users.size + message.mentions.roles.size;
  const hasEveryoneHere = message.mentions.everyone;
  
  if (MESSAGE_SECURITY_CONFIG.BLOCK_EVERYONE_HERE && hasEveryoneHere) {
    return { violation: true, reason: '@everyone/@here mention detected' };
  }
  
  if (mentions > MESSAGE_SECURITY_CONFIG.MAX_MENTIONS) {
    return { violation: true, reason: `Too many mentions (${mentions}/${MESSAGE_SECURITY_CONFIG.MAX_MENTIONS})` };
  }
  
  return { violation: false };
}

function checkContentViolations(content) {
  const violations = [];
  
  const letters = content.replace(/[^a-zA-Z]/g, '');
  if (letters.length > 10) {
    const caps = content.replace(/[^A-Z]/g, '');
    const capsPercentage = (caps.length / letters.length) * 100;
    if (capsPercentage > MESSAGE_SECURITY_CONFIG.MAX_CAPS_PERCENTAGE) {
      violations.push(`Excessive caps (${Math.round(capsPercentage)}%)`);
    }
  }
  
  const emojiCount = (content.match(/<:[^:]+:\d+>|[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu) || []).length;
  if (emojiCount > MESSAGE_SECURITY_CONFIG.MAX_EMOJI_COUNT) {
    violations.push(`Too many emojis (${emojiCount}/${MESSAGE_SECURITY_CONFIG.MAX_EMOJI_COUNT})`);
  }
  
  return violations;
}

async function logViolation(guild, message, violationType, details, shouldDelete = false) {
  try {
    const channel = await guild.channels.fetch(MESSAGE_SECURITY_CONFIG.LOG_CHANNEL_ID).catch(() => null);
    if (!channel) return;
    
    const fields = [
      { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
      { name: 'Violation', value: violationType, inline: true },
      { name: 'Details', value: details, inline: false }
    ];
    
    if (message.content && message.content.length > 0) {
      const content = message.content.length > 1000 ? 
        message.content.substring(0, 1000) + '...' : message.content;
      fields.push({ name: 'Message Content', value: `\`\`\`${content}\`\`\``, inline: false });
    }
    
    if (shouldDelete) {
      fields.push({ name: 'Action', value: 'Message auto-deleted', inline: true });
    }
    
    const embed = createSecurityEmbed(
      'Message Security Violation',
      0xff6b6b,
      fields,
      message.author,
      message.author.displayAvatarURL({ dynamic: true })
    );
    
    const buttons = createModerationButtons(message.author.id, 'msg');
    
    await channel.send({ embeds: [embed], components: [buttons] });
  } catch (e) {
    console.error('Message security log error:', e.message);
  }
}

export default {
  name: Events.MessageCreate,
  async execute(message) {
    try {
      // Completely disable message security for now
      return;
      
      if (!message.guild) return;
      if (!guildAllowed(message.guild)) return;
      if (!getGuildPermission(message.guild.id, 'MESSAGE_SECURITY_ENABLED')) return;
      if (!MESSAGE_SECURITY_CONFIG.LOG_CHANNEL_ID) return;
      if (message.author.bot) return;
      
      // Skip owners and admins
      if (isOwner(message.guild, message.author.id)) return;
      if (message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) return;
      if (hasBypassRole(message.member, MESSAGE_SECURITY_CONFIG.BYPASS_ROLES)) return;
      
      let shouldDelete = false;
      const violations = [];
      
      // Check spam
      if (checkSpam(message.guild.id, message.author.id)) {
        violations.push('Spam detected');
        shouldDelete = true;
      }
      
      let linkViolation = false;
      // Check links
      if (MESSAGE_SECURITY_CONFIG.BLOCK_LINKS) {
        const linkCheck = checkLinks(message.content);
        if (linkCheck.blocked) {
          linkViolation = true;
          violations.push(`Blocked link: ${linkCheck.reason}`);
          shouldDelete = true;
          
          try {
            const timeoutDuration = Number(process.env.LINK_TIMEOUT_MINUTES || 5) * 60 * 1000;
            await message.member.timeout(timeoutDuration, 'Sent unauthorized link');
            violations.push(`User timed out for ${process.env.LINK_TIMEOUT_MINUTES || 5} minutes`);
          } catch (timeoutError) {
            console.error('Failed to timeout user for link:', timeoutError.message);
          }
        }
      }
      
      // Check mass mentions
      const mentionCheck = checkMassMentions(message);
      if (mentionCheck.violation) {
        violations.push(mentionCheck.reason);
        shouldDelete = true;
      }
      
      // Check content violations
      const contentViolations = checkContentViolations(message.content);
      violations.push(...contentViolations);
      
      // Check blacklisted content
      if (MESSAGE_SECURITY_CONFIG.ENABLE_BLACKLIST) {
        const blacklistCheck = containsBlacklistedContent(message.content);
        if (blacklistCheck.isBlacklisted) {
          const severity = getContentSeverity(message.content);
          violations.push(`Prohibited language detected (${severity} severity)`);
          
          // Always delete blacklisted content if auto-delete is enabled
          if (MESSAGE_SECURITY_CONFIG.AUTO_DELETE_BLACKLISTED) {
            shouldDelete = true;
          }
        }
      }
      
      // If violations found, log and optionally delete
      if (violations.length > 0) {
        if (shouldDelete && MESSAGE_SECURITY_CONFIG.AUTO_DELETE) {
          try {
            await message.delete();
          } catch (e) {
            console.error('Failed to delete message:', e.message);
          }
        }
        
        await logViolation(
          message.guild, 
          message, 
          'Message Policy Violation', 
          violations.join('\n• '), 
          shouldDelete && MESSAGE_SECURITY_CONFIG.AUTO_DELETE
        );
      }
      
    } catch (e) {
      console.error('Message security error:', e.message);
    }
  }
};
