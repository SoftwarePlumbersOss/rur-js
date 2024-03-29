import { FieldMapping, FieldArray, State, IRecordset, RichField, NullablePrimitive } from './state';
import { DataType } from './datatype';
import { StateEditor } from './editor';
import { DateTime } from 'luxon';
import { Exception, ErrorCode } from './exceptions';

export function validateFieldset(editor : StateEditor<FieldMapping>) : void {
    let config = editor.getConfig() || { fields: {} };   
    let errors : Exception[] = [] 
    for (const fieldName of Object.keys(config.fields)) {
        editor.editAt([fieldName], validate);
        const error : Exception = editor.getChildMetadata(fieldName)?.metadata?.error as Exception;
        if (error) errors.push(error);
    }
    if (errors.length > 0) {
        if (errors.length === 1) {
            editor.mergeMetadata({ metadata: { error: errors[0]}})
        } else {
            editor.mergeMetadata({ metadata: { error: { code: ErrorCode.STATE_VALIDATION, message: 'there are multiple errors' }}})
        }
    }
}

export function validateArray(editor : StateEditor<FieldArray>) : void {
}

export function validateRecordset(editor : StateEditor<IRecordset>) : void {
}

export function validateRecord(editor : StateEditor<RichField>) : void {
    editor.editAt([], validate);
}

export function validateString(editor : StateEditor<NullablePrimitive>) : void {
    let state = editor.getState();
    let config = editor.getConfig();
    let error = null;
    if (state !== undefined && state !== null) {
        state = state.toString().trim();
        if (config?.maxLength) {
            if (state.length > config.maxLength) {
                error = { code: ErrorCode.STATE_VALIDATION, message: 'maximum length exceeded' };
            }
        } else if (state.length === 0 && config?.mandatory) {
            error = { code: ErrorCode.STATE_MANDATORY, message: 'field is mandatory' };
        }

    } else {
        if (config?.mandatory) {
            error = { code: ErrorCode.STATE_MANDATORY, message: 'field is mandatory' };
        }
    }
    if (!error) {
        editor.merge(state);
    }
    editor.mergeMetadata({ metadata: { error }})
}

export function validateNumber(editor : StateEditor<NullablePrimitive>) : void {
    let state = editor.getState();
    let config = editor.getConfig();
    let error = null;
    if (state !== undefined && state !== null) {
        state = Number(state);
        if (Number.isNaN(state)) {
            error = { code: ErrorCode.STATE_VALIDATION, message: 'must be a number' };
        }
    } else {
        if (config?.mandatory) {
            error = { code: ErrorCode.STATE_MANDATORY, message: 'field is mandatory' };
        }
    }
    if (error) {
        editor.mergeMetadata({ metadata: { error }})
    } else {
        editor.merge(state);
    }    
}

export function validateDateTime(editor : StateEditor<NullablePrimitive>) : void {
    let state = editor.getState();
    let config = editor.getConfig();
    let error = null;
    if (state !== undefined && state !== null) {
        state = DateTime.isDateTime(state) ? state : DateTime.fromISO(String(state));
        if (!state.isValid) {
            error = { code: ErrorCode.STATE_VALIDATION, message: 'must be a date/time' };
        }
    } else {
        if (config?.mandatory) {
            error = { code: ErrorCode.STATE_MANDATORY, message: 'field is mandatory' };
        }
    }
    if (error) {
        editor.mergeMetadata({ metadata: { error }})
    } else {
        editor.merge(state);
    }    
}

export function validate(editor: StateEditor<State>) {
    switch(editor.getType()) {
        case DataType.FIELD_MAPPING: 
            validateFieldset(editor as StateEditor<FieldMapping>);
            break;
        case DataType.RECORDSET: 
            validateRecordset(editor as StateEditor<IRecordset>);
            break;
        case DataType.RECORD: 
            validateRecord(editor as StateEditor<RichField>);
            break;
        case DataType.STRING: 
            validateString(editor as StateEditor<NullablePrimitive>);
            break;
        case DataType.NUMBER: 
            validateNumber(editor as StateEditor<NullablePrimitive>);
            break;
        case DataType.ARRAY: 
            validateArray(editor as StateEditor<FieldArray>);
            break;
        case DataType.DATETIME: 
            validateDateTime(editor as StateEditor<NullablePrimitive>);
            break;
        case DataType.REFERENCE: 
            break;
        default:
            throw new TypeError(`Unkown type ${editor.getType()}`);
    }
}
