import { State, Guards } from './state';
import { Config } from './config';
import { DateTime } from 'luxon';

export enum DataType {
    RECORD = "RECORD",
    RECORDSET = "RECORDSET",
    FIELDSET = "FIELDSET",
    ARRAY = "ARRAY",
    NUMBER = "NUMBER",
    STRING = "STRING",
    DATETIME = "DATETIME",
    REFERENCE = "REFERENCE",
    REFERENCED_BY = "REFERENCED_BY"
}

/** Find the type of some state
 * 
 * Note: may not be completely conclusive if config is not provided.
 * 
 */
export function getDataType(state?: State, config?: Config) : DataType {
    switch (config?.type) {
        case DataType.RECORDSET:
            if (!Guards.isIRecordset(state)) throw new TypeError(`State does not match configured type ${config.type}`)
            return config.type;
        case DataType.FIELDSET:
            if (Guards.isPrimitive(state)) throw new TypeError(`State does not match configured type ${config.type}`)
            return config.type;
        case DataType.RECORD:
            // Any state can be a record
            return config.type;
        case DataType.REFERENCE:
            if (!Guards.isReference(state)) throw new TypeError(`State does not match configured type ${config.type}`)
            return config.type;
        case DataType.REFERENCED_BY:
            //  There's actually no state linked to a REFERENCED_BY field, it is a 'virtual' array 
            return config.type;            
        case DataType.NUMBER:
            if (!Guards.isNumber(state)) throw new TypeError(`State does not match configured type ${config.type}`)
            return config.type;
        case DataType.STRING:
            if (!Guards.isString(state)) throw new TypeError(`State does not match configured type ${config.type}`)
            return config.type;
        case DataType.DATETIME:
            if (!Guards.isDateTime(state)) throw new TypeError(`State does not match configured type ${config.type}`)
            return config.type;
        case DataType.ARRAY:
            if (!Array.isArray(state)) throw new TypeError(`State does not match configured type ${config.type}`)
            return config.type;            
        case undefined:
            // no config, so figure out type as best we can
            switch (typeof state) {
                case 'number' : 
                        return DataType.NUMBER;
                case 'string' : 
                        return DataType.STRING;
                default:
                    if (DateTime.isDateTime(state))
                        return DataType.DATETIME;
                    else if (Array.isArray(state))
                        return DataType.ARRAY;
                    else if (Guards.isIRecordset(state))
                        return DataType.RECORDSET;
                    else if (Guards.isRichField(state))
                        return DataType.RECORD;
                    else
                        return DataType.FIELDSET;
            }
    }
}



