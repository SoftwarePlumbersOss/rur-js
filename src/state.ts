import { DateTime } from 'luxon';
import { PackedCriteria } from './criteria';
import { Sort } from './sort'
import { Exception } from './exceptions';

export  type Primitive = string | number | DateTime;
export  type NullablePrimitive = Primitive | null;

export type MetadataPrimitive = string | number | DateTime | Exception | undefined | null;

export type Metadata = { [ propName: string ] : MetadataPrimitive }
export interface IMetadataCarrier {
    metadata: Metadata
    childMetadata? : { [childName: string]: IMetadataCarrier }
    memberMetadata? : [ IMetadataCarrier ] 
}

export type ChildMetadata = IMetadataCarrier["childMetadata"]


export interface FieldMapping { 
    [ fieldName: string ] : NullablePrimitive | IRecordset | FieldMapping | (Primitive | FieldMapping)[]
}

export type Field = FieldMapping[string];

export type FieldArrayContent = Primitive | FieldMapping;

export type FieldArray = FieldArrayContent[]

export interface IRecord extends IMetadataCarrier {
    value: Field
}

export type Record = IRecord | Primitive 

export interface Filter {
    keys: string[],
    criteria?: PackedCriteria,
    sort?: Sort
}
export interface IRecordset extends IMetadataCarrier {
    records: { [ key: string ] : Record },
    filter?: Filter
}

export type State = Field | Record 

export class Guards {

    static isIRecord(state?: State): state is IRecord {
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

    static isIRecordset(state?: State): state is IRecordset {
        return (state as IRecordset)?.records !== undefined;
    }

    static isIMetadataCarrier(state?: State): state is IMetadataCarrier & State {
        return Guards.isIRecord(state) || Guards.isIRecordset(state);
    }

    static isFieldMapping(field: Field) : field is FieldMapping {
        return !this.isNullablePrimitive(field) && !this.isIRecordset(field) && !Array.isArray(field);
    }
}

