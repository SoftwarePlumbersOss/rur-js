import { Config, getConfig } from './config';
import { DataType, getDataType } from './datatype';
import { State, Recordset, Record, Primitive, Field, IFieldSet, Guards as StateGuards } from './state';
import { Key } from './accessor';
import { ReferenceBoundary } from './exceptions';

function logReturn(name: string, value: any) : any {
    //console.log(`exiting ${name}`, value);
    return value;
}

function logEntry(name: string, ...value : any) {
    //console.log(`entering ${name}`, ...value);
}

export enum ActionType {
    setValue = "RUR_SET_VALUE",
    insertValue = "RUR_INSERT_VALUE"
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

export const Guards = {
    isValueAction(action : Action) : action is ValueAction {
        return (action as ValueAction).value !== undefined;
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

function updateRecord(config: Config, record: Record, key: Key, value: Primitive) : Record {
    if (StateGuards.isIRecord(record)) {
        return { ...record, value: setState(config, record.value, key, value) as Field }
    } else {
        return setState(config, record, key, value) as Record;
    }
}

function updateFieldSet(config: Config, fieldset: IFieldSet, [ head, ...tail ]: Key, value: Primitive) : IFieldSet {
    return { ...fieldset, [head] : setState(getConfig(config, head), fieldset[head], tail, value) as Field }
}

function setState(config: Config, state: State, key: Key, value : Primitive) : State {
    logEntry("setState", config, state, key, value);
    let result: State | undefined = value;
    if (key.length > 0) {
        const [head, ...tail] = key;
        const type = getDataType(state, config);
        switch (type) {
            case DataType.RECORDSET:
                result = (typeof head === 'number') 
                    ? updateRow(state as Recordset, head, (row: Record) => updateRecord(getConfig(config, head), row, tail, value)) 
                    : updateRowByKey(state as Recordset, head, (row: Record) => updateRecord(getConfig(config, head), row, tail, value)) 
                break;
            case DataType.FIELDSET:
                if (typeof head !== 'string') throw new TypeError('key for fieldset must be a string');
                result = updateFieldSet(config, state as IFieldSet, key, value);
                break;
            case DataType.REFERENCE:
                throw new ReferenceBoundary(config, value as string, ...key);
            default:
                throw new TypeError(`State type ${type} does not have member for ${key.join('.')}`)

        }
    } else {
        result = value;
    }
    return logReturn("getState", result);
}

export function reduce(state: any, action: Action) : any {
    let base = getBase(state, action.base);
    switch (action.type) {
        case ActionType.setValue: 
            if (!Guards.isValueAction(action)) throw new TypeError("wrong type for action");
            base = setState(action.config, base, action.key, action.value)    
            break;
    }

    return setBase(state, action.base, base);
}