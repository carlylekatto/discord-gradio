import { ComponentType, TextInputStyle } from 'discord.js';
import { IdManager } from '../utils/IdManager';
import { GradioComponent, GradioSession, Customizers } from '../types';

export class ComponentMapper {
    /**
     * Map a Gradio component to a Discord component structure (Raw JSON)
     * Following the 2026 Discord Modal Standard:
     * - Label (18) is a root component that takes a SINGLE child via the 'component' property.
     */
    static mapComponent(component: GradioComponent, session: GradioSession, customizers: Customizers = {}, interaction?: any): any {
        const { type, index, props } = component;
        const translations = session.translations || {};

        const rawLabel = props.label || props.info || props.name || type || '';
        let label = this._formatText(rawLabel, translations);
        
        // Beautify if it's a technical name (no spaces, all lowercase)
        if (label && !label.includes(' ') && label === label.toLowerCase()) {
            label = label.charAt(0).toUpperCase() + label.slice(1).replace(/[_-]/g, ' ');
        }

        if (!label) label = `Input ${index}`;

        if (label.length > 45) {
            label = label.substring(0, 42) + '...';
        }

        const customId = IdManager.encodeFieldId(session.sessionId, index, type);

        // 2026 Standard for Modals:
        // Root components can be Type 1 (ActionRow), 10 (Section/TextDisplay), or 18 (Label).
        // Label (18) is the preferred container for single interactive components.
        switch (type) {
            case 'textbox':
            case 'number':
            case 'slider':
                return {
                    type: 18, // Label Container
                    label: label,
                    component: {
                        type: ComponentType.TextInput, // Type 4
                        custom_id: customId,
                        style: TextInputStyle.Short,
                        placeholder: this._formatText(props.placeholder || '', translations) || `Enter ${label}`,
                        value: props.value?.toString() || '',
                        required: false
                    }
                };

            case 'image':
            case 'file':
            case 'audio':
            case 'video':
                return {
                    type: 18, // Label Container
                    label: label,
                    component: {
                        type: ComponentType.FileUpload, // Type 19
                        custom_id: customId,
                        required: false
                    }
                };

            case 'checkbox':
                return {
                    type: 18, // Label Container
                    label: label,
                    component: {
                        type: ComponentType.Checkbox, // Type 23
                        custom_id: customId,
                        value: props.value ? true : false,
                        required: false
                    }
                };

            case 'dropdown':
            case 'radio':
            case 'checkboxgroup':
                const isMulti = type === 'checkboxgroup';
                return {
                    type: 18, // Label Container
                    label: label,
                    component: {
                        type: isMulti ? ComponentType.CheckboxGroup : ComponentType.RadioGroup,
                        custom_id: customId,
                        options: Array.isArray(props.choices) ? props.choices.map((c: any) => {
                            const choiceLabel = Array.isArray(c) ? c[0] : c;
                            const choiceValue = Array.isArray(c) ? c[1] : c;
                            return {
                                label: choiceLabel.toString().substring(0, 100),
                                value: choiceValue.toString().substring(0, 100),
                                default: props.value === choiceValue
                            };
                        }) : [],
                        required: false
                    }
                };

            default:
                return {
                    type: 18,
                    label: label,
                    component: {
                        type: ComponentType.TextInput,
                        custom_id: customId,
                        style: TextInputStyle.Short,
                        required: false
                    }
                };
        }
    }

    private static _formatText(text: string, translations: Record<string, string>): string {
        if (!text) return '';
        let targetKey = text;
        if (typeof text === 'string' && text.startsWith('__i18n__')) {
            try {
                const jsonStr = text.replace('__i18n__', '');
                const parsed = JSON.parse(jsonStr);
                if (parsed.key) targetKey = parsed.key;
            } catch (e) {}
        }
        return translations[targetKey] || targetKey;
    }
}
