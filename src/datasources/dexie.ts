import { Driver, Collection as DriverCollection } from '../datasource';
import { Accessor } from '../accessor';
import { FieldMapping, State, NullablePrimitive, RichField } from '../state';
import { KeyPart } from '../types';
import { ErrorCode, Exception } from '../exceptions';
import { Collection, Dexie, Table, IndexableType } from 'dexie';
import { Filter, Operator, Template, Guards as CriteriaGuards, apply, PackedCriteria, expand } from '../criteria';
import { pickBy, mapValues, values, result } from 'lodash';

import getRegistry from '../registry';
import { DateTime } from 'luxon';
import { Guards as StateGuards } from '../state';
import { Config } from '../config';

interface DexieSchema {
    [name: string] : string[]
}

const drivers = getRegistry(Driver);
class DexieDriver extends Driver {
    dexie: Dexie = new Dexie("RUR");
    schema: DexieSchema;

    constructor(schema: DexieSchema) {
        super();
        this.schema = schema;
        this.dexie.version(1).stores(mapValues(schema, (key,value)=>['++id', ...value].join(',')));
    }

    getCollection(collectionName: string, config: Config) : DriverCollection {
        return new DexieCollection(this.dexie, collectionName, this.schema[collectionName]);
    }
}


type DexiePrimitives = string | number | Date 

interface DexieFieldMapping { 
    [filed: string] : DexiePrimitives | DexieFieldMapping
}

type DexieField = DexiePrimitives | DexieFieldMapping;

const Guards = {
    isPrimitive(field: DexieField) : field is DexiePrimitives {
        const type = typeof field;
        return (type === 'string' || type === 'number' || type === 'object' && field instanceof Date);
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

    private transformIn(record : DexieFieldMapping) : FieldMapping {
        const result : FieldMapping = {};
        for (const [key,value] of Object.entries(record)) {
            if (Guards.isPrimitive(value)) 
                result[key] = this.transformPrimitiveIn(value);
            else
                result[key] = this.transformIn(value);
        }
        return result;
    }

    private transformOut(record : FieldMapping) : DexieFieldMapping {
        const result : DexieFieldMapping = {};
        for (const [key,value] of Object.entries(record)) {
            if (StateGuards.isPrimitive(value)) 
                result[key] = this.transformPrimitiveOut(value);
            else {
                if (StateGuards.isRichField(value)) {
                    result[key] = this.transformOut(value.value as FieldMapping);
                } else {
                    result[key] = this.transformOut(value as FieldMapping);
                }
            }
        }
        return result;
    }


    addValue(record : FieldMapping) : Promise<KeyPart> {
        return this.table.add(this.transformOut(record)).then(key => key as number);
    }

    updateValue(record : FieldMapping, key : KeyPart) : Promise<void> {
            return this.table.update(key, this.transformOut(record)).then(
                count => {
                    if (count === 0) 
                        throw { code: ErrorCode.KEY_NOT_FOUND, message: `no record found for key ${key}`}
                }
            )
    };
    
    insertValue(record : FieldMapping, key : KeyPart) : Promise<void> {
        return this.table.put(this.transformOut(record), key).then(()=>{});
}    

    set(record : FieldMapping, key : KeyPart) : Promise<void> {
            return this.table.put(this.transformOut(record), key).then(()=>{});
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
            if (apply(data, filter)) result[key] = data;
        }).then(()=>result);
    }
}