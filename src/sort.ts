
import { DateTime } from 'luxon';
import { Primitive, Field, Guards as StateGuards } from './state';
import { Config, getConfig } from './config';
import { DataType, getDataType } from './datatype';
import { ReferenceBoundary } from './exceptions';
import { result } from 'lodash';

export const Guards = {
    isOrder(sort : Order | Sort) : sort is Order {
        return Order[sort as Order] !== undefined;
    },

    isSort(sort : Order | Sort) : sort is Sort {
        return !this.isOrder(sort);
    }
}

export enum Order {
    ASCENDING = 'ASCENDING',
    DESCENDING = 'DESCENDING'
}

export interface Sort {
    [field: string] : Order | Sort
}


function comparator(a: Primitive, b: Primitive) {
    // TODO:... add config as a parameter - will ensure stable sort.
    if (DateTime.isDateTime(a)) {
        const dateTimeB = DateTime.isDateTime(b) ? b : DateTime.fromISO(String(b));
        return a.diff(dateTimeB).seconds;
    } else {
        switch (typeof a) {
            case 'string':
                return a.localeCompare(String(b));
            case 'number':
                return a - Number(b);
            default:
                throw new TypeError(`unsupported type ${typeof a}` )
        }
    }
}

export function apply(a : Field, b: Field, sort : Order | Sort, config? : Config) : number {

    const type = getDataType(a, config);

    switch (type) {
        case DataType.FIELDSET:
            if (Guards.isSort(sort) && StateGuards.isFieldMapping(a) && StateGuards.isFieldMapping(b)) {
                let result = 0;
                for (let [field, order] of Object.entries(sort)) {
                    result = apply(a[field], b[field], sort[field], getConfig(config, field));
                    if (result !== 0) break;
                }                
                return result;
            } else {
                throw new TypeError('Incompatible types in sort');
            }
        case DataType.RECORDSET:
            throw new TypeError('cannot sort on a recordset field');
        case DataType.REFERENCE:
            throw new ReferenceBoundary(config as Config /* can only be a REFERENCE if config is defined*/);
        default:
            if (StateGuards.isPrimitive(a) && StateGuards.isPrimitive(b)) {
                switch (sort) {
                    case Order.ASCENDING: return comparator(a, b);
                    case Order.DESCENDING: return comparator(b, a);
                    default:
                        throw new RangeError(`unsupported order ${sort}`)
                }    
            } else {
                throw new TypeError('Incompatible types in sort');
            }
    }

}