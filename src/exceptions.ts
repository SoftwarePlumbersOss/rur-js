import { Config } from './config';
import { Key } from './accessor';

export class ReferenceBoundary extends Error {
    config : Config
    key: Key

    constructor(config : Config, ...key : Key) {
        super(`reference boundary for accessor ${config.recordset}, ${key.join('.')}`)
        this.config = config;
        this.key = key;
    }  
}
