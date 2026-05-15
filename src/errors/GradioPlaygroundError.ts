export enum ErrorCodes {
    INVALID_CONFIG = 'INVALID_CONFIG',
    CONFIG_FETCH_FAILED = 'CONFIG_FETCH_FAILED',
    API_NOT_FOUND = 'API_NOT_FOUND',
    SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
    DISCORD_API_ERROR = 'DISCORD_API_ERROR',
    FILE_UPLOAD_FAILED = 'FILE_UPLOAD_FAILED',
    FILE_DOWNLOAD_FAILED = 'FILE_DOWNLOAD_FAILED',
    INFERENCE_FAILED = 'INFERENCE_FAILED',
    VALIDATION_ERROR = 'VALIDATION_ERROR'
}

export class GradioPlaygroundError extends Error {
    public code: ErrorCodes;

    constructor(code: ErrorCodes, message: string) {
        super(message);
        this.name = 'GradioPlaygroundError';
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
