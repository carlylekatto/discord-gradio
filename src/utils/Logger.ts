export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4
}

export class Logger {
    private static level: LogLevel = LogLevel.INFO;

    /**
     * Set the global logging level
     */
    static setLevel(level: LogLevel | keyof typeof LogLevel) {
        if (typeof level === 'string') {
            this.level = LogLevel[level] as LogLevel;
        } else {
            this.level = level;
        }
    }

    static debug(message: string, ...args: any[]) {
        if (this.level <= LogLevel.DEBUG) {
            console.log(`\x1b[36m[DEBUG]\x1b[0m ${message}`, ...args);
        }
    }

    static info(message: string, ...args: any[]) {
        if (this.level <= LogLevel.INFO) {
            console.log(`\x1b[32m[INFO]\x1b[0m ${message}`, ...args);
        }
    }

    static warn(message: string, ...args: any[]) {
        if (this.level <= LogLevel.WARN) {
            console.warn(`\x1b[33m[WARN]\x1b[0m ${message}`, ...args);
        }
    }

    static error(message: string, ...args: any[]) {
        if (this.level <= LogLevel.ERROR) {
            console.error(`\x1b[31m[ERROR]\x1b[0m ${message}`, ...args);
        }
    }
}
