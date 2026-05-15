// examples/basic-bot.js
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();
const { GradioPlayground, ErrorCodes } = require('../src');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const playground = new GradioPlayground();

// Configure custom message behavior
playground.setCustomizer('loading', ({ session }) => {
    return { content: `Connecting to model: **${session.spaceId}**...` };
});

playground.setCustomizer('markdown', ({ component }) => {
    const originalValue = component.value || '';
    // Clean up HTML tags if necessary for Discord display
    const cleanValue = originalValue.replace(/<[^>]*>/g, '').trim();
    
    return {
        type: 18,
        label: component.label || 'Information',
        component: {
            type: 10,
            value: `ℹ️ **Note:**\n${cleanValue}`
        }
    };
});

// Define slash commands
const COMMANDS = [
    new SlashCommandBuilder()
        .setName('gradio')
        .setDescription('Interact with Gradio Spaces')
        .addSubcommand(subcommand =>
            subcommand
                .setName('run')
                .setDescription('Initialize a Gradio Space interaction')
                .addStringOption(option =>
                    option.setName('space')
                        .setDescription('Space ID (e.g., course-demos/whisper-small)')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('api')
                        .setDescription('API name (default: predict)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('View metadata for a Gradio Space')
                .addStringOption(option =>
                    option.setName('space')
                        .setDescription('Space ID')
                        .setRequired(true)
                )
        ),
    new SlashCommandBuilder()
        .setName('extract-color')
        .setDescription('Specialized tool: Extract colors from an image')
].map(command => command.toJSON());

// Command registration
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        if (process.env.CLIENT_ID) {
            console.log('Registering application commands...');
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: COMMANDS },
            );
            console.log('Commands registered successfully.');
        } else {
            console.warn('CLIENT_ID not found in environment variables.');
        }
    } catch (error) {
        console.error('Registration error:', error);
    }
})();

client.on('clientReady', () => {
    console.log(`Authenticated as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'gradio') {
            const subcommand = interaction.options.getSubcommand();
            const spaceId = interaction.options.getString('space');
            
            if (subcommand === 'run') {
                const apiName = interaction.options.getString('api');
                try {
                    await playground.init(interaction, spaceId, apiName);
                } catch (error) {
                    console.error('Initialization error:', error);
                    await interaction.reply({ 
                        content: `Failed to initialize session: ${error.message}`, 
                        ephemeral: true 
                    });
                }
            } else if (subcommand === 'info') {
                await interaction.deferReply({ ephemeral: true });
                try {
                    const ConfigParser = require('../src/utils/ConfigParser');
                    const baseUrl = ConfigParser.normalizeUrl(spaceId);
                    const config = await ConfigParser.fetchConfig(baseUrl);
                    const endpoints = ConfigParser.listEndpoints(config);
                    
                    let reply = `**Metadata for:** \`${spaceId}\`\n\n`;
                    for (const ep of endpoints) {
                        reply += `🔹 **API:** \`${ep.api_name}\`\n`;
                        reply += `   📥 **Inputs:**\n` + ep.inputs.map(i => `      - ${i}`).join('\n') + '\n';
                        reply += `   📤 **Outputs:**\n` + ep.outputs.map(o => `      - ${o}`).join('\n') + '\n\n';
                    }
                    
                    await interaction.editReply({ 
                        content: reply.length > 2000 ? reply.substring(0, 1990) + '...' : reply 
                    });
                } catch (error) {
                    console.error('Info fetch error:', error);
                    await interaction.editReply({ content: `Failed to fetch metadata: ${error.message}` });
                }
            }
        } else if (interaction.commandName === 'extract-color') {
            try {
                await playground.init(interaction, 'eienmojiki-colorextractor', 'extract_colors', {
                    formatReply: (result) => {
                        const html = result.data.text || '';
                        const hexCodes = html.match(/#[0-9A-Fa-f]{6}/g) || [];
                        
                        let reply = `**🎨 Color Extraction Results:**\n\n`;
                        if (hexCodes.length > 0) {
                            const uniqueHex = [...new Set(hexCodes)];
                            reply += uniqueHex.map(hex => `- \`${hex}\``).join('\n');
                        } else {
                            reply += `No color codes detected in output.`;
                        }
                        return { content: reply };
                    }
                });
            } catch (error) {
                console.error('Execution error:', error);
                await interaction.reply({ content: `Processing failed: ${error.message}`, ephemeral: true });
            }
        }
    }
    
    else if (interaction.isModalSubmit()) {
        try {
            const handled = await playground.handleSubmit(interaction);
            if (handled) console.log(`Processed Gradio Modal: ${interaction.customId}`);
        } catch (error) {
            console.error('Modal submission error:', error);
            
            let errorMessage = `Process Error: ${error.message}`;
            if (error.code === ErrorCodes.SESSION_NOT_FOUND) {
                errorMessage = 'Session expired or not found. Please restart the interaction.';
            } else if (error.code === ErrorCodes.FILE_DOWNLOAD_FAILED) {
                errorMessage = 'Failed to retrieve files from Discord. Please verify the upload.';
            }
            
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    }
    
    else if (interaction.isButton()) {
        try {
            const handled = await playground.handleButton(interaction);
            if (handled) console.log(`Processed Navigation Button: ${interaction.customId}`);
        } catch (error) {
            console.error('Button interaction error:', error);
            await interaction.reply({ content: `Navigation Error: ${error.message}`, ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
