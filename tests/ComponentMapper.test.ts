import { describe, it, expect } from 'vitest';
import { ComponentType } from 'discord.js';
import { ComponentMapper } from '../src/mappings/ComponentMapper';

describe('ComponentMapper', () => {
    const mockSession: any = {
        sessionId: 'test_session',
        translations: {}
    };

    it('should map dropdown component to StringSelect', () => {
        const component: any = {
            type: 'dropdown',
            index: 0,
            props: {
                label: 'Test Dropdown',
                choices: ['a', 'b', 'c']
            }
        };

        const result = ComponentMapper.mapComponent(component, mockSession);
        expect(result.type).toBe(18); // Label
        expect(result.component.type).toBe(ComponentType.StringSelect);
        expect(result.component.options.length).toBe(3);
    });

    it('should truncate dropdown component options to 25', () => {
        const component: any = {
            type: 'dropdown',
            index: 1,
            props: {
                label: 'Large Dropdown',
                choices: Array.from({ length: 30 }, (_, i) => `choice_${i}`)
            }
        };

        const result = ComponentMapper.mapComponent(component, mockSession);
        expect(result.type).toBe(18);
        expect(result.component.type).toBe(ComponentType.StringSelect);
        expect(result.component.options.length).toBe(25);
    });

    it('should map radio component with choices to RadioGroup', () => {
        const component: any = {
            type: 'radio',
            index: 2,
            props: {
                label: 'Test Radio',
                choices: ['a', 'b', 'c']
            }
        };

        const result = ComponentMapper.mapComponent(component, mockSession);
        expect(result.type).toBe(18);
        expect(result.component.type).toBe(ComponentType.RadioGroup);
    });

    it('should truncate radio component options to 10', () => {
        const component: any = {
            type: 'radio',
            index: 3,
            props: {
                label: 'Large Radio',
                choices: Array.from({ length: 15 }, (_, i) => `choice_${i}`)
            }
        };

        const result = ComponentMapper.mapComponent(component, mockSession);
        expect(result.type).toBe(18);
        expect(result.component.type).toBe(ComponentType.RadioGroup);
        expect(result.component.options.length).toBe(10);
    });

    it('should map checkboxgroup component choices to CheckboxGroup', () => {
        const component: any = {
            type: 'checkboxgroup',
            index: 4,
            props: {
                label: 'Test Checkbox Group',
                choices: ['x', 'y']
            }
        };

        const result = ComponentMapper.mapComponent(component, mockSession);
        expect(result.type).toBe(18);
        expect(result.component.type).toBe(ComponentType.CheckboxGroup);
    });

    it('should truncate checkboxgroup component options to 10', () => {
        const component: any = {
            type: 'checkboxgroup',
            index: 5,
            props: {
                label: 'Large Checkbox Group',
                choices: Array.from({ length: 15 }, (_, i) => `choice_${i}`)
            }
        };

        const result = ComponentMapper.mapComponent(component, mockSession);
        expect(result.type).toBe(18);
        expect(result.component.type).toBe(ComponentType.CheckboxGroup);
        expect(result.component.options.length).toBe(10);
    });
});
