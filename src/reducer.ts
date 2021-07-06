import { Config, getConfig } from './config';
import { DataType, getDataType, expand } from './datatype';
import { State, Recordset, IRecordset, Record, IRecord, Primitive, Field, FieldSet, IFieldSet, FieldMapping, IMetadata, IMetadataCarrier, Guards as StateGuards, Metadata, ChildMetadata, Atom, IAtom } from './state';
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
    mergeMetadata = "RUR_MERGE_METADATA",
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

export interface ValidationAction extends Action {
    validation: Field
}
export interface MetadataAction extends Action {
    metadata: IMetadata
}

export const Guards = {  
    isValueAction(action : Action) : action is ValueAction {
        return (action as ValueAction).value !== undefined;
    },
    isRecordAction(action : Action) : action is RecordAction {
        return (action as RecordAction).record !== undefined;
    },
    isValidationAction(action : Action) : action is ValidationAction {
        return (action as ValidationAction).validation !== undefined;
    },
    isMetadataAction(action : Action) : action is MetadataAction {
        return (action as MetadataAction).metadata !== undefined;
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

function updateIMetadata<T extends IMetadataCarrier>(carrier: T, [head, ...tail] : Key, value: Primitive) : T {
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

function updateFieldSet(fieldset: FieldSet, head: KeyPart, updater: (field : Field) => Field) : FieldMapping {
    try {
        return { ...fieldset, [head] : updater(StateGuards.isIFieldSet(fieldset) ? fieldset.fields[head] : fieldset[head]) }
    } catch (err) {
        if (err instanceof ReferenceBoundary) {
            err.key = [head, ...err.key];
        }
        throw err;
    }
}



function mergeIMetadataCarrier(a: IMetadataCarrier | undefined, b: IMetadataCarrier | undefined) : IMetadataCarrier  {
    if (a === undefined) return b || {};
    if (b === undefined) return a || {};
    let childMetadata : { [index: string] : IMetadataCarrier } | undefined;
    if (a.childMetadata === undefined) childMetadata = b.childMetadata;
    if (b.childMetadata === undefined) childMetadata = a.childMetadata;
    if (a.childMetadata !== undefined && b.childMetadata !== undefined) {
        childMetadata = {};
        for (const field of new Set([...Object.keys(a.childMetadata), ...Object.keys(b.childMetadata)])) {
            if (a.childMetadata === undefined) childMetadata = b.childMetadata;
            // One or other must not be null because field is in the set above;
            childMetadata[field] = mergeIMetadataCarrier(a.childMetadata[field], b.childMetadata[field]) as IMetadata;
        }
    }
    return {
        metadata: { ...a.metadata, ...b.metadata },
        childMetadata
    }
}

function isEmpty(carrier : IMetadataCarrier) {
    return (carrier.metadata === undefined || Object.keys(carrier.metadata).length === 0) && (carrier.childMetadata === undefined || Object.keys(carrier.childMetadata).length === 0)
}

function mergeRecordMetadata(config: Config, record: Record, metadata : IMetadata) : { state: Record, metadata?: IMetadata } {
    if (isEmpty(metadata)) return { state: record };

    // First we merge the record value
    let mergedValue : { state: State, metadata?: IMetadata };
    if (StateGuards.isIRecord(record)) {
        mergedValue = mergeMetadata(config, record.value, metadata);
    } else {
        mergedValue = mergeMetadata(config, record, metadata);
    }

    // Record can carry metadata, so we merge in any 'spare' metadata from the merge above to create the result
    let result : { state: Record, metadata?: IMetadata };
    if (mergedValue.metadata && !isEmpty(mergedValue.metadata)) {
        // We have spare metadata to merge
        if (StateGuards.isIRecord(record))
            // the existing record has metadata, so we must merge it with the child metadata from the value merge.
            // metadata suplied in the parametrer is all attached to the value - so it's all child metadata
            result = { state: { ...mergeIMetadataCarrier(record, mergedValue.metadata), value: mergedValue.state as Field } }
        else 
            // the existing record has no metadata, so all the child metadata comes from the value merge
            result = { state: { ...mergedValue.metadata, value: mergedValue.state as Field  } }
    } else {
        // No spare metadata from merge
        if (StateGuards.isIRecord(record))
            // just copy the existing record replacing the merged value
            result = { state: { ...record, value: mergedValue.state as Field } }
        else {
            // No metadata at all, so revert to the 'simple' record if we can
            if (StateGuards.isPrimitive(mergedValue.state)) {
                result = { state: mergedValue.state } 
            } else {
                result = { state: { value: mergedValue.state as Field } }
            }
        }
    }

    return result;
}

function mergeRecordsetMetadata(config: Config, recordset: Recordset, metadata: IMetadata) : { state: Recordset, metadata?: IMetadata } {
    if (isEmpty(metadata)) return { state: recordset };
    if (StateGuards.isIRecordset(recordset)) {
        return { state: { ...recordset, metadata: { ...metadata.metadata, ...recordset.metadata } } }
    } else {
        return { state: { records: recordset, metadata: metadata.metadata }}
    }
}

function createFieldsetFromMetadata(config: Config, metadata: IMetadata) {
    let sourceChildMetadata = ((metadata as IMetadataCarrier).childMetadata);
    if (sourceChildMetadata?.length) { 
        let childState : FieldMapping = {};
        let childMetadata : ChildMetadata = {};
        for (const childName of Object.keys(sourceChildMetadata)) {
            let childResult = createStateFromMetadata(config, sourceChildMetadata[childName]);
            if (childResult.state) childState[childName] = childResult.state as Field;
            if (childResult.metadata) childMetadata[childName] = childResult.metadata;
        }
        return {
            state: childState,
            metadata: { metadata: metadata.metadata, childMetadata } as IMetadataCarrier
        }
    } else {
        return { metadata }
    }
}

function createStateFromMetadata(config: Config, metadata: IMetadataCarrier) : { state?: State, metadata? : IMetadata } {
    switch(config.type) {
        case DataType.RECORDSET:
            return { state: { ...metadata, records: []} } // we don't merge record data
        case DataType.FIELDSET:
            return createFieldsetFromMetadata(config, metadata);
        default:
            if (metadata.childMetadata)
                return createFieldsetFromMetadata(config, metadata);
            else
                return { metadata }
    }    
}

function mergeFieldSetMetadata(config : Config, fieldset: FieldMapping, metadata: IMetadata) :  { state: FieldMapping, metadata? : IMetadata } {
    let sourceChildMetadata = (metadata as IMetadataCarrier).childMetadata;
    let childMetadata : ChildMetadata = { }
    let resultFields : FieldMapping = {}
    if (sourceChildMetadata) {
        for (const fieldName of new Set([...Object.keys(fieldset), ...Object.keys(sourceChildMetadata)])) {
            let childResult : { state?: State, metadata?: IMetadata } = {};
            if (sourceChildMetadata[fieldName] && fieldset[fieldName]) {
                childResult = mergeMetadata(getConfig(config, fieldName), fieldset[fieldName], sourceChildMetadata[fieldName]);
            } else if (fieldset[fieldName]) {
                childResult = { state: fieldset[fieldName] }
            } else {
                childResult = createStateFromMetadata(getConfig(config, fieldName), sourceChildMetadata[fieldName]);
            }
            if (childResult.metadata) childMetadata[fieldName] = childResult.metadata;
            if (childResult.state) resultFields[fieldName] = childResult.state as Field;

        }
    }
    return { state: resultFields, metadata: {  ...metadata, childMetadata } as IMetadataCarrier } 
}

function mergePrimitiveMetadata(config : Config, primitive: Primitive, metadata: IMetadata) :  { state: Primitive, metadata: IMetadata }  {
    return { state: primitive, metadata }
}

function mergeMetadata(config: Config, state: State, metadata: IMetadata) : { state: State, metadata? : IMetadata } {
    logEntry("mergeMetadata", config, state, metadata);
    const type = getDataType(state, config);
    switch (type) {
        case DataType.RECORDSET:
            return mergeRecordsetMetadata(config, state as Recordset, metadata);
        case DataType.FIELDSET:
            return mergeFieldSetMetadata(config, state as FieldMapping, metadata);
        case DataType.RECORD:
            return mergeRecordMetadata(config, state as Record, metadata);            
        default:
            return mergePrimitiveMetadata(config, state as Primitive, metadata);
    }
}

function mergeRecordMetadataAt(config: Config, state: Record, key : Key, metadata: IMetadata) : { state: Record, metadata?: IMetadata }  {
    logEntry("mergeRecordMetadataAt", config, state, key, metadata);
    let result;
    if (StateGuards.isIRecord(state)) {
        let value = mergeMetadataAt(config, state.value, key, metadata);
        if (value.metadata)
            result = { state: { ...mergeIMetadataCarrier(state, value.metadata ), value: value.state as Field } };
        else
            result = { state: { ...state, value: value.state as Field }}
    } else {
        let value = mergeMetadataAt(config, state, key, metadata);
        result = { state: { childMetadata: { value: value.metadata }, value: value.state as Field } };
    }
    return logReturn("mergeRecordMetadataAt", result);
}

function mergeRecordsetMetadataAt(config: Config, state: Recordset, [head, ...tail] : Key, metadata: IMetadata) : { state: Recordset, metadata?: IMetadata } {
    logEntry("mergeRecordsetMetadataAt", config, state, head, tail, metadata);
    let result = { 
        state: updateRecordset(state, head, record => mergeRecordMetadataAt(getConfig(config,head), record, tail, metadata).state as Record),
    }
    return logReturn("mergeRecordsetMetadataAt", result);
}

function mergeFieldSetMetadataAt(config: Config, state: FieldMapping, [head, ...tail] : Key, metadata: IMetadata) : { state: FieldMapping, metadata?: IMetadata } {
    logEntry("mergeFieldsetMetadataAt", config, state, head, tail, metadata);
    let resultState : FieldMapping = { ...state };
    let childMetadata : ChildMetadata = {};
    let resultField = mergeMetadataAt(getConfig(config, head), state[head], tail, metadata);
    resultState[head] = resultField.state as Field;
    if (resultField.metadata) childMetadata[head] = resultField.metadata;
    return logReturn("mergeRecordsetMetadataAt", { state: resultState, metadata: { childMetadata }});
}

function mergeMetadataAt(config: Config, state: State, key : Key, metadata: IMetadata) : { state : State, metadata? : IMetadata } {
    logEntry("mergeMetadataAt", config, state, key, metadata);
    let result;
    if (key.length > 0) {
        switch(getDataType(state, config)) {
            case DataType.FIELDSET: 
                result = mergeFieldSetMetadataAt(config, state as FieldMapping, key, metadata);
                break;
            case DataType.RECORDSET:
                result = mergeRecordsetMetadataAt(config, state as Recordset, key, metadata);
                break;
            case DataType.RECORD:
                result = mergeRecordMetadataAt(config, state as Record, key, metadata);
                break;
            default:
                throw new TypeError('metadata must be attached directly to a primtive');

        }
    } else {
        result = mergeMetadata(config, state, metadata);
    }
    return logReturn("mergeMetadataAt", result);
}


function updateState<T extends State>(config: Config, state: State, head: KeyPart, updater: (child: T) => T, recordUpdater : (child: Record) =>Record = (record => updateRecord(record, value => updater(value as T) as Field)))  : State {
    logEntry("setState", config, state, head, updater);
    const type = getDataType(state, config);
    switch (type) {
        case DataType.RECORDSET:
            return updateRecordset(state as Recordset, head, row => recordUpdater(row));
        case DataType.FIELDSET:
            return updateFieldSet(state as FieldSet, head, child => updater(child as T) as Field);1
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
        case ActionType.mergeMetadata: 
            if (!Guards.isMetadataAction(action)) throw new TypeError("wrong type for action");
            let mergeResult = mergeMetadataAt(action.config, base, action.key, action.metadata);
            if (mergeResult.metadata) throw new Error("invalid merge");
            base = mergeResult.state;
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