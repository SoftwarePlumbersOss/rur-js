import { DateTime } from 'luxon';

export  type Primitive = string | number | DateTime;

export type ChildMetadata = { [childName: string]: IMetadataCarrier };
export type Metadata = { [ propName: string ] : Primitive }
export interface IMetadata {
    metadata?: Metadata
}
export interface IMetadataCarrier extends IMetadata {
    childMetadata? : ChildMetadata    
}
export interface IAtom extends IMetadata {
    primitive: Primitive;
}

export type Atom = IAtom | Primitive;

export type Field = Atom | Recordset | FieldSet;

export type FieldMapping = { [ fieldName: string ] : Field }
export interface IFieldSet extends IMetadata {
    fields: FieldMapping
}

export type FieldSet = IFieldSet | FieldMapping

export interface IRecord extends IMetadataCarrier {
    value: Field
}

export type Record = IRecord | Primitive;

export interface IRecordset extends IMetadataCarrier {
    records: Record[]
}

export type Recordset = IRecordset | Record[]

export type State = Field | Record

export class Guards {

    static isIRecord(state: State | IMetadata): state is IRecord {
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

    static isIRecordset(state: State | IMetadata): state is IRecordset {
        return (state as IRecordset)?.records !== undefined;
    }

    static isRecordset(state: State): state is Recordset {
        return Guards.isIRecordset(state) || Array.isArray(state);
    }

    static isIFieldSet(state: State | IMetadata): state is IFieldSet {
        return (state as IFieldSet)?.fields !== undefined;
    }

    static isFieldSet(state: State): state is FieldSet {
        return Guards.isIFieldSet(state) || typeof state === 'object';
    }

    static isIAtom(state: State | IMetadata): state is IAtom {
        return (state as IAtom)?.primitive !== undefined;
    }    

    static isIMetadataCarrier(state: IMetadata): state is IMetadataCarrier {
        return Guards.isIRecord(state) || Guards.isIRecordset(state);
    }

    static isIMetadata(state: State) : state is IMetadata & State {
        return Guards.isIRecord(state) || Guards.isIRecordset(state) || Guards.isIFieldSet(state) || Guards.isIAtom(state)
    }
}
