import { Config } from './config';
import { State, Record, NullablePrimitive,  IMetadataCarrier, MetadataPrimitive } from './state';
import { validate } from './validation';
import { Key } from './types'; 
import { StateEditor, edit } from './editor';
import { PackedCriteria } from './criteria';

export enum ActionType {
    setValue = "RUR_SET_VALUE",
    setMetadata = "RUR_SET_METADATA",
    mergeMetadata = "RUR_MERGE_METADATA",
    insertValue = "RUR_INSERT_VALUE",
    addValue = "RUR_ADD_VALUE",
    updateValue = "RUR_UPDATE_VALUE",
    upsertValue = "RUR_UPSERT_VALUE",
    removeValue = "RUR_REMOVE_VALUE",
    validate = "RUR_VALIDATE",
    search = "RUR_SEARCH"
}

export interface Action {
    type: ActionType,
    config: Config,
    key: Key
    base: string[]
}

export interface ValueAction extends Action {
    value: NullablePrimitive
}

export interface MetadataValueAction extends Action {
    metaValue: MetadataPrimitive
}

export interface RecordAction extends Action {
    record: Record
}
export interface MetadataAction extends Action, IMetadataCarrier {
}

export interface SearchAction extends Action {
    criteria: PackedCriteria
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
    },
    isMetadataValueAction(action : Action) : action is MetadataValueAction {
        return (action as MetadataValueAction).metaValue !== undefined;
    },     
    isSearchAction(action : Action) : action is SearchAction {
        return (action as SearchAction).criteria !== undefined;
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
            if (!Guards.isMetadataValueAction(action)) throw new TypeError("wrong type for action");
            editor.setMetadata(action.key,action.metaValue);
            break;
        case ActionType.mergeMetadata: 
            if (!Guards.isMetadataAction(action)) throw new TypeError("wrong type for action");
            editor.mergeMetadataAt(action.key, action);
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
            editor.mergeMetadataAt(action.key, action);
            editor.editAt(action.key, validate);
            break;
        case ActionType.search:
            if (!Guards.isSearchAction(action)) throw new TypeError("wrong type for action");
            editor.searchAt(action.key, action.criteria);
            editor.editAt(action.key, validate);
            break;            
    }

    return setBase(state, action.base, editor.getState());
}