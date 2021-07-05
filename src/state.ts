import { DateTime } from 'luxon';


export  type Primitive = string | number | DateTime;

export type Field = Primitive | Recordset | IFieldSet;

export interface IFieldSet {
    [ fieldName: string ] : Field
}

export type ChildMetadata = { [childName: string]: IMetadata };
export type Metadata = { [ propName: string ] : Primitive }
export interface IMetadata {
    childMetadata?: ChildMetadata
    metadata?: Metadata
}

export interface IRecord extends IMetadata {
    value: Field
}

export type Record = IRecord | Primitive;

export interface IRecordset extends IMetadata {
    records: Record[]
}

export type Recordset = IRecordset | Record[]

export type State = Field | Record

export class Guards {

    static isIRecord(state: State): state is IRecord {
        return (state as IRecord)?.value !== undefined;
    }

    static isRecord(state: State): state is Record {
        return Guards.isIRecord(state) || Guards.isPrimitive(state);
    }

    static isString(state: State): state is Primitive {
        const type = typeof state;
        return (type === 'string');
    }

    static isReference(state: State): state is Primitive {
        const type = typeof state;
        return (type === 'string');
    }

    static isNumber(state: State): state is Primitive {
        const type = typeof state;
        return (type === 'number');
    }

    static isDateTime(state: State): state is Primitive {
        return DateTime.isDateTime(state);
    }

    static isPrimitive(state: State): state is Primitive {
        const type = typeof state;
        return (type === 'number' || type === 'string' || DateTime.isDateTime(state));
    }

    static isIRecordset(state: State): state is IRecordset {
        return (state as IRecordset)?.records !== undefined;
    }

    static isRecordset(state: State): state is Recordset {
        return Guards.isIRecordset(state) || Array.isArray(state);
    }

    static isIFieldSet(state: State): state is IFieldSet {
        return typeof state === 'object';
    }
}
