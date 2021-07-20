import { Driver, Collection as DriverCollection } from '../datasource';
import { Field, FieldArray, FieldArrayContent, FieldMapping, NullablePrimitive } from '../state';
import { KeyPart } from '../types';
import { ErrorCode } from '../exceptions';
import { Collection, Dexie, Table } from 'dexie';
import { Operator, Template, Guards as CriteriaGuards, apply, PackedCriteria, expand } from '../criteria';
import { mapValues } from 'lodash';

import { DateTime } from 'luxon';
import { Guards as StateGuards } from '../state';

export interface DexieSchema {
    [name: string] : string[]
}

export class DexieDriver extends Driver {
    dexie: Dexie;
    schema: DexieSchema;

    constructor(schema: DexieSchema) {
        super();
        this.schema = schema;
        this.dexie = new Dexie("RUR");
        const mappedSchema = mapValues(schema, (value)=>['++', ...value].join(','));
        this.dexie.version(1).stores(mappedSchema);
    }

    getCollection(collectionName: string) : DexieCollection {
        return new DexieCollection(this.dexie, collectionName, this.schema[collectionName]);
    }
}


type DexiePrimitives = string | number | Date

interface DexieFieldMapping { 
    [field: string] : DexieField
}

type DexieField = DexiePrimitives | DexieFieldMapping | DexieArray;

type DexieArray = DexieField[]

const Guards = {
    isPrimitive(field: DexieField) : field is DexiePrimitives {
        const type = typeof field;
        return (type === 'string' || type === 'number' || type === 'object' && field instanceof Date);
    },
    isArray(field: DexieField) : field is DexieArray {
        return Array.isArray(field);
    }    
}

export class DexieCollection extends DriverCollection {

    table: Table<DexieFieldMapping>;
    indexes: string[];

    constructor(dexie : Dexie , collectionName: string, indexes: string[]) {
        super();
        this.table = dexie.table(collectionName);
        this.indexes = indexes;
    }

    private transformPrimitiveOut(primitive : NullablePrimitive) : DexiePrimitives {
        switch (typeof primitive) {
            case 'object':
                if (DateTime.isDateTime(primitive))
                    return primitive.toJSDate();
                else
                    throw new TypeError('unrecognized primitive type');
            case 'string':
                return primitive;
            case 'number':
                return primitive;
            default:            
                throw new TypeError('unhandled primitive type');
        }
    }

    private transformPrimitiveIn(primitive : DexiePrimitives) : NullablePrimitive {
        switch (typeof primitive) {
            case 'object':
                if (primitive instanceof Date)
                    return DateTime.fromJSDate(primitive);
                else
                    throw new TypeError('unrecognized primitive type');
            case 'string':
                return primitive;
            case 'number':
                return primitive;
            case 'boolean':
                return primitive;
            default:            
                throw new TypeError('unhandled primitive type');
        }
    }    

    private transformArrayIn(array : DexieArray) : FieldArray {
        return array.filter(item => item !== null).map(item => this.transformIn(item) as FieldArrayContent);
    }

    private transformArrayOut(array : FieldArray) : DexieArray {
        return array.map(item => this.transformOut(item));
    }

    private transformFieldMappingIn(record : DexieFieldMapping) : FieldMapping {
        const result : FieldMapping = {};
        for (const [key,value] of Object.entries(record)) {
            result[key] = this.transformIn(value);
        }
        return result;
    }

    private transformFieldMappingOut(record : FieldMapping) : DexieFieldMapping {
        const result : DexieFieldMapping = {};
        for (const [key,value] of Object.entries(record)) {
            result[key] = this.transformOut(value);
        }
        return result;
    }

    private transformIn(value : DexieField) : Field {
        if (value === null) return value;
        if (Guards.isPrimitive(value)) 
            return this.transformPrimitiveIn(value);
        else if (Guards.isArray(value))
            return this.transformArrayIn(value);
        else
            return this.transformFieldMappingIn(value as DexieFieldMapping);
    }

    private transformOut(value : Field) : DexieField {
        if (value === null) throw new TypeError('value should not be null');
        if (StateGuards.isPrimitive(value)) 
            return this.transformPrimitiveOut(value);
        else if (StateGuards.isArray(value))
            return this.transformArrayOut(value);
        else {
            if (StateGuards.isRichField(value)) {
                return this.transformOut(value.value);
            } else {
                return this.transformFieldMappingOut(value as FieldMapping);
            }
        }
    }


    addValue(record : FieldMapping) : Promise<KeyPart> {
        return this.table.add(this.transformFieldMappingOut(record)).then(key => key as number);
    }

    updateValue(record : FieldMapping, key : KeyPart) : Promise<void> {
            return this.table.update(key, this.transformFieldMappingOut(record)).then(
                count => {
                    if (count === 0) 
                        throw { code: ErrorCode.KEY_NOT_FOUND, message: `no record found for key ${key}`}
                }
            )
    };
    
    insertValue(record : FieldMapping, key : KeyPart) : Promise<void> {
        return this.table.put(this.transformFieldMappingOut(record), key).then(()=>{});
}    

    set(record : FieldMapping, key : KeyPart) : Promise<void> {
            return this.table.put(this.transformFieldMappingOut(record), key).then(()=>{});
    }

    removeValue(key : KeyPart) : Promise<void> {
            return this.table.delete(key as string | number).then(
                () => {
                }
            );
    } 

    private findIndex(criteria : Template) : string  | undefined {
        return this.indexes.find(index => criteria[index] !== undefined);
    }
    
    load(key: KeyPart ) : Promise<FieldMapping> {
        const dexieKey = this.transformPrimitiveOut(key);
        return this.table.get(dexieKey).then(result => {
            if (result === undefined)
                throw { code: ErrorCode.KEY_NOT_FOUND, message: `no record found for key ${key}`};
            else
                return this.transformFieldMappingIn(result);
        });
    }

    search(criteria : PackedCriteria) : Promise<{[ key: string] : FieldMapping}> {
        const filter = expand(criteria);
        if (filter.operator !== Operator.MATCHES_TEMPLATE || !CriteriaGuards.isTemplate(filter.value)) throw new RangeError('must supply a template filter');
        const index = this.findIndex(filter.value);
        let collection : Collection;
        if (index) {
            const indexFilter = filter.value[index];
            if (CriteriaGuards.isPrimitive(indexFilter.value)) {
                const whereClause = this.table.where(index);
                const indexValue = this.transformPrimitiveOut(indexFilter.value);
                switch (indexFilter.operator) {
                    case Operator.EQUALS: collection = whereClause.equals(indexValue); break;
                    case Operator.LESS_THAN: collection = whereClause.below(indexValue); break;
                    case Operator.LESS_THAN_OR_EQUALS: collection = whereClause.belowOrEqual(indexValue); break;
                    case Operator.GREATER_THAN: collection = whereClause.above(indexValue); break;
                    case Operator.GREATER_THAN_OR_EQUALS: collection = whereClause.aboveOrEqual(indexValue); break;
                    case Operator.STARTS_WITH: collection = whereClause.startsWith(String(indexValue)); break;
                    default:
                        throw new RangeError(`unsupported operator type ${indexFilter.operator}`);
                }
            } else {
                collection = this.table.toCollection();
            }
        } else {
            collection = this.table.toCollection();
        }

        const result : {[ key: string] : FieldMapping} = {};

        return collection.each((row, cursor) => {                    
            const key = this.transformPrimitiveIn(cursor.primaryKey as string) as string;
            const data = this.transformIn(row);
            if (apply(data, filter)) result[key] = data as FieldMapping;
        }).then(()=>result);
    }

    removeAll() : Promise<void> {
        return this.table.clear();
    }
}