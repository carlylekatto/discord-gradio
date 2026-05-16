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

    constructor(options: { customizers?: Customizers, logLevel?: any } = {}) {
        this.sessions = new Map();
        this.embedFactory = EmbedFactory;
        this.customizers = options.customizers || {};
        
        if (options.logLevel !== undefined) {
            Logger.setLevel(options.logLevel);
        }
    }

    /**
     * Get the standard customId for the bridge button that opens the first modal page.
     * Use this if you want to build your own custom bridge message.
     */
    getOpenModalId(interaction: any, pageIndex: number = 0): string {
        return `dg_open_modal_${interaction.id}_${pageIndex}`;
    }

    /**
     * Handles the /gradio run command flow
     * @param {Object} interaction - The Discord CommandInteraction
     * @param {string} appReference - App reference (Space ID, URL, or shared link)
     * @param {string} [targetApiName] - Optional API endpoint name. If missing, auto-detects main endpoint.
     * @param {Object} [options={}] - Additional options
     * @param {boolean} [options.ephemeral=true] - Whether initial replies should be ephemeral
     * @param {string} [options.language='en'] - The language code for i18n translations
     * @param {boolean} [options.manualBridge=false] - If true and interaction is deferred, library won't auto-send the bridge button.
     */
    async init(interaction: any, appReference: string, targetApiName: string | null = null, options: any = {}) {
        const sessionId = interaction.id;
        const isEphemeral = options.ephemeral !== false; 
        const language = options.language || 'en';

        try {
            // Smart Defer: If not already handled, defer now to protect against config fetch timeouts.
            // This will trigger the "Bridge Button" flow later in this method.
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ flags: isEphemeral ? 64 : undefined });
            }

            // 1. Fetch Config
            const baseUrl = ConfigParser.normalizeUrl(appReference);
            const config = await ConfigParser.fetchConfig(baseUrl);
            
            // 2. Parse Config
            const parsed = ConfigParser.parse(config, targetApiName, language);
            const { inputs, outputs } = parsed;

            // Detect API standard
            const appApiUrl = await this.detectAppApiUrl(baseUrl, config);

            // 3. Initialize Session
            this.sessions.set(sessionId, {
                sessionId,
                appReference,
                targetApiName: parsed.apiName,
                fnIndex: parsed.fnIndex,
                appApiUrl,
                baseUrl,
                inputs,
                outputs,
                translations: parsed.translations || {},
                values: inputs.reduce((acc, input) => {
                    const val = input.props?.value;
                    if (val !== undefined) acc[input.index] = val;
                    else if (input.type === 'slider' || input.type === 'number') acc[input.index] = input.props?.minimum ?? 0;
                    else if (input.type === 'checkbox') acc[input.index] = false;
                    else if (input.type === 'textbox') acc[input.index] = "";
                    return acc;
                }, {} as Record<number, any>),
                ephemeral: isEphemeral,
                options
            });

            // 4. Handle Modal Display
            if (interaction.deferred || interaction.replied) {
                // If developer wants to handle the bridge message manually, we stop here.
                if (options.manualBridge === true) {
                    return;
                }

                // If already deferred/replied, we show a default "Bridge Button"
                const bridgeButtonId = this.getOpenModalId(interaction, 0);
                const replyOptions: any = {
                    content: `✨ **${parsed.apiName || 'Gradio App'}** is ready!`,
                    components: [
                        {
                            type: 1,
                            components: [
                                {
                                    type: 2,
                                    style: 1, // Primary
                                    label: 'Open Form',
                                    emoji: { name: '⌨️' },
                                    custom_id: bridgeButtonId
                                }
                            ]
                        }
                    ]
                };

                if (interaction.replied || interaction.deferred) {
                    await interaction.editReply(replyOptions);
                } else {
                    await interaction.reply({ ...replyOptions, flags: isEphemeral ? 64 : undefined });
                }
            } else {
                // Try to show modal directly
                await this.showModal(interaction, sessionId, 0);
            }

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

        // Smart Defer: Only defer if the developer hasn't already done so
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: session.ephemeral ? 64 : undefined });
        }

        // Extract values
        for (let i = 0; i < session.inputs.length; i++) {
            const input = session.inputs[i];
            const type = input.type;
            const index = input.index; // Use the actual Gradio component index
            const fieldId = IdManager.encodeFieldId(sessionId, index, type);
            
            let value: any;
            try {
                // Try standard text input first
                value = interaction.fields.getTextInputValue(fieldId);
            } catch (e) {
                // Try to find components in various possible locations
                const rawData = (interaction as any).components || (interaction as any).data?.components;
                
                if (rawData) {
                    for (const rootComp of rawData) {
                        const getCustomId = (c: any) => c?.customId || c?.custom_id;
                        
                        const extractValue = (c: any) => {
                            const attachments = c.attachments || [];
                            const getUrl = (a: any) => a.attachment || a.proxy_url || a.proxyURL || a.url;
                            
                            let val = c.value || c.values || c.attachment_id;
                            
                            // If it's a Type 19 (FileUpload) or has attachments, resolve to URLs
                            if (c.type === 19 || attachments.length > 0) {
                                // 1. Try to find URL in local attachments first
                                const urls = attachments.map((a: any) => getUrl(a)).filter((u: any) => !!u);
                                
                                // 2. If no local attachments, try to resolve IDs using interaction.data.resolved
                                if (urls.length === 0) {
                                    const ids = Array.isArray(val) ? val : (val ? [val] : []);
                                    for (const id of ids) {
                                        const resolved = (interaction as any).data?.resolved?.attachments?.[id] || 
                                                       (interaction as any).attachments?.get(id);
                                        if (resolved) {
                                            const u = getUrl(resolved);
                                            if (u) urls.push(u);
                                        }
                                    }
                                }
                                
                                if (urls.length > 0) {
                                    // For single-file components, return the first URL
                                    if (['image', 'file', 'audio', 'video'].includes(input.type)) return urls[0];
                                    return urls;
                                }
                            }
                            return val;
                        };

                        if (getCustomId(rootComp) === fieldId) {
                            value = extractValue(rootComp);
                            break;
                        }

                        if (rootComp.type === 1 && rootComp.components) {
                            const found = rootComp.components.find((c: any) => getCustomId(c) === fieldId);
                            if (found) {
                                value = extractValue(found);
                                break;
                            }
                        }

                        if (rootComp.type === 18 && rootComp.component) {
                            const inner = rootComp.component;
                            if (getCustomId(inner) === fieldId) {
                                value = extractValue(inner);
                                break;
                            }
                        }
                    }
                }
            }
            
            if (value !== undefined) {
                try {
                    const transformed = await this.validateAndTransform(session.inputs[i], value, session);
                    session.values[index] = transformed;
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
                // Default Summary Embed
                const pageSize = 5; // DISCORD_MODAL_PAGE_SIZE
                const currentPageInputs = session.inputs.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
                
                const summaryFields = currentPageInputs.map(input => {
                    let val = session.values[input.index];
                    let displayVal = val;
                    
                    if (val === null || val === undefined || val === '') displayVal = '*Empty*';
                    else if (typeof val === 'object' && val.path) displayVal = `📁 ${val.orig_name || val.path.split('/').pop()}`;
                    else if (typeof val === 'boolean') displayVal = val ? '✅ Yes' : '❌ No';
                    else displayVal = val.toString();

                    return {
                        name: input.label || input.type,
                        value: displayVal.length > 100 ? displayVal.substring(0, 97) + '...' : displayVal,
                        inline: true
                    };
                });

                replyOptions.embeds = [{
                    title: `✅ Page ${pageIndex + 1} Saved`,
                    description: `You've completed step ${pageIndex + 1} of ${totalPages}. Review your inputs below:`,
                    fields: summaryFields,
                    color: 0x2ecc71 // Success Green
                }];
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

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(replyOptions);
            } else {
                await interaction.reply(replyOptions);
            }
        } else {
            // Final page
            let loadingReply;
            if (typeof this.customizers.loading === 'function') {
                loadingReply = this.customizers.loading({ session, interaction });
            } else {
                loadingReply = { embeds: [this.embedFactory.createLoadingEmbed(session.appReference)] };
            }

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(loadingReply);
            } else {
                await interaction.reply(loadingReply);
            }

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
        if (!customId || (!customId.startsWith('dg_next_') && !customId.startsWith('dg_open_modal_'))) return false;

        let sessionId: string;
        let pageIndex: number;

        const parts = customId.split('_');
        if (customId.startsWith('dg_next_')) {
            // dg_next_sessionId_pageIndex
            sessionId = parts[2];
            pageIndex = parseInt(parts[3], 10);
        } else {
            // dg_open_modal_sessionId_pageIndex
            sessionId = parts[3];
            pageIndex = parseInt(parts[4], 10);
        }

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

        let modalData: any = {
            title: `${session.appReference.split('/').pop()} (Page ${pageIndex + 1}/${totalPages})`,
            custom_id: modalId,
            components: components
        };

        // Allow developer to customize the full modal data
        if (typeof this.customizers.formatModal === 'function') {
            const customModal = this.customizers.formatModal(modalData, session, pageIndex);
            if (customModal) {
                modalData = customModal;
            }
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
     * Detect the correct API URL for the Gradio app (Modern V4+ vs Legacy)
     */
    private async detectAppApiUrl(baseUrl: string, config: any): Promise<string> {
        if (config.api_prefix) {
            let prefix = config.api_prefix;
            if (!prefix.startsWith('/')) prefix = '/' + prefix;
            return `${baseUrl}${prefix}`;
        }

        try {
            const apiCheck = await fetch(`${baseUrl}/gradio_api/info`);
            if (apiCheck.ok) return `${baseUrl}/gradio_api`;
        } catch (e) {}

        return baseUrl;
    }

    /**
     * Execute Gradio API call using SSE Queue (Proven logic from katto-messenger)
     */
    private async execute(sessionId: string): Promise<any> {
        const session = this.sessions.get(sessionId);
        if (!session) throw new GradioPlaygroundError(ErrorCodes.SESSION_NOT_FOUND, 'Session not found.');

        const { fnIndex, values, baseUrl, targetApiName, appApiUrl } = session;
        const sessionHash = Math.random().toString(36).substring(2);

        // 3. Prepare data for Gradio
        const data = session.inputs.map(input => {
            const val = session.values[input.index];
            if (val !== undefined && val !== null) return val;
            
            // Fallbacks for missing values
            if (input.type === 'slider' || input.type === 'number') return input.props?.minimum ?? 0;
            if (input.type === 'checkbox') return false;
            if (input.type === 'textbox') return "";
            return null;
        });

        Logger.debug(`[${sessionId}] Gradio Payload:`, JSON.stringify(data, null, 2));

        try {
            Logger.info(`[${sessionId}] Connecting to Gradio: ${baseUrl}...`);
            // 1. Join the queue
            const payload = {
                fn_index: fnIndex,
                session_hash: sessionHash,
                data: data
            };

            const joinRes = await fetch(`${appApiUrl}/queue/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!joinRes.ok) {
                const errorText = await joinRes.text();
                throw new Error(`Queue join failed: ${joinRes.status} ${errorText}`);
            }

            // 2. Listen to the queue stream
            return new Promise(async (resolve, reject) => {
                try {
                    const dataRes = await fetch(`${appApiUrl}/queue/data?session_hash=${sessionHash}`);
                    if (!dataRes.ok || !dataRes.body) {
                        return reject(new Error('Failed to connect to queue stream'));
                    }

                    const reader = dataRes.body.getReader();
                    const decoder = new TextDecoder('utf-8');
                    let buffer = '';

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const jsonStr = line.substring(6).trim();
                                if (!jsonStr || jsonStr === '[DONE]') continue;

                                try {
                                    const msg = JSON.parse(jsonStr);
                                    
                                    if (msg.msg === 'process_completed') {
                                        if (!msg.success) {
                                            return reject(new Error('Process failed: ' + JSON.stringify(msg.output)));
                                        }
                                        
                                        // Success! Format the output
                                        const outputData = msg.output.data;
                                        let textResult = '';
                                        const filesToUpload: any[] = [];

                                        for (const item of outputData) {
                                            if (typeof item === 'string') {
                                                textResult += item + '\n';
                                            } else if (item && typeof item === 'object' && (item.url || item.path)) {
                                                const fileUrl = item.url || `${baseUrl}/file=${item.path}`;
                                                const buffer = await this.download(fileUrl);
                                                filesToUpload.push({
                                                    buffer,
                                                    filename: item.orig_name || 'output.png',
                                                    url: fileUrl
                                                });
                                            }
                                        }

                                        resolve({
                                            success: true,
                                            data: {
                                                text: textResult.trim(),
                                                files: filesToUpload,
                                                raw: outputData
                                            }
                                        });
                                        return;
                                    } else if (msg.msg === 'server_error') {
                                        return reject(new Error(`Server error: ${msg.error}`));
                                    }
                                } catch (e) {
                                    // Skip parse errors
                                }
                            }
                        }
                    }
                } catch (err) {
                    reject(err);
                }
            });

        } catch (error: any) {
            Logger.error(`[${sessionId}] Inference error:`, error);
            throw new GradioPlaygroundError(ErrorCodes.INFERENCE_FAILED, error.message || 'An error occurred');
        }
    }

    private async validateAndTransform(component: GradioComponent, value: string, session: GradioSession): Promise<any> {
        if (!value && component.type !== 'checkbox') return component.value;

        switch (component.type) {
            case 'number':
            case 'slider':
                const num = typeof value === 'string' ? parseFloat(value) : value;
                if (typeof num !== 'number' || isNaN(num)) return num;
                
                if (component.props?.minimum !== undefined && num < component.props.minimum) {
                    Logger.warn(`Value ${num} is less than minimum ${component.props.minimum} for ${component.label}`);
                }
                if (component.props?.maximum !== undefined && num > component.props.maximum) {
                    Logger.warn(`Value ${num} is greater than maximum ${component.props.maximum} for ${component.label}`);
                }
                return num;

            case 'checkbox':
                if (typeof value === 'boolean') return value;
                if (typeof value === 'string') return value.toLowerCase() === 'y' || value.toLowerCase() === 'yes' || value.toLowerCase() === 'true';
                return !!value;

            case 'image':
            case 'file':
            case 'audio':
            case 'video':
                // Auto-upload if it's a URL string
                if (typeof value === 'string' && value.startsWith('http')) {
                    const buffer = await this.download(value);
                    // Extract clean filename (strip query params)
                    let filename = value.split('/').pop() || 'file.tmp';
                    if (filename.includes('?')) {
                        filename = filename.split('?')[0];
                    }
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
        const path = Array.isArray(data) ? data[0] : data;
        
        return {
            path,
            orig_name: filename,
            meta: { _type: 'gradio.FileData' }
        };
    }
}
