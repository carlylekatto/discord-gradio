// examples/basic-bot.js
/**
 * Professional implementation of a Discord Bot using discord-gradio.
 */

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const { GradioPlayground, ConfigParser, ErrorCodes } = require('../dist');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const playground = new GradioPlayground({
    customizers: {
        loading: ({ session }) => {
            return { 
                content: `🚀 Connecting to **${session.appReference}**...` 
            };
        },
        error: ({ error }) => {
            return { 
                content: `❌ **Gradio Error:** ${error.message}`, 
                flags: 64 // Using flags instead of ephemeral
            };
        }
    }
});

const COMMANDS = [
    new SlashCommandBuilder()
        .setName('gradio')
        .setDescription('Interact with any Gradio application')
        .addSubcommand(subcommand =>
            subcommand
                .setName('run')
                .setDescription('Start an interaction with a Gradio Space')
                .addStringOption(option =>
                    option.setName('space')
                        .setDescription('Space ID or URL')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('api')
                        .setDescription('Specific API name')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Analyze a Gradio Space endpoints')
                .addStringOption(option =>
                    option.setName('space')
                        .setDescription('Space ID or URL')
                        .setRequired(true)
                )
        ),
    new SlashCommandBuilder()
        .setName('color')
        .setDescription('Extract colors from an image')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        if (process.env.CLIENT_ID) {
            console.log('🔄 Registering application commands...');
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: COMMANDS },
            );
            console.log('✅ Commands registered successfully.');
        }
    } catch (error) {
        console.error('❌ Registration error:', error);
    }
})();

// Updated event name for Discord.js v14/v15
client.on('clientReady', () => {
    console.log(`🤖 Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName, options } = interaction;

        if (commandName === 'gradio') {
            const subcommand = options.getSubcommand();
            const space = options.getString('space');
            
            if (subcommand === 'run') {
                const api = options.getString('api');
                try {
                    await playground.init(interaction, space, api);
                } catch (error) {
                    console.error('Init error:', error);
                }
            } else if (subcommand === 'info') {
                await interaction.deferReply({ flags: 64 });
                try {
                    const baseUrl = ConfigParser.normalizeUrl(space);
                    const config = await ConfigParser.fetchConfig(baseUrl);
                    const parsed = ConfigParser.parse(config, null);
                    
                    let info = `**Space Metadata:** \`${space}\`\n`;
                    info += `🔹 **Main API:** \`${parsed.apiName || 'default'}\`\n`;
                    info += `📥 **Inputs:** ${parsed.inputs.length}\n`;
                    info += `📤 **Outputs:** ${parsed.outputs.length}\n`;
                    
                    await interaction.editReply({ content: info });
                } catch (error) {
                    await interaction.editReply({ content: `❌ Error fetching info: ${error.message}` });
                }
            }
        } else if (commandName === 'color') {
            try {
                await playground.init(interaction, 'eienmojiki-colorextractor', 'extract_colors', {
                    ephemeral: false,
                    formatReply: (result) => {
                        const hexCodes = result.data.text.match(/#[0-9A-Fa-f]{6}/g) || [];
                        const unique = [...new Set(hexCodes)];
                        return { 
                            content: `🎨 **Extracted Colors:**\n${unique.join(', ') || 'None found.'}` 
                        };
                    }
                });
            } catch (e) {}
        }
    }
    
    else if (interaction.isModalSubmit()) {
        try {
            const handled = await playground.handleSubmit(interaction);
            if (handled) console.log(`✅ Handled Modal: ${interaction.customId}`);
        } catch (error) {
            console.error('💥 Modal Error:', error);
        }
    }
    
    else if (interaction.isButton()) {
        try {
            const handled = await playground.handleButton(interaction);
            if (handled) console.log(`🔘 Handled Button: ${interaction.customId}`);
        } catch (error) {
            console.error('💥 Button Error:', error);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
