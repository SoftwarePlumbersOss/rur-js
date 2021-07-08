import { FieldMapping, State, Recordset, Record, Primitive } from './state';
import { DataType } from './datatype';
import { StateEditor } from './editor';

export function validateFieldset(editor : StateEditor<FieldMapping>) : void {
}

export function validateRecordset(editor : StateEditor<Recordset>) : void {
}

export function validateRecord(editor : StateEditor<Record>) : void {
}

export function validateString(editor : StateEditor<Primitive>) : void {
}

export function validateNumber(editor : StateEditor<Primitive>) : void {
}

export function validate(editor: StateEditor<State>) {
    switch(editor.getType()) {
        case DataType.FIELDSET: 
            validateFieldset(editor as StateEditor<FieldMapping>);
            break;
        case DataType.RECORDSET: 
            validateRecordset(editor as StateEditor<Recordset>);
            break;
        case DataType.RECORD: 
            validateRecord(editor as StateEditor<Record>);
            break;
        case DataType.STRING: 
            validateString(editor as StateEditor<Primitive>);
            break;
        case DataType.NUMBER: 
            validateNumber(editor as StateEditor<Primitive>);
            break;
        case DataType.DATETIME: 
            validateNumber(editor as StateEditor<Primitive>);
            break;
        case DataType.REFERENCE: 
            break;
        default:
            throw new TypeError(`Unkown type ${editor.getType()}`);
    }
}
