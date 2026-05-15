import { 
    ActionRowBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ButtonBuilder, 
    ButtonStyle 
} from 'discord.js';
import { IdManager } from '../utils/IdManager';
import { GradioComponent, GradioSession, Customizers } from '../types';

export class ComponentMapper {
    /**
     * Map a Gradio component to a Discord component (wrapped in ActionRow)
     */
    static mapComponent(component: GradioComponent, session: GradioSession, customizers: Customizers = {}, interaction?: any) {
        const { type, index, props } = component;
        const translations = session.translations || {};

        // 1. Get Translated Label
        const rawLabel = props.label || '';
        let label = this._formatText(rawLabel, translations);
        if (!label) label = `Input ${index}`;

        // 2. Truncate label (Discord limit is 45 chars)
        let descriptionHint = '';
        if (label.length > 45) {
            descriptionHint = label;
            label = label.substring(0, 42) + '...';
        }

        // 3. Get Smart Description (Range, Step, Default)
        let description = descriptionHint;
        if (typeof customizers.inputDescription === 'function') {
            const customDesc = customizers.inputDescription({ component, props, type, session, interaction });
            if (customDesc) description = customDesc;
        } else {
            const hints = [];
            if (props.minimum !== undefined && props.maximum !== undefined) {
                hints.push(`Range: [${props.minimum}, ${props.maximum}]`);
            }
            if (props.step) hints.push(`Step: ${props.step}`);
            if (props.value !== undefined && props.value !== null && typeof props.value !== 'object') {
                hints.push(`Default: ${props.value}`);
            }
            
            if (hints.length > 0) {
                description = (description ? description + ' | ' : '') + hints.join(' | ');
            }
        }

        // 4. Map by Type
        const customId = IdManager.encodeFieldId(session.sessionId, index, type);

        switch (type) {
            case 'textbox':
            case 'number':
            case 'slider':
                return new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder()
                        .setCustomId(customId)
                        .setLabel(label)
                        .setPlaceholder(this._formatText(props.placeholder || '', translations) || (description.substring(0, 100)))
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setValue(props.value?.toString() || '')
                );

            case 'checkbox':
                // Discord Modals don't support checkboxes well, we use a Select Menu or Text (Y/N)
                return new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder()
                        .setCustomId(customId)
                        .setLabel(`${label} (Y/N)`)
                        .setPlaceholder('Enter Y for Yes, N for No')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setValue(props.value ? 'Y' : 'N')
                );

            case 'dropdown':
            case 'radio':
            case 'checkboxgroup':
                // Note: Modals ONLY support TextInput. 
                const choicesStr = Array.isArray(props.choices) 
                    ? props.choices.map((c: any) => Array.isArray(c) ? c[0] : c).join(', ')
                    : '';
                
                return new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder()
                        .setCustomId(customId)
                        .setLabel(label)
                        .setPlaceholder(choicesStr.substring(0, 100))
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                        .setValue(props.value?.toString() || '')
                );

            case 'image':
            case 'file':
            case 'audio':
            case 'video':
                return new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder()
                        .setCustomId(customId)
                        .setLabel(label)
                        .setPlaceholder('Paste a URL to your file/image')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                );

            default:
                // Fallback to simple text input
                return new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder()
                        .setCustomId(customId)
                        .setLabel(label)
                        .setPlaceholder(description.substring(0, 100) || 'Enter value')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                );
        }
    }

    /**
     * Helper to format i18n text and handle technical keys
     */
    private static _formatText(text: string, translations: Record<string, string>): string {
        if (!text) return '';
        
        let targetKey = text;

        // Handle Gradio's serialized i18n strings: __i18n__"{"key":"..."}"
        if (typeof text === 'string' && text.startsWith('__i18n__')) {
            try {
                const jsonStr = text.replace('__i18n__', '');
                const parsed = JSON.parse(jsonStr);
                if (parsed.key) targetKey = parsed.key;
            } catch (e) {}
        }

        // 1. Try Translation
        if (translations[targetKey]) {
            return translations[targetKey];
        }

        // 2. If it's a technical key (ends with _label), beautify it
        if (targetKey.endsWith('_label')) {
            return targetKey
                .replace(/_label$/, '')
                .split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        }

        return targetKey;
    }
}
