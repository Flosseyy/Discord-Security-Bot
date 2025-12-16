import 'dotenv/config';
import { Client, Events, GatewayIntentBits, Partials, Collection, ActivityType } from 'discord.js';
import { readdirSync } from 'fs';
import { pathToFileURL } from 'url';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config, validateConfig } from './utils/config.js';
import { loadCommands } from './utils/commandHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

validateConfig();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildIntegrations
  ],
  partials: [Partials.GuildMember, Partials.User, Partials.Message]
});

client.commands = new Collection();

function getActivityType(type) {
  const types = {
    'PLAYING': ActivityType.Playing,
    'STREAMING': ActivityType.Streaming,
    'LISTENING': ActivityType.Listening,
    'WATCHING': ActivityType.Watching,
    'COMPETING': ActivityType.Competing
  };
  return types[type.toUpperCase()] || ActivityType.Watching;
}

function startStatusRotation(client) {
  let currentIndex = 0;
  
  function updateStatus() {
    let statusText = '';
    let activityType = '';
    
    if (currentIndex === 0) {
      statusText = process.env.BOT_STATUS_1 || 'Securing Mariana County Roleplay';
      activityType = getActivityType(process.env.BOT_ACTIVITY_TYPE_1 || 'WATCHING');
    } else if (currentIndex === 1) {
      const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
      statusText = process.env.BOT_STATUS_2 || `Securing ${totalMembers.toLocaleString()} Members`;
      activityType = getActivityType(process.env.BOT_ACTIVITY_TYPE_2 || 'WATCHING');
    } else {
      const serverCount = client.guilds.cache.size;
      statusText = process.env.BOT_STATUS_3 || `Securing ${serverCount} Servers`;
      activityType = getActivityType(process.env.BOT_ACTIVITY_TYPE_3 || 'WATCHING');
    }
    
    client.user.setActivity(statusText, { type: activityType });
    console.log(`Status updated: ${activityType.name} ${statusText}`);
    
    currentIndex = (currentIndex + 1) % 3;
  }
  
  updateStatus();
  
  const rotationInterval = Number(process.env.STATUS_ROTATION_SECONDS || 30) * 1000;
  setInterval(updateStatus, rotationInterval);
  
  console.log(`🔄 Status rotation started (${rotationInterval / 1000}s intervals)`);
}

async function loadEvents() {
  const eventsPath = join(__dirname, 'events');
  const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = join(eventsPath, file);
    const fileURL = pathToFileURL(filePath).href;
    
    try {
      const eventModule = await import(fileURL);
      const event = eventModule.default;
      
      if (event.name && event.execute) {
        client.on(event.name, (...args) => event.execute(...args));
        console.log(`Loaded event: ${event.name}`);
      } else {
        console.warn(`Event file ${file} is missing name or execute function`);
      }
    } catch (error) {
      console.error(`Failed to load event ${file}:`, error.message);
    }
  }
}

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Serving ${client.guilds.cache.size} guild(s)`);
  
  startStatusRotation(client);
  
  console.log('\nConfiguration Status:');
  console.log(`• Approved Guilds: ${config.APPROVED_GUILDS.length > 0 ? `${config.APPROVED_GUILDS.length} guilds` : 'All guilds allowed'}`);
  console.log(`• Owner Override: ${config.OWNER_ID ? `Set to ${config.OWNER_ID}` : 'Using guild owners'}`);
  console.log(`• Default Threshold: ${config.THRESHOLD}`);
  console.log(`• Default Window: ${config.WINDOW_SECONDS}s`);
  
  await loadCommands(client);
});

loadEvents().then(() => {
  client.login(config.TOKEN);
}).catch(error => {
  console.error('Failed to load events:', error);
  process.exit(1);
});
