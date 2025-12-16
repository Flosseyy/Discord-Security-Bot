import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events, AttachmentBuilder } from 'discord.js';
import { guildAllowed, hasBypassRole } from '../utils/config.js';
import { createSecurityEmbed, createModerationButtons } from '../utils/securityEmbed.js';
import { createWelcomeImage } from '../utils/welcomeImage.js';

const ALT_DETECTION_CONFIG = {
  LOG_CHANNEL_ID: process.env.ALT_DETECTION_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID,
  ENABLED: process.env.ALT_DETECTION_ENABLED !== 'false',
  MIN_ACCOUNT_AGE_MONTHS: Number(process.env.MIN_ACCOUNT_AGE_MONTHS || 6),
  CHECK_USERNAME: process.env.ALT_CHECK_USERNAME !== 'false',
  CHECK_AVATAR: process.env.ALT_CHECK_AVATAR !== 'false',
  CHECK_BIO: process.env.ALT_CHECK_BIO !== 'false',
  BYPASS_ROLES: (process.env.ALT_DETECTION_BYPASS_ROLES || '').split(',').filter(r => r.trim())
};

const SUSPICIOUS_USERNAME_PATTERNS = [
  /^[a-z]+\d{4,}$/i,
  /^user\d+$/i,
  /^[a-z]{1,3}\d{8,}$/i,
  /^\w+_\d{4,}$/,
  /^(discord|bot|admin|mod|owner)\d+$/i,
  /^[a-z]+[0-9]{6,}$/i,
  /^(test|temp|alt|fake)\w*$/i
];

function checkSuspiciousUsername(username) {
  return SUSPICIOUS_USERNAME_PATTERNS.some(pattern => pattern.test(username));
}

function checkAccountAge(user) {
  const accountAge = Date.now() - user.createdTimestamp;
  const monthsOld = accountAge / (1000 * 60 * 60 * 24 * 30);
  return monthsOld < ALT_DETECTION_CONFIG.MIN_ACCOUNT_AGE_MONTHS;
}

function checkDefaultAvatar(user) {
  return !user.avatar;
}

async function checkNoBio(member) {
  try {
    const fullUser = await member.user.fetch();
    return !fullUser.bio || fullUser.bio.trim().length === 0;
  } catch (e) {
    return true;
  }
}

function createSuspiciousEmbed(member, reasons) {
  const user = member.user;
  const accountAge = Math.floor((Date.now() - user.createdTimestamp) / (1000 * 60 * 60 * 24));
  
  const fields = [
    { name: 'User ID', value: user.id, inline: true },
    { name: 'Account Age', value: `${accountAge} days`, inline: true },
    { name: 'Suspicious Reasons', value: reasons.map(r => `• ${r}`).join('\n'), inline: false }
  ];

  return createSecurityEmbed(
    'Suspicious Account Detected',
    0xff9900,
    fields,
    user,
    user.displayAvatarURL({ dynamic: true, size: 256 })
  );
}

async function checkCensoredRejoin(member) {
  try {
    const CENSORED_ROLE = process.env.CENSORED_ROLE;
    if (!CENSORED_ROLE) return;
    
    const isCensored = await checkIfCensored(member.guild.id, member.user.id);
    
    if (isCensored) {
      const censoredRole = await member.guild.roles.fetch(CENSORED_ROLE).catch(() => null);
      
      if (censoredRole) {
        await member.roles.add(censoredRole, 'Automatically re-censored on rejoin');
        console.log(`Re-censored ${member.user.tag} (${member.user.id}) on rejoin to ${member.guild.name}`);
      }
    }
  } catch (error) {
    console.error('Censor rejoin error:', error);
  }
}

async function checkIfCensored(guildId, userId) {
  const fs = await import('fs');
  const path = await import('path');
  
  const dataDir = path.join(process.cwd(), 'data');
  const filePath = path.join(dataDir, 'censored.json');
  
  if (!fs.existsSync(filePath)) return false;
  
  try {
    const censoredData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return !!(censoredData[guildId] && censoredData[guildId][userId]);
  } catch (e) {
    console.error('Error checking censored status:', e);
    return false;
  }
};

// Function to send welcome message
async function sendWelcomeMessage(member) {
  try {
    // Get the welcome channel ID from environment variables
    const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
    if (!welcomeChannelId) {
      console.warn('WELCOME_CHANNEL_ID is not set in .env file');
      return;
    }

    // Get the welcome channel
    const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);
    if (!welcomeChannel) {
      console.warn(`Welcome channel with ID ${welcomeChannelId} not found`);
      return;
    }

    // Create welcome image with canvas
    const welcomeImageBuffer = await createWelcomeImage(member);
    const attachment = new AttachmentBuilder(welcomeImageBuffer, { name: 'welcome.png' });

    // Send welcome message
    await welcomeChannel.send({
      content: `🎉 Welcome to the server, ${member}! 🎉`,
      files: [attachment]
    });

  } catch (error) {
    console.error('Error sending welcome message:', error);
  }
}

export default {
  name: Events.GuildMemberAdd,
  async execute(member) {
    try {
      if (!ALT_DETECTION_CONFIG.ENABLED) return;
      if (!ALT_DETECTION_CONFIG.LOG_CHANNEL_ID) {
        console.warn('Alt detection: No LOG_CHANNEL_ID configured');
        return;
      }

      const guild = member.guild;
      if (!guildAllowed(guild)) return;
      
      await checkCensoredRejoin(member);
      // Send welcome message
      await sendWelcomeMessage(member);

      // Check for suspicious accounts
      if (ALT_DETECTION_CONFIG.ENABLED && !hasBypassRole(member, ALT_DETECTION_CONFIG.BYPASS_ROLES)) {
        const user = member.user;
        const suspiciousReasons = [];

        // Check account age
        if (checkAccountAge(user)) {
          const monthsOld = Math.floor((Date.now() - user.createdTimestamp) / (1000 * 60 * 60 * 24 * 30 * 10)) / 10;
          suspiciousReasons.push(`Account too new (${monthsOld.toFixed(1)} months old)`);
        }
        const monthsOld = Math.floor((Date.now() - user.createdTimestamp) / (1000 * 60 * 60 * 24 * 30 * 10)) / 10;
        suspiciousReasons.push(`Account too new (${monthsOld.toFixed(1)} months old)`);
      }

      // Check username
      if (ALT_DETECTION_CONFIG.CHECK_USERNAME && checkSuspiciousUsername(user.username)) {
        suspiciousReasons.push('Suspicious username pattern');
      }

      // Check default avatar
      if (ALT_DETECTION_CONFIG.CHECK_AVATAR && checkDefaultAvatar(user)) {
        suspiciousReasons.push('Using default Discord avatar');
      }

      // Check bio
      if (ALT_DETECTION_CONFIG.CHECK_BIO && await checkNoBio(member)) {
        suspiciousReasons.push('No bio/about me section');
      }

      // If suspicious, log it
      if (suspiciousReasons.length > 0) {
        const embed = createSuspiciousEmbed(member, suspiciousReasons);
        const buttons = createModerationButtons(user.id, 'alt');

        try {
          const channel = await guild.channels.fetch(ALT_DETECTION_CONFIG.LOG_CHANNEL_ID);
          if (channel) {
            await channel.send({ embeds: [embed], components: [buttons] });
          }
        } catch (e) {
          console.error('Alt detection log error:', e.message);
        }
      }
    } catch (e) {
      console.error('Alt detection error:', e.message);
    }
  }
};
