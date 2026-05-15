import { 
    Client as GradioClient 
} from '@gradio/client';
import { 
    InteractionType, 
    ModalSubmitInteraction, 
    ButtonInteraction,
    CommandInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';
import { ConfigParser } from '../utils/ConfigParser';
import { ComponentMapper } from '../mappings/ComponentMapper';
import { IdManager } from '../utils/IdManager';
import { EmbedFactory } from '../factories/EmbedFactory';
import { Logger } from '../utils/Logger';
import { GradioPlaygroundError, ErrorCodes } from '../errors/GradioPlaygroundError';
import { GradioSession, Customizers, GradioComponent } from '../types';

export class GradioPlayground {
    private sessions: Map<string, GradioSession>;
    private embedFactory: typeof EmbedFactory;
    private customizers: Customizers;

    constructor(options: { customizers?: Customizers } = {}) {
        this.sessions = new Map();
        this.embedFactory = EmbedFactory;
        this.customizers = options.customizers || {};
    }

    /**
     * Handles the /gradio run command flow
     */
    async init(interaction: any, appReference: string, targetApiName: string | null = null, options: any = {}) {
        const sessionId = interaction.id;
        const isEphemeral = options.ephemeral !== false;
        const language = options.language || 'en';

        try {
            // 1. Fetch Config
            const baseUrl = ConfigParser.normalizeUrl(appReference);
            const config = await ConfigParser.fetchConfig(baseUrl);
            
            // 2. Parse Config
            const parsed = ConfigParser.parse(config, targetApiName, language);
            const { inputs, outputs, fnIndex } = parsed;

            // Detect API standard
            let appApiUrl = baseUrl;
            if (config.api_prefix) {
                let prefix = config.api_prefix;
                if (!prefix.startsWith('/')) prefix = '/' + prefix;
                appApiUrl = `${baseUrl}${prefix}`;
            } else {
                try {
                    const apiCheck = await fetch(`${baseUrl}/gradio_api/info`);
                    if (apiCheck.ok) {
                        appApiUrl = `${baseUrl}/gradio_api`;
                    }
                } catch (e) {
                    appApiUrl = baseUrl;
                }
            }

            // 3. Initialize Session
            this.sessions.set(sessionId, {
                sessionId,
                appReference,
                targetApiName: parsed.apiName,
                fnIndex: parsed.fnIndex,
                appApiUrl,
                inputs,
                outputs,
                translations: parsed.translations || {},
                values: new Array(inputs.length).fill(null),
                ephemeral: isEphemeral,
                options
            });

            // 4. Show First Modal
            await this.showModal(interaction, sessionId, 0);

        } catch (error: any) {
            Logger.error('Error in playground.init:', error);
            
            let errorReply;
            if (typeof this.customizers.error === 'function') {
                errorReply = this.customizers.error({ error, interaction });
            } else {
                errorReply = { 
                    embeds: [this.embedFactory.createErrorEmbed(error)],
                    flags: isEphemeral ? 64 : undefined
                };
            }

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(errorReply);
            } else {
                await interaction.reply(errorReply);
            }
        }
    }

    /**
     * Handles Modal Submissions
     */
    async handleSubmit(interaction: any): Promise<boolean> {
        const customId = interaction.customId;
        const decoded = IdManager.decodeModalId(customId);
        if (!decoded) return false;

        const { sessionId, pageIndex } = decoded;
        const session = this.sessions.get(sessionId);
        if (!session) return false;

        const pageSize = 5;
        const totalPages = Math.ceil(session.inputs.length / pageSize);
        const isLastPage = pageIndex + 1 >= totalPages;

        if (isLastPage) {
            await interaction.deferReply({ flags: session.ephemeral ? 64 : undefined });
        }

        // Extract values
        const submittedValues: any[] = [];
        for (let i = 0; i < session.inputs.length; i++) {
            const fieldId = IdManager.encodeFieldId(sessionId, i, session.inputs[i].type);
            const value = interaction.fields.getTextInputValue(fieldId);
            
            if (value !== undefined) {
                try {
                    submittedValues[i] = await this.validateAndTransform(session.inputs[i], value, session);
                } catch (error: any) {
                    let errorReply;
                    if (typeof this.customizers.error === 'function') {
                        errorReply = this.customizers.error({ error, session, interaction });
                    } else {
                        errorReply = { 
                            content: `⚠️ **Validation Error:** ${error.message}`, 
                            flags: session.ephemeral ? 64 : undefined 
                        };
                    }
                    
                    if (interaction.deferred || interaction.replied) {
                        await interaction.editReply(errorReply);
                    } else {
                        await interaction.reply(errorReply);
                    }
                    return true;
                }
            }
        }

        // Merge values
        submittedValues.forEach((val, idx) => {
            if (val !== undefined) session.values[idx] = val;
        });

        if (!isLastPage) {
            let customData: any = {};
            if (typeof this.customizers.pageConfirmation === 'function') {
                customData = this.customizers.pageConfirmation({ session, interaction, pageIndex, totalPages }) || {};
            }

            const isEphemeral = session.ephemeral;
            const replyOptions: any = {
                flags: isEphemeral ? 64 : undefined
            };

            if (customData.content || customData.embeds) {
                replyOptions.content = customData.content;
                replyOptions.embeds = customData.embeds;
            } else {
                replyOptions.content = `Page ${pageIndex + 1} completed. Click below to continue.`;
            }

            const nextButtonId = `dg_next_${sessionId}_${pageIndex + 1}`;
            replyOptions.components = [
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            style: customData.button?.style || ButtonStyle.Primary,
                            label: customData.button?.label || 'Continue',
                            emoji: customData.button?.emoji || '👉',
                            custom_id: nextButtonId
                        }
                    ]
                }
            ];

            await interaction.reply(replyOptions);
        } else {
            // Final page
            let loadingReply;
            if (typeof this.customizers.loading === 'function') {
                loadingReply = this.customizers.loading({ session, interaction });
            } else {
                loadingReply = { embeds: [this.embedFactory.createLoadingEmbed(session.appReference)] };
            }
            await interaction.editReply(loadingReply);

            try {
                const result = await this.execute(sessionId);
                let replyData;

                if (session.options?.formatReply) {
                    replyData = session.options.formatReply(result);
                } else if (typeof this.customizers.result === 'function') {
                    replyData = this.customizers.result({ result, session, interaction });
                } else {
                    const embed = this.embedFactory.createResultEmbed(result, session.appReference);
                    replyData = {
                        embeds: [embed],
                        files: result.data.files.map((f: any) => ({
                            attachment: f.buffer || f.url,
                            name: f.filename
                        }))
                    };
                }

                await interaction.editReply(replyData);
                this.sessions.delete(sessionId);

            } catch (error: any) {
                Logger.error('Error during Gradio execution:', error);
                let errorReply;
                if (typeof this.customizers.error === 'function') {
                    errorReply = this.customizers.error({ error, session, interaction });
                } else {
                    errorReply = { embeds: [this.embedFactory.createErrorEmbed(error)] };
                }
                await interaction.editReply(errorReply);
            }
        }
        return true;
    }

    /**
     * Handles Button Interactions
     */
    async handleButton(interaction: any): Promise<boolean> {
        const customId = interaction.customId;
        if (!customId || !customId.startsWith('dg_next_')) return false;

        const parts = customId.split('_');
        const sessionId = parts[2];
        const pageIndex = parseInt(parts[3], 10);

        try {
            await this.showModal(interaction, sessionId, pageIndex);
            return true;
        } catch (error: any) {
            Logger.error('Error handling button click:', error);
            const session = this.sessions.get(sessionId);
            let errorReply = { 
                content: 'Failed to open next page.', 
                flags: session?.ephemeral ? 64 : undefined 
            };
            await interaction.reply(errorReply);
            return true;
        }
    }

    /**
     * Show a Modal for a specific page
     */
    private async showModal(interaction: any, sessionId: string, pageIndex: number) {
        const session = this.sessions.get(sessionId);
        if (!session) throw new GradioPlaygroundError(ErrorCodes.SESSION_NOT_FOUND, 'Session expired or not found.');

        const pageSize = 5;
        const inputs = session.inputs;
        const totalPages = Math.ceil(inputs.length / pageSize);
        const pagedInputs = inputs.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

        const modalId = IdManager.encodeModalId(sessionId, pageIndex);
        const components = pagedInputs.map(input => ComponentMapper.mapComponent(input, session, this.customizers, interaction));

        let modalData = {
            title: `${session.appReference.split('/').pop()} (Page ${pageIndex + 1}/${totalPages})`,
            custom_id: modalId,
            components: components
        };

        if (typeof this.customizers.formatModal === 'function') {
            const customModal = this.customizers.formatModal(modalData, session, pageIndex);
            if (customModal) modalData = customModal;
        }

        // Use raw Discord API to bypass discord.js limitation (Modal must be first response)
        const response = await fetch(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 9, // InteractionCallbackType.MODAL
                data: modalData
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new GradioPlaygroundError(ErrorCodes.DISCORD_API_ERROR, `Discord API Error: ${response.status} ${errorText}`);
        }
    }

    /**
     * Execute Gradio API call
     */
    private async execute(sessionId: string): Promise<any> {
        const session = this.sessions.get(sessionId);
        if (!session) throw new GradioPlaygroundError(ErrorCodes.SESSION_NOT_FOUND, 'Session not found.');

        const { appApiUrl, fnIndex, values } = session;

        try {
            const client = await GradioClient.connect(appApiUrl);
            const submission = client.submit(fnIndex, values as any);

            const outputData: any[] = [];
            for await (const event of submission) {
                if (event.type === 'data') {
                    outputData.push(...(event.data as any[]));
                }
            }

            // Extract text and files
            let textResult = '';
            const filesToUpload: any[] = [];

            for (const item of outputData) {
                if (typeof item === 'string') {
                    textResult += item + '\n';
                } else if (item && typeof item === 'object' && item.url) {
                    const buffer = await this.download(item.url);
                    filesToUpload.push({
                        buffer,
                        filename: item.orig_name || 'output.png',
                        url: item.url
                    });
                }
            }

            return {
                success: true,
                data: {
                    text: textResult.trim(),
                    files: filesToUpload,
                    raw: outputData
                }
            };

        } catch (error: any) {
            throw new GradioPlaygroundError(ErrorCodes.INFERENCE_FAILED, error.message);
        }
    }

    private async validateAndTransform(component: GradioComponent, value: string, session: GradioSession): Promise<any> {
        if (!value && component.type !== 'checkbox') return component.value;

        switch (component.type) {
            case 'number':
            case 'slider':
                const num = parseFloat(value);
                if (isNaN(num)) throw new Error(`${component.label} must be a number.`);
                if (component.props.minimum !== undefined && num < component.props.minimum) throw new Error(`${component.label} min value is ${component.props.minimum}`);
                if (component.props.maximum !== undefined && num > component.props.maximum) throw new Error(`${component.label} max value is ${component.props.maximum}`);
                return num;

            case 'checkbox':
                return value.toLowerCase() === 'y' || value.toLowerCase() === 'yes';

            case 'image':
            case 'file':
            case 'audio':
            case 'video':
                // Auto-upload if it's a URL
                if (value.startsWith('http')) {
                    const buffer = await this.download(value);
                    const filename = value.split('/').pop() || 'file.tmp';
                    return await this.upload(session.appReference, buffer, filename);
                }
                return value;

            default:
                return value;
        }
    }

    async download(url: string): Promise<Buffer> {
        const res = await fetch(url);
        if (!res.ok) throw new GradioPlaygroundError(ErrorCodes.FILE_DOWNLOAD_FAILED, `Download failed: ${res.statusText}`);
        const ab = await res.arrayBuffer();
        return Buffer.from(ab);
    }

    async upload(appReference: string, fileBuffer: Buffer, filename: string = 'file.tmp'): Promise<any> {
        const baseUrl = ConfigParser.normalizeUrl(appReference);
        const appApiUrl = `${baseUrl}/gradio_api`;
        
        const formData = new FormData();
        const blob = new Blob([new Uint8Array(fileBuffer)]);
        formData.append('files', blob, filename);

        const res = await fetch(`${appApiUrl}/upload`, {
            method: 'POST',
            body: formData,
            headers: { "x-gradio-user": "app" }
        });

        if (!res.ok) throw new GradioPlaygroundError(ErrorCodes.FILE_UPLOAD_FAILED, `Upload failed: ${res.statusText}`);
        const data: any = await res.json();
        return Array.isArray(data) ? data[0] : data;
    }
}
