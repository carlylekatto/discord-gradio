import { ComponentType, TextInputStyle } from 'discord.js';
import { IdManager } from '../utils/IdManager';
import { I18n } from '../utils/I18n';
import { Logger } from '../utils/Logger';
import { GradioComponent, GradioSession, Customizers } from '../types';

export class ComponentMapper {
    static mapComponent(component: GradioComponent, session: GradioSession, customizers: Customizers = {}, interaction?: any): any {
        const { type, index, props } = component;
        const translations = session.translations || {};

        // 1. Core Label
        const rawLabel = props.label || props.name || type || '';
        let label = I18n.formatText(rawLabel, translations);

        // Final Truncation (Discord Label Limit: 45)
        if (label.length > 45) {
            label = label.substring(0, 42) + '...';
        }

        if (!label) label = `Input ${index}`;

        const customId = IdManager.encodeFieldId(session.sessionId, index, type);

        // 2. Description (Instructions)
        let rawInfo = props.info || '';

        // Auto-append range for number/slider
        if (type === 'slider' || type === 'number') {
            const rangeInfo = [];
            if (props.minimum !== undefined && props.maximum !== undefined) {
                rangeInfo.push(`R: ${props.minimum}-${props.maximum}`);
            }
            if (props.step !== undefined) {
                rangeInfo.push(`S: ${props.step}`);
            }
            if (rangeInfo.length > 0) {
                const badge = `(${rangeInfo.join(', ')})`;
                if (rawInfo) {
                    const limit = 99 - badge.length;
                    if (rawInfo.length > limit) {
                        rawInfo = rawInfo.substring(0, limit - 3) + '...' + badge;
                    } else {
                        rawInfo = `${rawInfo} ${badge}`;
                    }
                } else {
                    rawInfo = badge;
                }
            }
        }

        const description = I18n.formatText(rawInfo, translations);

        // 3. Placeholder (Suggestions)
        let customDescription = undefined;
        if (typeof customizers.inputDescription === 'function') {
            customDescription = customizers.inputDescription({ session, component, interaction });
        }

        // Strictly separate: placeholder only takes placeholder or default prompt
        const placeholder = customDescription || I18n.formatText(props.placeholder || '', translations) || `Enter ${label}`;

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
                    ...(description ? { description: description.substring(0, 100) } : {}),
                    component: {
                        type: ComponentType.TextInput, // Type 4
                        custom_id: customId,
                        style: TextInputStyle.Short,
                        placeholder: placeholder.substring(0, 100),
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
                    ...(description ? { description: description.substring(0, 100) } : {}),
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
                    ...(description ? { description: description.substring(0, 100) } : {}),
                    component: {
                        type: ComponentType.Checkbox, // Type 23
                        custom_id: customId,
                        value: props.value ? true : false,
                        required: false
                    }
                };

            case 'dropdown': {
                const rawChoices = Array.isArray(props.choices) ? props.choices : [];
                if (rawChoices.length > 25) {
                    Logger.warn(`Dropdown component "${label}" has ${rawChoices.length} options, which exceeds Discord's limit of 25. Truncating to 25.`);
                }
                const choices = rawChoices.slice(0, 25);
                return {
                    type: 18, // Label Container
                    label: label,
                    ...(description ? { description: description.substring(0, 100) } : {}),
                    component: {
                        type: ComponentType.StringSelect,
                        custom_id: customId,
                        options: choices.map((c: any) => {
                            const choiceLabel = Array.isArray(c) ? c[0] : c;
                            const choiceValue = Array.isArray(c) ? c[1] : c;
                            return {
                                label: choiceLabel.toString().substring(0, 45),
                                value: choiceValue.toString().substring(0, 100),
                                default: props.value === choiceValue
                            };
                        }),
                        required: false
                    }
                };
            }

            case 'radio': {
                const rawChoices = Array.isArray(props.choices) ? props.choices : [];
                if (rawChoices.length > 10) {
                    Logger.warn(`Radio component "${label}" has ${rawChoices.length} options, which exceeds Discord's limit of 10. Truncating to 10.`);
                }
                const choices = rawChoices.slice(0, 10);
                return {
                    type: 18, // Label Container
                    label: label,
                    ...(description ? { description: description.substring(0, 100) } : {}),
                    component: {
                        type: ComponentType.RadioGroup,
                        custom_id: customId,
                        options: choices.map((c: any) => {
                            const choiceLabel = Array.isArray(c) ? c[0] : c;
                            const choiceValue = Array.isArray(c) ? c[1] : c;
                            return {
                                label: choiceLabel.toString().substring(0, 45),
                                value: choiceValue.toString().substring(0, 100),
                                default: props.value === choiceValue
                            };
                        }),
                        required: false
                    }
                };
            }

            case 'checkboxgroup': {
                const rawChoices = Array.isArray(props.choices) ? props.choices : [];
                if (rawChoices.length > 10) {
                    Logger.warn(`Checkbox Group component "${label}" has ${rawChoices.length} options, which exceeds Discord's limit of 10. Truncating to 10.`);
                }
                const choices = rawChoices.slice(0, 10);
                
                const isDefaultArray = Array.isArray(props.value);
                const hasDefault = (choiceVal: any) => {
                    if (isDefaultArray) return props.value.includes(choiceVal);
                    return props.value === choiceVal;
                };

                return {
                    type: 18, // Label Container
                    label: label,
                    ...(description ? { description: description.substring(0, 100) } : {}),
                    component: {
                        type: ComponentType.CheckboxGroup,
                        custom_id: customId,
                        options: choices.map((c: any) => {
                            const choiceLabel = Array.isArray(c) ? c[0] : c;
                            const choiceValue = Array.isArray(c) ? c[1] : c;
                            return {
                                label: choiceLabel.toString().substring(0, 45),
                                value: choiceValue.toString().substring(0, 100),
                                default: hasDefault(choiceValue)
                            };
                        }),
                        required: false
                    }
                };
            }

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
}
