export class I18n {
    static formatText(text: string, translations: Record<string, string>): string {
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
