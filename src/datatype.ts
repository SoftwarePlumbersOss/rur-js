import { State, Guards, IRecordset, IFieldSet, IRecord, IAtom, IMetadata, Primitive, IMetadataCarrier } from './state';
import { Config } from './config';
import { DateTime } from 'luxon';

export enum DataType {
    RECORD = "RECORD",
    RECORDSET = "RECORDSET",
    FIELDSET = "FIELDSET",
    NUMBER = "NUMBER",
    STRING = "STRING",
    DATETIME = "DATETIME",
    REFERENCE = "REFERENCE"
}

/** Find the type of some state
 * 
 * Note: may not be completely conclusive if config is not provided.
 * 
 */
export function getDataType(state: State, config?: Config) : DataType {
    switch (config?.type) {
        case DataType.RECORDSET:
            if (!Guards.isRecordset(state)) throw new TypeError(`State does not match configured type ${config.type}`)
            return config.type;
        case DataType.FIELDSET:
            if (!Guards.isFieldSet(state)) throw new TypeError(`State does not match configured type ${config.type}`)
            return config.type;
        case DataType.RECORD:
            if (!Guards.isRecord(state)) throw new TypeError(`State does not match configured type ${config.type}`)
            return config.type;
        case DataType.REFERENCE:
            if (!Guards.isReference(state)) throw new TypeError(`State does not match configured type ${config.type}`)
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
        case undefined:
            // no config, so figure out type as best we can
            switch (typeof state) {
                case 'number' : return DataType.NUMBER;
                case 'string' : 
                        return DataType.STRING;
                default:
                    if (DateTime.isDateTime(state))
                        return DataType.DATETIME;
                    else if (Guards.isRecordset(state))
                        return DataType.RECORDSET;
                    else if (Guards.isRecord(state))
                        return DataType.RECORD;
                    else
                        return DataType.FIELDSET;
            }
    }
}

export function expand(state: State, config?: Config) : IMetadata {
    switch (config?.type) {
        case DataType.RECORDSET:
            if (!Guards.isRecordset(state)) throw new TypeError(`State does not match configured type ${config.type}`)
            return Guards.isIRecordset(state) ? state : { records: state } as IRecordset;
        case DataType.FIELDSET:
            if (!Guards.isFieldSet(state)) throw new TypeError(`State does not match configured type ${config.type}`)
            return Guards.isIFieldSet(state) ? state : { fields: state } as IFieldSet;
        case DataType.RECORD:
            if (!Guards.isRecord(state)) throw new TypeError(`State does not match configured type ${config.type}`)
            return Guards.isIRecord(state) ? state : { value: state } as IRecord;
        case DataType.REFERENCE:
            if (!Guards.isReference(state)) throw new TypeError(`State does not match configured type ${config.type}`)
            return { primitive: state } as IAtom;
        case DataType.NUMBER:
            if (!Guards.isNumber(state)) throw new TypeError(`State does not match configured type ${config.type}`)
            return { primitive: state } as IAtom;
        case DataType.STRING:
            if (!Guards.isString(state)) throw new TypeError(`State does not match configured type ${config.type}`)
            return { primitive: state } as IAtom;
        case DataType.DATETIME:
            if (!Guards.isDateTime(state)) throw new TypeError(`State does not match configured type ${config.type}`)
            return { primitive: state } as IAtom;
        case undefined:
            // no config, so figure out type as best we can
            if (Guards.isIMetadata(state)) return state;
            switch (typeof state) {
                case 'number' :
                case 'string' : 
                    return {primitive: state} as IAtom;
                default:
                    if (DateTime.isDateTime(state))
                        return {primitive: state} as IAtom;
                    else if (Guards.isRecordset(state))
                        return { records: state } as IRecordset;
                    else if (Guards.isFieldSet(state))
                        return { fields: state } as IFieldSet;
                    else if (Guards.isRecord(state))
                        return { value: state } as IRecord;
                    else
                        throw new TypeError(`cannot expand ${state}`)
            }
    }
}

