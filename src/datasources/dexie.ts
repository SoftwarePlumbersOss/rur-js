import { Dispatch, DataSource, DatasourceAction } from '../datasource';
import { Accessor } from '../accessor';
import { FieldMapping, Record, NullablePrimitive, Field } from '../state';
import { Key, KeyPart } from '../types';
import { ErrorCode, Exception } from '../exceptions';
import { Collection, Dexie, Table, IndexableType } from 'dexie';
import { Filter, Operator, Template, Guards as CriteriaGuards, apply, PackedCriteria, expand } from '../criteria';
import { pickBy } from 'lodash';

import getRegistry from '../registry';
import { DateTime } from 'luxon';
import { Guards as StateGuards } from '../state';

interface DexieSchema {
    [name: string] : string
}

const schema : DexieSchema = {};

const databases = getRegistry(Dexie);

databases.registerFactory("dexieDatabase", _databaseName=>{
    const dexie = new Dexie("dexieDatabase");
    dexie.version(1).stores(schema);
    return dexie;
});

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

export class DexieDatasource extends DataSource {

    collectionName: string;

    constructor(collectionName: string, accessor : Accessor) {
        super(accessor);
        this.collectionName = collectionName;
        schema[collectionName] = ["++id", ...accessor.getConfig()?.indexes].join(',');
    }

    private getTable() : Table<DexieFieldMapping> {
        return databases.resolve("dexieDatabase").table(this.collectionName);
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
                if (StateGuards.isIRecord(value)) {
                    result[key] = this.transformOut(value.value as FieldMapping);
                } else {
                    result[key] = this.transformOut(value as FieldMapping);
                }
            }
        }
        return result;
    }


    addRecord(record : FieldMapping) : DatasourceAction {
        return (dispatch: Dispatch, getState) => {
            return this.getTable().add(this.transformOut(record)).then(
                key => {
                    dispatch(this.accessor.addValue({ value: record, metadata: { key: key as number } }));
                    const exception = this.accessor.getError(getState())
                    if (exception)
                        return Promise.reject(exception);
                    else
                        return Promise.resolve();
                }
            )
        };
    }

    updateRecord(record : Record, key? : KeyPart) : DatasourceAction {
        const table = databases.resolve("dexieDatabase").table(this.collectionName);
        const crecord = this.expand(record, key);
        if (crecord.metadata.key === undefined) return this.setError({ code: ErrorCode.KEY_REQUIRED, message: 'attempted to update a record with no key' });
        return (dispatch: Dispatch, getState) => {
            return table.update(crecord.metadata.key, this.transformOut(crecord.value as FieldMapping)).then(
                count => {
                    if (count === 0) return 
                        this.setError({ code: ErrorCode.KEY_NOT_FOUND, message: `no record found for key ${crecord.metadata.key}`})
                    dispatch(this.accessor.updateValue(crecord, crecord.metadata.key as string | number));
                    const exception = this.accessor.getError(getState())
                    if (exception)
                        return Promise.reject(exception);
                    else
                        return Promise.resolve();
                }
            )
        };
    }

    upsertRecord(record : Record, key? : KeyPart) : DatasourceAction {
        const table = databases.resolve("dexieDatabase").table(this.collectionName);
        const crecord = this.expand(record, key);
        if (crecord.metadata.key === undefined) return this.setError({ code: ErrorCode.KEY_REQUIRED, message: 'attempted to update a record with no key' });
        return (dispatch: Dispatch, getState) => {
            return table.put(this.transformOut(crecord.value as FieldMapping) as FieldMapping, crecord.metadata.key as string | number).then(
                key => {
                    dispatch(this.accessor.upsertValue(crecord, key as number));
                    const exception = this.accessor.getError(getState())
                    if (exception)
                        return Promise.reject(exception);
                    else
                        return Promise.resolve();
                }
            )
        };
    }

    removeRecord(key : KeyPart) : DatasourceAction {
        const table = databases.resolve("dexieDatabase").table(this.collectionName);
        return (dispatch: Dispatch, getState) => {
            return table.delete(key as string | number).then(
                () => {
                    dispatch(this.accessor.removeValue(key));
                    const exception = this.accessor.getError(getState())
                    if (exception)
                        return Promise.reject(exception);
                    else
                        return Promise.resolve();
                }
            )
        };
    } 

    private findIndex(criteria : Template) : string  | undefined {
        const indexes : string[] = this.getConfig()?.indexes || [];
        return indexes.find(index => criteria[index] !== undefined);
    }


    
    search(criteria : PackedCriteria) : DatasourceAction {
        const filter = expand(criteria);
        if (filter.operator !== Operator.MATCHES_TEMPLATE || !CriteriaGuards.isTemplate(filter.value)) throw new RangeError('must supply a template filter');
        const index = this.findIndex(filter.value);
        let table = databases.resolve("dexieDatabase").table(this.collectionName);
        let collection : Collection;
        if (index) {
            const indexFilter = filter.value[index];
            if (CriteriaGuards.isPrimitive(indexFilter.value)) {
            const whereClause = table.where(index);
            const indexValue = this.transformPrimitiveOut(indexFilter.value);
            switch (indexFilter.operator) {
                case Operator.EQUALS: collection = whereClause.equals(indexValue); break;
                case Operator.LESS_THAN: collection = whereClause.below(indexValue); break;
                case Operator.LESS_THAN_OR_EQUALS: collection = whereClause.belowOrEqual(indexValue); break;
                case Operator.GREATER_THAN: collection = whereClause.above(indexValue); break;
                case Operator.GREATER_THAN_OR_EQUALS: collection = whereClause.aboveOrEqual(indexValue); break;
                case Operator.STARTS_WITH: collection = collection = whereClause.startsWith(String(indexValue)); break;
                default:
                    throw new RangeError(`unsupported operator type ${indexFilter.operator}`);
            }
            collection.and(row => apply(row, filter));
        } else
            collection = table.filter(row => apply(row, filter));
        }

        return (dispatch: Dispatch, getState) => {
            return collection.each((row, cursor) => {                    
                const key = this.transformPrimitiveIn(cursor.primaryKey as string) as string;
                dispatch(this.accessor.upsertValue({ value: this.transformIn(row), metadata: { key } }, key))
            })
        };        
    }
}