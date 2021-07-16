import { State, NullablePrimitive, FieldArray, IRecordset, FieldMapping, IMetadataCarrier } from '../state';
import { DataType, getDataType } from '../datatype';
import { Config } from '../config'; 
import { FieldMappingEditor } from './fieldmapping';
import { PrimitiveEditor } from './primitive';

import { StateEditor, FieldArrayEditor, RecordEditor, RecordsetEditor } from './base';

export function edit<T extends State>(config?: Config, state?: T, metadata?: IMetadataCarrier): StateEditor<T> {
    const type = getDataType(state, config);
    switch (type) {
        case DataType.RECORDSET: return new RecordsetEditor(config, <IRecordset> state) as unknown as StateEditor<T>;
        case DataType.RECORD: return new RecordEditor(config, <State>state) as unknown as StateEditor<T>;
        case DataType.FIELDSET: return new FieldMappingEditor(config, <FieldMapping>state, metadata) as unknown as StateEditor<T>;
        case DataType.ARRAY: return new FieldArrayEditor(config, <FieldArray>state, metadata) as unknown as StateEditor<T>;
        case DataType.STRING:
        case DataType.REFERENCE:
        case DataType.NUMBER:
        case DataType.DATETIME: return new PrimitiveEditor(config, <NullablePrimitive>state, metadata) as unknown as StateEditor<T>;
        default:
            throw new TypeError(`unhandled type ${type}`);
    }
}

export function editRecord(config?: Config, state?: State) : RecordEditor {
    return new RecordEditor(config, <State>state);
}