import { EmbedBuilder } from 'discord.js';
import { QueueStatus } from '../types';

export class EmbedFactory {
    static createLoadingEmbed(appReference: string, queue?: QueueStatus) {
        const embed = new EmbedBuilder()
            .setTitle('🚀 Processing...')
            .setDescription(`Executing request for **${appReference}**. This may take a moment.`)
            .setColor(0x0099FF)
            .setFooter({ text: 'Powered by Discord-Gradio' });

        if (queue) {
            const { position, size, estimatedTime } = queue;
            const fields = [];
            if (position !== undefined && position !== null) {
                const posText = position === 0 ? 'Next in line / Processing' : `${position}/${size || '?'}`;
                fields.push({ name: 'Queue Position', value: posText, inline: true });
            }
            if (estimatedTime !== undefined && estimatedTime !== null && estimatedTime > 0) {
                fields.push({ name: 'Estimated Wait', value: `${Math.round(estimatedTime)}s`, inline: true });
            }
            if (fields.length > 0) {
                embed.addFields(fields);
            }
        }

        return embed;
    }

    static createResultEmbed(result: any, appReference: string) {
        const embed = new EmbedBuilder()
            .setTitle('✅ Execution Successful')
            .setDescription(`Result from **${appReference}**`)
            .setColor(0x00FF00)
            .setTimestamp()
            .setFooter({ text: 'Powered by Discord-Gradio' });

        if (result.data && result.data.text) {
            const text = result.data.text.length > 4096 
                ? result.data.text.substring(0, 4093) + '...' 
                : result.data.text;
            embed.setDescription(text);
        }

        return embed;
    }

    static createErrorEmbed(error: any) {
        return new EmbedBuilder()
            .setTitle('❌ Execution Error')
            .setDescription(error.message || 'An unknown error occurred.')
            .setColor(0xFF0000)
            .addFields([{ name: 'Code', value: error.code || 'UNKNOWN', inline: true }])
            .setTimestamp();
    }
}
