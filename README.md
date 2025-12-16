# Mariana Security Bot

SERVER SCANNING, ALT DETECTION, AND WELCOME ARE THE ONLY THINGS THAT DONT WORK WILL BE FIXED IN LATWER UPDATES

A comprehensive Discord security bot designed to protect your server from raids, malicious activity, and unauthorized actions. Built with Discord.js v14, this bot provides real-time monitoring and automated protection against various security threats.

## Features

### Core Security Features

- **Mass Kick/Ban Protection** - Automatically detects and prevents mass kick/ban attacks
- **Vanity URL Protection** - Monitors and protects your server's vanity URL from unauthorized changes
- **Alt Account Detection** - Identifies suspicious new accounts based on age, username patterns, avatar, and bio
- **Anti-Bot Protection** - Automatically kicks unauthorized bots with configurable whitelist
- **Role Monitor** - Tracks suspicious role creation, deletion, and permission changes
- **Channel Monitor** - Detects mass channel creation/deletion attacks
- **Webhook Protection** - Monitors and prevents malicious webhook creation
- **Server Settings Protection** - Alerts on unauthorized server configuration changes
- **Integration Monitor** - Tracks server integrations and bot additions

### Message Security

- **Spam Detection** - Prevents message spam with configurable thresholds
- **Link Filtering** - Whitelist-based domain filtering
- **Mention Spam Protection** - Limits excessive mentions
- **Caps Lock Detection** - Monitors excessive uppercase usage
- **Emoji Spam Protection** - Prevents emoji flooding
- **Message Censoring** - Role-based message censoring system

### Additional Features

- **Welcome Images** - Custom welcome cards for new members
- **Custom Embeds** - Create and send custom embedded messages
- **Rotating Status** - Dynamic bot status with server/member counts
- **Multi-Guild Support** - Approve specific guilds or allow all
- **Granular Bypass System** - Role and user-based bypass permissions for each security feature

##  Requirements

- Node.js >= 18.17
- Discord Bot Token with the following intents:
  - Guilds
  - Guild Members
  - Guild Bans
  - Guild Messages
  - Message Content
  - Guild Webhooks
  - Guild Integrations

## Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   - Copy `.env.example` to `.env` (or create a new `.env` file)
   - Fill in your configuration (see Configuration section below)

4. **Start the bot**
   ```bash
   npm start
   ```

## Configuration

Create a `.env` file in the root directory with the following variables:

### Required Settings

```env
# Bot Configuration
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here

# Owner Configuration
OWNER_ID=your_discord_user_id
```

### Optional Settings

```env
# Multi-Guild Support (comma-separated guild IDs, leave empty to allow all guilds)
APPROVED_GUILDS=1234567890,0987654321

# Universal Bypass Role (role that bypasses all security checks)
UNIVERSAL_BYPASS_ROLE=role_id_here

# Blacklisted Servers
BLACKLISTED_SERVERS=server_id_1,server_id_2

# Bot Status Configuration
BOT_STATUS_1=Securing Your Server
BOT_ACTIVITY_TYPE_1=WATCHING
STATUS_ROTATION_SECONDS=30

# Default Security Thresholds
THRESHOLD=3
WINDOW_SECONDS=10

# Log Channels (set different channels per feature or use default)
LOG_CHANNEL_ID=default_log_channel_id
MESSAGE_SECURITY_LOG_CHANNEL_ID=
ALT_DETECTION_LOG_CHANNEL_ID=
MASS_KICK_LOG_CHANNEL_ID=
MASS_BAN_LOG_CHANNEL_ID=
VANITY_PROTECTION_LOG_CHANNEL_ID=
ROLE_MONITOR_LOG_CHANNEL_ID=
CHANNEL_MONITOR_LOG_CHANNEL_ID=
MEMBER_UPDATE_LOG_CHANNEL_ID=
SERVER_SETTINGS_LOG_CHANNEL_ID=
INTEGRATION_MONITOR_LOG_CHANNEL_ID=
CENSOR_LOG_CHANNEL_ID=
ANTI_BOT_LOG_CHANNEL_ID=
BOT_WHITELIST_LOG_CHANNEL_ID=

# Message Security Settings
ALLOWED_DOMAINS=discord.com,github.com,youtube.com
SPAM_THRESHOLD=5
SPAM_WINDOW_SECONDS=10
MAX_MENTIONS=5
MAX_CAPS_PERCENTAGE=70
MAX_EMOJI_COUNT=10
SPAM_TIMEOUT_MINUTES=25

# Mass Action Detection
MASS_KICK_THRESHOLD=3
MASS_KICK_WINDOW_SECONDS=60
MASS_BAN_THRESHOLD=3
MASS_BAN_WINDOW_SECONDS=60

# Alt Detection
MIN_ACCOUNT_AGE_MONTHS=6

# Channel/Role/Webhook Protection
MASS_CREATION_THRESHOLD=5
MASS_CREATION_WINDOW=60
MASS_DELETION_THRESHOLD=3
MASS_DELETION_WINDOW=60
MASS_ROLE_THRESHOLD=3
MASS_ROLE_WINDOW=60
MASS_WEBHOOK_THRESHOLD=3
MASS_WEBHOOK_WINDOW=60

# Anti-Bot Settings
ANTI_BOT_ENABLED=true
BOT_KICK_DELAY_SECONDS=5

# Censoring
CENSORED_ROLE=role_id_here
LINK_TIMEOUT_MINUTES=5
```

## Commands

### Security Management

- `/bypass add` - Add bypass permissions for users or roles
- `/bypass remove` - Remove bypass permissions
- `/bypass list` - List all bypass permissions
- `/whitelist add` - Add a bot to the whitelist
- `/whitelist remove` - Remove a bot from the whitelist
- `/whitelist list` - List all whitelisted bots

### Moderation

- `/censor <user>` - Censor a user's messages
- `/uncensor <user>` - Remove censoring from a user
- `/permission add` - Add role-based permissions
- `/permission remove` - Remove role-based permissions
- `/perms <user>` - View user permissions
- `/permsremove <user>` - Remove user permissions
- `/roles` - Manage role assignments

### Utility

- `/embed` - Create custom embedded messages

## Permission System

The bot features a granular bypass system with the following bypass types:

- `MESSAGE_SECURITY_BYPASS` - Bypass message spam/filter checks
- `ALT_DETECTION_BYPASS` - Bypass alt account detection
- `MASS_KICK_BYPASS` - Bypass mass kick protection
- `MASS_BAN_BYPASS` - Bypass mass ban protection
- `VANITY_PROTECTION_BYPASS` - Bypass vanity URL protection
- `ROLE_MONITOR_BYPASS` - Bypass role monitoring
- `CHANNEL_MONITOR_BYPASS` - Bypass channel monitoring
- `MEMBER_UPDATE_BYPASS` - Bypass member update monitoring
- `SERVER_SETTINGS_BYPASS` - Bypass server settings monitoring
- `INTEGRATION_MONITOR_BYPASS` - Bypass integration monitoring

## Bot Permissions Required

Your bot needs the following Discord permissions:

- **Administrator** (recommended) or the following specific permissions:
  - View Channels
  - Send Messages
  - Embed Links
  - Attach Files
  - Read Message History
  - Manage Messages
  - Manage Channels
  - Manage Roles
  - Manage Server
  - Kick Members
  - Ban Members
  - Manage Webhooks
  - View Audit Log

## Event Monitoring

The bot monitors the following Discord events:

- Member joins/leaves/updates
- Role creation/updates
- Channel creation/deletion
- Ban additions
- Webhook creation/updates
- Server settings changes
- Message creation
- Integration additions

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This bot is designed for legitimate server security purposes. Always ensure you comply with Discord's Terms of Service and Community Guidelines when using this bot.

## Known Issues

- Server scanning feature is currently disabled (work in progress)

## Support

For support, questions, or feature requests, please open an issue on GitHub Or Contact Me Directly On Discord @ lua.daddy.

## Acknowledgments

Built with [Discord.js](https://discord.js.org/) v14

---

**Note:** Make sure to enable all required intents in your Discord Developer Portal, especially the "Server Members Intent" and "Message Content Intent" for the bot to function properly.
