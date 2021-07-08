import { Config } from './config';
import { State, Record, Primitive,  IMetadataCarrier } from './state';
import { validate } from './validation';
import { Key } from './types'; 
import { StateEditor, edit } from './editor';

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
export interface MetadataAction extends Action {
    metadata: IMetadataCarrier
}

export const Guards = {  
    isValueAction(action : Action) : action is ValueAction {
        return (action as ValueAction).value !== undefined;
    },
    isRecordAction(action : Action) : action is RecordAction {
        return (action as RecordAction).record !== undefined;
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

export function reduce(state: any, action: Action) : any {
    let base : State = getBase(state, action.base);
    let editor : StateEditor<State> = edit(action.config, base);
    switch (action.type) {
        case ActionType.setValue: 
            if (!Guards.isValueAction(action)) throw new TypeError("wrong type for action");
            editor.set(action.key, action.value);
            break;
        case ActionType.setMetadata: 
            if (!Guards.isValueAction(action)) throw new TypeError("wrong type for action");
            editor.setMetadata(action.key,action.value);
            break;
        case ActionType.mergeMetadata: 
            if (!Guards.isMetadataAction(action)) throw new TypeError("wrong type for action");
            editor.mergeMetadataAt(action.key, action.metadata);
            break;            
        case ActionType.insertValue:
            if (!Guards.isRecordAction(action)) throw new TypeError("wrong type for action");
            editor.insertRecordAt(action.key, action.record);
            break;
        case ActionType.addValue:
            if (!Guards.isRecordAction(action)) throw new TypeError("wrong type for action");
            editor.addRecordAt(action.key, action.record);
            break;            
        case ActionType.removeValue:
            editor.removeRecord(action.key);
            break;
        case ActionType.validate:
            if (!Guards.isMetadataAction(action)) throw new TypeError("wrong type for action");
            editor.mergeMetadataAt(action.key, action.metadata);
            editor.editAt(action.key, validate);
            break;
    }

    return setBase(state, action.base, editor.getState());
}