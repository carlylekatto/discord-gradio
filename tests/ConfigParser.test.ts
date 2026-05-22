import { describe, it, expect } from 'vitest';
import { ConfigParser } from '../src/utils/ConfigParser';

describe('ConfigParser', () => {
    describe('normalizeUrl', () => {
        it('should return empty string if input is empty', () => {
            expect(ConfigParser.normalizeUrl('')).toBe('');
        });

        it('should keep full http/https URLs intact but trim trailing slashes', () => {
            expect(ConfigParser.normalizeUrl('https://example.com/')).toBe('https://example.com');
            expect(ConfigParser.normalizeUrl('http://localhost:7860/')).toBe('http://localhost:7860');
        });

        it('should resolve short subdomains correctly', () => {
            expect(ConfigParser.normalizeUrl('my-app.gradio.live')).toBe('https://my-app.gradio.live');
            expect(ConfigParser.normalizeUrl('my-app.hf.space')).toBe('https://my-app.hf.space');
        });

        it('should resolve Hugging Face App IDs correctly', () => {
            expect(ConfigParser.normalizeUrl('black-forest-labs/FLUX.1-schnell')).toBe(
                'https://black-forest-labs-flux-1-schnell.hf.space'
            );
            expect(ConfigParser.normalizeUrl('user/some_app_name')).toBe(
                'https://user-some-app-name.hf.space'
            );
        });

        it('should default to https for raw domains', () => {
            expect(ConfigParser.normalizeUrl('google.com')).toBe('https://google.com');
        });
    });

    describe('findMainEndpoint', () => {
        it('should return null if dependencies are empty', () => {
            expect(ConfigParser.findMainEndpoint([])).toBeNull();
        });

        it('should select candidate with the most inputs', () => {
            const deps = [
                { id: 0, inputs: [1] },
                { id: 1, inputs: [1, 2, 3] },
                { id: 2, inputs: [1, 2] }
            ];
            expect(ConfigParser.findMainEndpoint(deps)).toEqual(deps[1]);
        });

        it('should fall back to the first item if no candidates have inputs', () => {
            const deps = [
                { id: 0, inputs: [] },
                { id: 1, inputs: [] }
            ];
            expect(ConfigParser.findMainEndpoint(deps)).toEqual(deps[0]);
        });
    });
});
