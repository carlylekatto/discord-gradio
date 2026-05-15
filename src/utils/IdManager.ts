export class IdManager {
    static FLAGS = {
        STRING: 0,
        NUMBER: 1 << 0,   // 1
        BOOLEAN: 1 << 1,  // 2
        FILE: 1 << 2,     // 4
        ARRAY: 1 << 3     // 8
    } as const;

    /**
     * Encode field ID: dg_[Session]_[IndexHex]_[FlagsHex]
     */
    static encodeFieldId(sessionId: string, index: number, type: string): string {
        let flag: number = this.FLAGS.STRING;
        if (type === 'number' || type === 'slider') flag = this.FLAGS.NUMBER;
        if (type === 'checkbox') flag = this.FLAGS.BOOLEAN;
        if (type === 'image' || type === 'file' || type === 'audio') flag = this.FLAGS.FILE;
        if (type === 'checkboxgroup' || type === 'array') flag = this.FLAGS.ARRAY;

        const hexIndex = index.toString(16).padStart(2, '0').toUpperCase();
        const hexFlag = flag.toString(16).toUpperCase();

        return `dg_${sessionId}_${hexIndex}_${hexFlag}`;
    }

    /**
     * Encode Modal ID: dg_m_[Session]_[Page]
     */
    static encodeModalId(sessionId: string, page: number): string {
        return `dg_m_${sessionId}_${page}`;
    }

    /**
     * Decode Modal ID
     */
    static decodeModalId(customId: string): { sessionId: string; pageIndex: number } | null {
        const p = customId.split('_');
        if (p[0] !== 'dg' || p[1] !== 'm') return null;
        
        // Session ID is everything between 'm' and the last part (page index)
        const pageIndex = parseInt(p[p.length - 1], 10);
        const sessionId = p.slice(2, p.length - 1).join('_');
        
        return { sessionId, pageIndex };
    }

    /**
     * Decode Field ID
     */
    static decodeFieldId(customId: string): { sessionId: string; gradioIndex: number; flags: number } | null {
        const p = customId.split('_');
        // Field IDs: dg_[session]_[index]_[flags]
        // Modal IDs: dg_m_[session]_[page]
        if (p[0] !== 'dg' || p[1] === 'm') return null;

        // The last two parts are always Index and Flags
        const flags = parseInt(p[p.length - 1], 16);
        const gradioIndex = parseInt(p[p.length - 2], 16);
        
        // Everything between 'dg' and 'index' is the session ID
        const sessionId = p.slice(1, p.length - 2).join('_');
        
        return {
            sessionId,
            gradioIndex,
            flags
        };
    }

    /**
     * Check if a flag is set
     */
    static hasFlag(flags: number, flag: number): boolean {
        return (flags & flag) === flag;
    }
}
