import { Config } from './config';
import { Key } from './types';

export enum ErrorCode {
    REFERENCE_BOUNDARY = "rur/REFERENCE_BOUNDARY",
    STATE_VALIDATION = "rur/STATE_VALIDATION",
    STATE_MANDATORY = "rur/STATE_MANDATORT",
}


// Exceptions may be included in redux state so are plain JS objects
export interface Exception {
    code : ErrorCode;
    message: string;
}

class RURError extends Error implements Exception {

    code : ErrorCode;

    constructor(code: ErrorCode, message: string) {
        super(message);
        this.code = code;
    }
}

export class ReferenceBoundary extends RURError {
    config : Config
    key: Key

    constructor(config : Config, ...key : Key) {
        super(ErrorCode.REFERENCE_BOUNDARY, `reference boundary for accessor ${config.recordset}, ${key.join('.')}`)
        this.config = config;
        this.key = key;
    }  
}
