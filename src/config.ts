import { DataType } from "./datatype";
import { Accessor } from './accessor';
import getRegistry from "./registry";
import { Key } from './types';

/** Core configuration object.
 * 
 * A configuration object *must* have a type but otherwise can contain pretty much anything. Information in
 * the configuration object is exposed via the accessor, so it can be useful to park any and all configuration
 * within the Config tree.
 * 
 */
export interface Config {
    [prop : string] : any
    type: DataType
}

// Other types
export interface FieldConfig extends Config {
}

/** Configuration for a field with type === DataType.REFERENCE.
 * 
 * A reference field contains a link to a record in some other datasource. The value stored in the field is 
 * simply the 'key' in the foreign datasource.
 * 
 */
export interface ReferenceConfig extends Config {
    recordset: RecordsetConfig | string
}

/** Configuration for a field with type === DataType.REFERENCED_BY.
 * 
 * A 'referenced by' field provides a link to all the records in some other datasource which reference *this*
 * record (because they have a 'REFERENCE' field containing the key of *this* record)
 * 
 */
export interface ReferencedByConfig extends Config {
    /** the datasource which references this record */
    recordset: RecordsetConfig | string,
    /** the name of the reference field in the foreign datasource which references this record */
    field: string | string[]
}

/** Configuration for a field with type === DataType.FieldMapping.
 * 
 */
export interface FieldMappingConfig extends Config {
    fields : { [ prop: string ] : FieldConfig | FieldMappingConfig }
}

// type === RECORDSET
export interface RecordsetConfig extends Config {
    value : FieldConfig    
}
export interface DataSourceConfig extends RecordsetConfig {
    collection: { 
        driverName: string,
        collectionName: string
    }
}

// type === RECORDSET
export interface ArrayConfig extends Config {
    value : FieldConfig
}

export class Guards {
    static isRecordsetConfig(config: Config) : config is RecordsetConfig {
        return config.type === DataType.RECORDSET;
    }

    static isFieldSetConfig(config: Config) : config is FieldMappingConfig {
        return config.type === DataType.FIELD_MAPPING;
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
                config = { type: DataType.FIELD_MAPPING, fields: {} }
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
