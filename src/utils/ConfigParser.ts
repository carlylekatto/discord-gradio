import { GradioPlaygroundError, ErrorCodes } from '../errors/GradioPlaygroundError';
import { GradioComponent, ParsedConfig } from '../types';

export class ConfigParser {
    /**
     * Normalizes an app reference (App ID, URL, or shared link) to a base URL
     */
    static normalizeUrl(input: string): string {
        if (!input) return '';
        let url = input.trim();
        
        // 1. If it's already a full URL
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url.replace(/\/$/, '');
        }
        
        // 2. Handle shared links and direct app links
        if (url.endsWith('.gradio.live') || url.endsWith('.hf.space')) {
            return `https://${url}`;
        }
        
        // 3. Handle Hugging Face App IDs (user/app-name)
        if (url.includes('/') && !url.startsWith('http://') && !url.startsWith('https://')) {
            const parts = url.split('/');
            if (parts.length === 2) {
                const [user, appName] = parts;
                // Convert to the direct .hf.space subdomain which is more reliable for API
                return `https://${user.toLowerCase()}-${appName.toLowerCase().replace(/_/g, '-').replace(/\./g, '-')}.hf.space`;
            }
        }

        // 4. Default fallback
        if (url.includes('.')) {
            return `https://${url}`;
        }

        return url;
    }

    /**
     * Fetch Gradio config from URL
     */
    static async fetchConfig(baseUrl: string): Promise<any> {
        const endpoints = [
            `${baseUrl}/config`,
            `${baseUrl}/gradio_api/config`
        ];

        for (const url of endpoints) {
            try {
                const response = await fetch(url);
                if (response.ok) {
                    const config = await response.json();
                    if (config.components && config.dependencies) {
                        return config;
                    }
                }
            } catch (e) {
                // Try next endpoint
            }
        }

        throw new GradioPlaygroundError(ErrorCodes.INVALID_CONFIG, `Could not fetch Gradio config from ${baseUrl}. Make sure it is a valid Gradio App.`);
    }

    /**
     * Parse Gradio config JSON
     */
    static parse(config: any, targetApiName: string | null, language: string = 'en'): ParsedConfig {
        if (!config || !config.dependencies) {
            throw new GradioPlaygroundError(ErrorCodes.INVALID_CONFIG, 'Invalid Gradio config');
        }

        const deps = config.dependencies;
        let selectedDep = null;

        if (targetApiName) {
            selectedDep = deps.find((d: any) => d.api_name === targetApiName);
            if (!selectedDep) {
                selectedDep = this.findMainEndpoint(deps);
            }
        } else {
            selectedDep = this.findMainEndpoint(deps);
        }

        if (!selectedDep) {
            throw new GradioPlaygroundError(ErrorCodes.API_NOT_FOUND, 'Could not find a valid API endpoint for this app.');
        }

        const actualApiName = selectedDep.api_name || null;
        const fnIndex = selectedDep.id;

        const inputs: GradioComponent[] = selectedDep.inputs.map((idx: number) => {
            const comp = config.components.find((c: any) => c.id === idx);
            if (!comp) return null;
            return {
                index: idx,
                id: comp.id,
                type: comp.type,
                label: comp.props?.label || '',
                choices: comp.props?.choices || null,
                value: comp.props?.value,
                props: comp.props || {}
            };
        }).filter(Boolean);

        const outputs: GradioComponent[] = selectedDep.outputs.map((idx: number) => {
            const comp = config.components.find((c: any) => c.id === idx);
            if (!comp) return null;
            return {
                index: idx,
                id: comp.id,
                type: comp.type,
                label: comp.props?.label || '',
                choices: comp.props?.choices || null,
                value: comp.props?.value,
                props: comp.props || {}
            };
        }).filter(Boolean);

        const translations = config.i18n_translations ? (
            config.i18n_translations[language] || 
            config.i18n_translations.en || 
            config.i18n_translations[Object.keys(config.i18n_translations)[0]]
        ) : {};

        return {
            apiName: actualApiName,
            fnIndex,
            inputs,
            outputs,
            translations
        };
    }

    /**
     * Heuristic: find the endpoint with the most inputs
     */
    static findMainEndpoint(dependencies: any[]): any {
        if (!dependencies || dependencies.length === 0) return null;
        
        const candidates = dependencies.filter(d => d.inputs && d.inputs.length > 0);
        if (candidates.length === 0) return dependencies[0];

        return candidates.reduce((prev, current) => {
            return (prev.inputs.length > current.inputs.length) ? prev : current;
        });
    }
}
