import { DataType } from "./datatype";
import { Accessor } from './accessor';
import getRegistry from "./registry";
import { Key } from './types';

export interface Config {
    [prop : string] : any
    type: DataType
}

// Other types
export interface FieldConfig extends Config {
}

// type == REFERENCE
export interface ReferenceConfig extends Config {
    recordset: RecordsetConfig | string
}

// type == FIELDSSET
export interface FieldSetConfig extends Config {
    fields : { [ prop: string ] : FieldConfig | FieldSetConfig }
}

// type === RECORDSET
export interface RecordsetConfig extends Config {
    value : FieldConfig
}

// type === RECORDSET
export interface ArrayConfig extends Config {
    value : FieldConfig
}

export class Guards {
    static isRecordsetConfig(config: Config) : config is RecordsetConfig {
        return config.type === DataType.RECORDSET;
    }

    static isFieldSetConfig(config: Config) : config is FieldSetConfig {
        return config.type === DataType.FIELDSET;
    }

    static isReferenceConfig(config: Config) : config is ReferenceConfig {
        return config.type === DataType.REFERENCE;
    }

    static isRecordConfig(config: Config) : config is RecordsetConfig {
        return config.type === DataType.RECORD;
    }    

    static isArrayConfig(config: Config) : config is ArrayConfig {
        return config.type === DataType.ARRAY;
    }    
}


export function getConfig(config? : Config, ...key : Key) : Config | undefined {
    if (key.length > 0) {
        const [ head, ...tail ] = key;
        if (!config) {
            if (typeof head === 'string')
                config = { type: DataType.FIELDSET, fields: {} }
            else if (typeof head === 'number')
                config = { type: DataType.ARRAY }
            else 
                config = { type: DataType.RECORDSET }
        }
        let result;
        if (Guards.isRecordsetConfig(config) || Guards.isArrayConfig(config))
            result = getConfig(config.value, ...tail);
        else if (Guards.isRecordConfig(config))
            result = getConfig(config.value, ...tail);
        else if (Guards.isFieldSetConfig(config))
            result = getConfig(config.fields[head], ...tail);
        else if (Guards.isReferenceConfig(config)) {
            if (typeof config.recordset === 'string')
                result = getRegistry(Accessor).resolve(config.recordset).getConfig(0,...key);
            else
                result = getConfig(config.recordset, ...key);
        } else {
            throw new TypeError('')
        }
        return result;
    } else {
        return config;
    }
}
