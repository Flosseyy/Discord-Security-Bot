export async function createWelcomeImage(member) {
    try {
        // Use some-random-api.com for welcome card generation
        const username = encodeURIComponent(member.user.username);
        const avatar = encodeURIComponent(member.user.displayAvatarURL({ extension: 'png', size: 512 }));
        const memberCount = member.guild.memberCount;
        const guildName = encodeURIComponent(member.guild.name);
        
        // Generate welcome card URL using some-random-api
        const welcomeCardUrl = `https://some-random-api.com/canvas/misc/welcome?type=join&username=${username}&discriminator=0&avatar=${avatar}&key=&subtitle=Welcome%20to%20${guildName}&members=${memberCount}`;
        
        // Fetch the image
        const response = await fetch(welcomeCardUrl);
        if (!response.ok) {
            throw new Error(`Failed to generate welcome image: ${response.status}`);
        }
        
        // Return the image as a buffer
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
        
    } catch (error) {
        console.error('Error creating welcome image:', error);
        throw error;
    }
}
