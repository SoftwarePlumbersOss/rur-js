import { DateTime } from 'luxon';
import { PackedCriteria } from './criteria';
import { Sort } from './sort'
import { Exception } from './exceptions';

/** RUR Primitive Data Type
 * 
 * Defines the primitive fields which can be included in an RUR field mapping. This includes
 * strings, numbers, and luxon 'DateTime' objects.
 */
export  type Primitive = string | number | DateTime;

export  type NullablePrimitive = Primitive | null;

/** RUR Metadata Primitive
 * 
 * RUR metadata can include all the basic primitive data types, and also the 'Exception' data type.
 * 
 */
export type MetadataPrimitive = string | number | DateTime | Exception | undefined | null;

/** RUR Metadata
 * 
 * RUR Metadata is simply a mapping of a name to a primitive value.
 */
export type Metadata = { [ propName: string ] : MetadataPrimitive }

/** The Metadata Carrier interface
 * 
 * Some RUR objects can 'carry' the metadata for their children. This keeps the children themselves
 * quite simple, at the expense of making the parent object a little more complicated.
 * 
 */
export interface IMetadataCarrier {
    /** metadata associated with 'this' object */
    metadata: Metadata
    /** metadata associated with descendents of this object (if indexed by a string) */
    childMetadata? : { [childName: string]: IMetadataCarrier }
    /** metadata associated with descendednts of this object (if indexed by a number) */
    memberMetadata? : IMetadataCarrier[] 
}

export type ChildMetadata = IMetadataCarrier["childMetadata"]

/** Core RUR Object Type.
 * 
 * This interface defines the type of object which can be handled by the RUR reducer. A FieldMapping
 * is a mapping of a name to a primitive, a recordset, an array, or a child FieldMapping.
 * 
 */
export interface FieldMapping { 
    [ fieldName: string ] : NullablePrimitive | IRecordset | FieldMapping | (Primitive | FieldMapping)[]
}

export type Field = FieldMapping[string];

export type FieldArrayContent = Primitive | FieldMapping;

export type FieldArray = FieldArrayContent[]

export interface RichField extends IMetadataCarrier {
    value: Field
}

export interface Filter {
    keys: string[],
    criteria?: PackedCriteria,
    sort?: Sort
}

export type State = Field | RichField 
export interface IRecordset extends IMetadataCarrier {
    records: { [ key: string ] : State },
    filter?: Filter
}

export function toField(state: State) : Field {
    return Guards.isRichField(state) ? state.value : state; 
}

export class Guards {

    static isRichField(state?: State): state is RichField {
        const iRecord = state as RichField;
        return iRecord?.value !== undefined && iRecord?.metadata !== undefined;
    }

    static isIRecordset(state?: State): state is IRecordset {
        const iRecordset = state as IRecordset;
        return iRecordset?.records !== undefined && iRecordset?.metadata !== undefined;
    }

    static isIMetadataCarrier(state?: State): state is IMetadataCarrier & State {
        return Guards.isRichField(state) || Guards.isIRecordset(state);
    }

    static isArray(state?: State) : state is FieldArray {
        return Array.isArray(state);
    }

    static isString(state?: State): state is string {
        const type = typeof state;
        return (type === 'string');
    }

    static isReference(state?: State): state is string {
        const type = typeof state;
        return (type === 'string');
    }

    static isNumber(state?: State): state is number {
        const type = typeof state;
        return (type === 'number');
    }

    static isDateTime(state?: State): state is DateTime {
        return DateTime.isDateTime(state);
    }

    static isPrimitive(state?: State): state is Primitive {
        const type = typeof state;
        return (type === 'number' || type === 'string' || DateTime.isDateTime(state));
    }

    static isNullablePrimitive(state?: State): state is NullablePrimitive {
        return state === null || this.isPrimitive(state);
    }

    static isFieldMapping(state?: State) : state is FieldMapping {
        return typeof state === 'object' && !this.isIMetadataCarrier(state);
    }
}

