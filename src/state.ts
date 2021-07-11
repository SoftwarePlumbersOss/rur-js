import { DateTime } from 'luxon';
import { PackedCriteria } from './criteria';
import { Exception } from './exceptions';

export  type Primitive = string | number | DateTime;
export  type NullablePrimitive = Primitive | null;

export type MetadataPrimitive = string | number | DateTime | Exception | undefined | null;

export type Metadata = { [ propName: string ] : MetadataPrimitive }

export interface IMetadata {
    metadata: Metadata
}
export interface IMetadataCarrier extends IMetadata {
    childMetadata? : { [childName: string]: IMetadataCarrier }    
}

export type ChildMetadata = IMetadataCarrier["childMetadata"]


export interface FieldMapping { 
    [ fieldName: string ] : NullablePrimitive | Recordset | FieldMapping
}

export type Field = FieldMapping[string];

export interface IRecord extends IMetadataCarrier {
    value: Field
}

export type Record = IRecord | Primitive

export interface Filter {
    records: Record[],
    criteria: PackedCriteria

}

export interface IRecordset extends IMetadataCarrier {
    records: Record[],
    filter?: Filter
}

export type Recordset = IRecordset | Record[]

export type State = Field | Record

export class Guards {

    static isIRecord(state?: State | IMetadata): state is IRecord {
        return (state as IRecord)?.value !== undefined;
    }

    static isRecord(state?: State): state is Record {
        return Guards.isIRecord(state) || Guards.isPrimitive(state);
    }

    static isString(state?: State): state is Primitive {
        const type = typeof state;
        return (type === 'string');
    }

    static isReference(state?: State): state is Primitive {
        const type = typeof state;
        return (type === 'string');
    }

    static isNumber(state?: State): state is Primitive {
        const type = typeof state;
        return (type === 'number');
    }

    static isDateTime(state?: State): state is Primitive {
        return DateTime.isDateTime(state);
    }

    static isPrimitive(state?: State): state is Primitive {
        const type = typeof state;
        return (type === 'number' || type === 'string' || DateTime.isDateTime(state));
    }

    static isNullablePrimitive(state?: State): state is NullablePrimitive {
        return state === null || this.isPrimitive(state);
    }

    static isIRecordset(state?: State | IMetadata): state is IRecordset {
        return (state as IRecordset)?.records !== undefined;
    }

    static isRecordset(state?: State): state is Recordset {
        return Guards.isIRecordset(state) || Array.isArray(state);
    }

    static isIMetadataCarrier(state?: State): state is IMetadataCarrier & State{
        return Guards.isIRecord(state) || Guards.isIRecordset(state);
    }

    static isFieldMapping(field: Field) : field is FieldMapping {
        return !this.isNullablePrimitive(field) && !this.isRecordset(field);
    }
}

