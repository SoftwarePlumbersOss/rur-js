import { Config, getConfig } from './config';
import { DataType, getDataType } from './datatype';
import { State, Recordset, IRecordset, Record, IRecord, Primitive, Field, IFieldSet, IMetadata, Guards as StateGuards, Metadata, ChildMetadata } from './state';
import { Key, KeyPart } from './accessor';
import { ReferenceBoundary,  NoMetadataCarrier } from './exceptions';

function logReturn(name: string, value: any) : any {
    //console.log(`exiting ${name}`, value);
    return value;
}

function logEntry(name: string, ...value : any) {
    //console.log(`entering ${name}`, ...value);
}

export enum ActionType {
    setValue = "RUR_SET_VALUE",
    setMetadata = "RUR_SET_METADATA",
    insertValue = "RUR_INSERT_VALUE",
    addValue = "RUR_ADD_VALUE",
    removeValue = "RUR_REMOVE_VALUE",
    validate = "RUR_VALIDATE"
}

export interface Action {
    type: ActionType,
    config: Config,
    key: Key
    base: string[]
}

export interface ValueAction extends Action {
    value: Primitive
}
export interface RecordAction extends Action {
    record: Record
}

export const Guards = {  
    isValueAction(action : Action) : action is ValueAction {
        return (action as ValueAction).value !== undefined;
    },
    isRecordAction(action : Action) : action is RecordAction {
        return (action as RecordAction).record !== undefined;
    }
}

function getBase(state: any, path: string[]) : State {
    return path.reduce((state : any, part : string)=>state[part] || {}, state) as State;
}

function setBase(state: any, path: string[], value: State) : any {
    if (path.length === 0) return value;
    let [head, ...tail] = path;
    return { ...state, [head] : setBase(state[head] || {}, tail, value)}
}

function updateRowByKey(recordset: Recordset, key: Primitive, updater : ((row : Record) => Record)) : Recordset {
    if (StateGuards.isIRecordset(recordset)) {
        return { ...recordset, records: recordset.records.map((row,i)=> (StateGuards.isIRecord(row)? row.metadata?.key === key : row === key) ? updater(row) : row)}
    } else {
        return recordset.map((row,i)=> (StateGuards.isIRecord(row)? row.metadata?.key === key : row === key) ? updater(row) : row);
    }

}

function updateRow(recordset: Recordset, index: number, updater : ((row : Record) => Record)) : Recordset {
    if (StateGuards.isIRecordset(recordset)) {
        return { ...recordset, records: recordset.records.map((row,i)=>i===index ? updater(row) : row)}
    } else {
        return recordset.map((row,i)=>i===index ? updater(row) : row);
    }
}

function updateRecordset(recordset: Recordset, head : string | number, updater : ((row : Record) => Record)) : Recordset { 
    return (typeof head === 'number') 
        ? updateRow(recordset, head, updater) 
        : updateRowByKey(recordset, head, updater)
}


function insertRow(recordset: Recordset, head: KeyPart, row : Record) : Recordset {
    if (StateGuards.isIRecordset(recordset)) {
        let index : number = typeof head === 'number' ? head : recordset.records.findIndex(row => StateGuards.isIRecord(row)? row.metadata?.key === head : row === head);
        return { ...recordset, records:  [ ...recordset.records.slice(0,index), row, ...recordset.records.slice(index) ]}
    } else {
        let index : number = typeof head === 'number' ? head : recordset.findIndex(row => StateGuards.isIRecord(row)? row.metadata?.key === head : row === head);
        return [ ...recordset.slice(0,index), row, ...recordset.slice(index) ]
    }
}

function removeRow(recordset: Recordset, head: KeyPart) : Recordset {
    if (StateGuards.isIRecordset(recordset)) {
        let index : number = typeof head === 'number' ? head : recordset.records.findIndex(row => StateGuards.isIRecord(row)? row.metadata?.key === head : row === head);
        return { ...recordset, records:  [ ...recordset.records.slice(0,index), ...recordset.records.slice(index+1) ]}
    } else {
        let index : number = typeof head === 'number' ? head : recordset.findIndex(row => StateGuards.isIRecord(row)? row.metadata?.key === head : row === head);
        return [ ...recordset.slice(0,index), ...recordset.slice(index+1) ]
    }
}

function addRow(recordset: Recordset, row : Record) : Recordset {
    if (StateGuards.isIRecordset(recordset)) {
        return { ...recordset, records:  [ ...recordset.records, row ]}
    } else {
        return [ ...recordset, row ]
    }
}

function updateRecord(record: Record, updater: (field : Field)=>Field) : Record {
    if (StateGuards.isIRecord(record)) {
        return { ...record, value: updater(record.value) }
    } else {
        return updater(record) as Record;
    }
}

function updateRecordMetadata(config: Config, record: Record, key: Key, value: Primitive) : Record {
    try {
        if (StateGuards.isIRecord(record)) {
            return { ...record, value: setMetadata(config, record.value, key, value) as Field }
        } else {
            return setMetadata(config, record, key, value) as Record;
        }
    } catch (err) {
        if (err instanceof NoMetadataCarrier) {
            return updateMetadata({ ...config, type: DataType.RECORD}, record, key, value);
        } else {
            throw err;
        }
    }
}

function updateIMetadata<T extends IMetadata>(carrier: T, [head, ...tail] : Key, value: Primitive) : T {
    if (tail.length > 0) {
        const childMetadata = carrier?.childMetadata || {};
        return { ...carrier, childMetadata: { ...childMetadata, [head] : updateIMetadata(childMetadata[head], tail, value) } }
    } else {
        const metadata = carrier?.metadata || {}
        return { ...carrier, metadata: { ...metadata, [head] : value }}
    }
}

function updateMetadata<T extends State>(config : Config, carrier: T, key: Key, value: Primitive) : T {
    let type = getDataType(carrier, config);
    switch (type) {
        case DataType.RECORDSET:
            if (StateGuards.isIRecordset(carrier))
                return updateIMetadata(carrier, key, value);
            else
                return updateIMetadata({ records: carrier } as IRecordset, key, value) as T;
        case DataType.RECORD:
            if (StateGuards.isIRecord(carrier))
                return updateIMetadata(carrier, key, value);
            else
                return updateIMetadata({ value: carrier } as IRecord, key, value) as T;
        default:
            throw new NoMetadataCarrier(...key);
    }
}

function updateFieldSet(fieldset: IFieldSet, head: KeyPart, updater: (field : Field) => Field) : IFieldSet {
    try {
        return { ...fieldset, [head] : updater(fieldset[head]) }
    } catch (err) {
        if (err instanceof ReferenceBoundary) {
            err.key = [head, ...err.key];
        }
        throw err;
    }
}

function updateState<T extends State>(config: Config, state: State, head: KeyPart, updater: (child: T) => T, recordUpdater : (child: Record) =>Record = (record => updateRecord(record, value => updater(value as T) as Field)))  : State {
    logEntry("setState", config, state, head, updater);
    const type = getDataType(state, config);
    switch (type) {
        case DataType.RECORDSET:
            return updateRecordset(state as Recordset, head, row => recordUpdater(row));
        case DataType.FIELDSET:
            return updateFieldSet(state as IFieldSet, head, child => updater(child as T) as Field);1
        case DataType.REFERENCE:
            throw new ReferenceBoundary(config, state as string, head);
        default:
            throw new TypeError(`State type ${type} does not have member for ${head}`)
    }
}

function setState(config: Config, state: State, key: Key, value : Primitive) : State {
    logEntry("setState", config, state, key, value);
    let result: State | undefined = value;
    if (key.length > 0) {
        const [head, ...tail] = key;
        result = updateState(config, state, head, child => setState(getConfig(config, head), child, tail, value));
    } else {
        result = value
    }
    return logReturn("setState", result);
}

function setMetadata(config: Config, state: State, key: Key, value : Primitive) : State {
    logEntry("setMetadata", config, state, key, value);
    let result: State | undefined = value;
    if (key.length > 1) {
        const [head, ...tail] = key;
        try {
            result = updateState(config, state, head, 
                child => setMetadata(getConfig(config, head), child, tail, value), 
                record => updateRecordMetadata(getConfig(config, head), record, tail, value)
            );
        } catch (err) {
            if (err instanceof NoMetadataCarrier) {
                result = updateMetadata(config, state, key, value);
            } else {
                throw err;
            }
        }
    } else {
        result = updateMetadata(config, state, key, value);
    }
    return logReturn("setMetadata", result);
}

function insertRecord(config: Config, state: State, [head, ...tail]: Key, value : Record) : State {
    logEntry("insertRecord", config, state, head, tail, value);
    let result: State | undefined = value;
    if (tail.length > 0) {
        result = updateState(config, state, head, child => insertRecord(getConfig(config, head), child, tail, value));
    } else {
        result = insertRow(state as Recordset, head, value);
    }
    return logReturn("insertRecord", result);    
}

function addRecord(config: Config, state: State, key: Key, value : Record) : State {
    logEntry("addRecord", config, state, key, value);
    let result: State | undefined = value;
    if (key.length > 0) {
        const [head, ...tail] = key;
        result = updateState(config, state, head, child => addRecord(getConfig(config, head), child, tail, value));
    } else {
        result = addRow(state as Recordset, value);
    }
    return logReturn("addRecord", result);    
}

function removeRecord(config: Config, state: State, [head, ...tail]: Key) : State {
    logEntry("removeRecord", config, state, head, tail);
    let result: State;
    if (tail.length > 0) {
        result = updateState(config, state, head, child => removeRecord(getConfig(config, head), child, tail));
    } else {
        result = removeRow(state as Recordset, head);
    }
    return logReturn("removeRecord", result);    
}

export function reduce(state: any, action: Action) : any {
    let base = getBase(state, action.base);
    switch (action.type) {
        case ActionType.setValue: 
            if (!Guards.isValueAction(action)) throw new TypeError("wrong type for action");
            base = setState(action.config, base, action.key, action.value);
            break;
        case ActionType.setMetadata: 
            if (!Guards.isValueAction(action)) throw new TypeError("wrong type for action");
            base = setMetadata(action.config, base, action.key, action.value) || base;
            break;
        case ActionType.insertValue:
            if (!Guards.isRecordAction(action)) throw new TypeError("wrong type for action");
            base = insertRecord(action.config, base, action.key, action.record);
            break;
        case ActionType.addValue:
            if (!Guards.isRecordAction(action)) throw new TypeError("wrong type for action");
            base = addRecord(action.config, base, action.key, action.record);
            break;            
        case ActionType.removeValue:
            base = removeRecord(action.config, base, action.key); 
            break;            
        }

    return setBase(state, action.base, base);
}