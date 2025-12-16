import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { pathToFileURL } from 'url';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function loadCommands(client) {
  const commands = [];
  const commandsPath = join(__dirname, '..', 'commands');
  
  try {
    const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = join(commandsPath, file);
      const fileURL = pathToFileURL(filePath).href;
      
      try {
        const command = await import(fileURL);
        
        if (command.data && command.execute) {
          client.commands.set(command.data.name, command);
          commands.push(command.data.toJSON());
          console.log(`✅ Loaded command: ${command.data.name}`);
        } else {
          console.warn(`⚠️  Command file ${file} is missing data or execute function`);
        }
      } catch (error) {
        console.error(`❌ Failed to load command ${file}:`, error.message);
      }
    }

    await registerCommands(commands);
    
  } catch (error) {
    console.error('Failed to load commands directory:', error.message);
  }
}

async function registerCommands(commands) {
  try {
    const rest = new REST().setToken(config.TOKEN);
    
    console.log(`🔄 Registering ${commands.length} slash commands...`);
    
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID || 'your_client_id'),
      { body: commands }
    );
    console.log('✅ Successfully registered global commands');
    
  } catch (error) {
    console.error('Failed to register commands:', error);
  }
}
