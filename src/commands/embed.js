import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { isOwner } from '../utils/config.js';

// Helper function to parse color input (supports hex, rgb, or color names)
function parseColor(colorInput) {
  if (!colorInput) return 0x2b2d31; // Default color if none provided
  
  // Try to parse as hex
  if (/^#?[0-9A-Fa-f]{6}$/.test(colorInput)) {
    return parseInt(colorInput.replace('#', ''), 16);
  }
  
  // Try to parse as rgb
  const rgbMatch = colorInput.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgbMatch) {
    const [_, r, g, b] = rgbMatch.map(Number);
    if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
      return (r << 16) + (g << 8) + b;
    }
  }
  
  // Try common color names
  const colors = {
    'red': 0xff0000,
    'green': 0x00ff00,
    'blue': 0x0000ff,
    'yellow': 0xffff00,
    'purple': 0x800080,
    'pink': 0xffc0cb,
    'orange': 0xffa500,
    'black': 0x000000,
    'white': 0xffffff,
    'gray': 0x808080,
  };
  
  return colors[colorInput?.toLowerCase()] || 0x2b2d31; // Default color if not found
}

const data = new SlashCommandBuilder()
  .setName('embed')
  .setDescription('Create a custom embed message (Owner only)')
  .addStringOption(option =>
    option.setName('title')
      .setDescription('The title of the embed')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('description')
      .setDescription('The main content of the embed')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('color')
      .setDescription('The color of the embed (hex, rgb, or color name)')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('footer')
      .setDescription('The footer text')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('thumbnail')
      .setDescription('URL for the thumbnail image')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('image')
      .setDescription('URL for the main image')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('author')
      .setDescription('The author text')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('author_icon')
      .setDescription('URL for the author icon')
      .setRequired(false));

const execute = async (interaction) => {
  try {
    // Check if the user is an owner
    if (!isOwner(interaction.guild, interaction.user.id)) {
      return await interaction.reply({
        content: '❌ Only bot owners can use this command.',
        ephemeral: true
      });
    }

    // Get all options
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const color = interaction.options.getString('color');
    const footer = interaction.options.getString('footer');
    const thumbnail = interaction.options.getString('thumbnail');
    const image = interaction.options.getString('image');
    const author = interaction.options.getString('author');
    const authorIcon = interaction.options.getString('author_icon');

    // Create the embed
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(parseColor(color));

    // Add optional fields if provided
    if (footer) embed.setFooter({ text: footer });
    if (thumbnail) embed.setThumbnail(thumbnail);
    if (image) embed.setImage(image);
    if (author) {
      embed.setAuthor({
        name: author,
        iconURL: authorIcon || undefined
      });
    }

    // Send the embed
    await interaction.reply({ content: 'Embed sent!', ephemeral: true });
    await interaction.channel.send({ embeds: [embed] });

  } catch (error) {
    console.error('Error in embed command:', error);
    await interaction.reply({
      content: '❌ An error occurred while creating the embed.',
      ephemeral: true
    });
  }
};

export default { data, execute };
