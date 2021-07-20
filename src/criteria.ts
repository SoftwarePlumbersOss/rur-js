
import { DateTime } from 'luxon';
import { mapValues } from 'lodash';
import { Primitive, Field, FieldMapping, Guards as StateGuards } from './state';
import { Config, getConfig } from './config';
import { DataType, getDataType } from './datatype';
import { ReferenceBoundary } from './exceptions';

export const Guards = {

    isFilter(value: Primitive | Template | Filter) : value is Filter {
        const cast = value as Filter;
        return (cast && cast.operator !== undefined && typeof cast.operator ===  'object' && cast.value !== undefined && reverseMap[String(cast.operator)]) !== undefined;
    },

    isTemplate(value: Primitive | Template) : value is Template {
        return !StateGuards.isPrimitive(value as Primitive);
    },

    isPrimitive(value: Primitive | Template) : value is Primitive {
        return StateGuards.isPrimitive(value as Primitive);
    }

}

export enum Operator {
    GREATER_THAN = '>',
    GREATER_THAN_OR_EQUALS = '>=',
    LESS_THAN = '<',
    LESS_THAN_OR_EQUALS = '<=',
    MATCHES_TEMPLATE = "$matchestemplate",
    STARTS_WITH = "$startswith",
    EQUALS = "="
}

const reverseMap : { [index: string] : Operator } = {};

for (let [key,value] of Object.entries(Operator))
    reverseMap[value] = Operator[key as keyof typeof Operator]

export interface Filter {
    operator: Operator,
    value: Primitive | Template
}

export type Template  = { [field: string] : Filter }

export interface PackedCriteria { 
    [operator : string] : Primitive | PackedCriteria
}

export function expand(filter : PackedCriteria | Primitive , defaultOperator = Operator.EQUALS) : Filter {
    if (StateGuards.isPrimitive(filter)) {
        return { operator : defaultOperator, value: filter }
    } else {
        let keys = Object.keys(filter);
        if (keys.length === 1) {
            let operator = reverseMap[keys[0]];
            if (operator !== undefined) {
                return { operator, value: filter[keys[0]] as Primitive }
            }
        }        
        return { operator: Operator.MATCHES_TEMPLATE, value: mapValues(filter, sub => expand(sub, defaultOperator)) as Template };
    }
}

function comparator(a: Primitive, b: Primitive) {
    if (DateTime.isDateTime(a)) {
        const dateTimeB = DateTime.isDateTime(b) ? b : DateTime.fromISO(String(b));
        return a.diff(dateTimeB).toMillis();
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

export function apply(value : Field, filter : Filter, config? : Config) : boolean {

    const type = getDataType(value, config);

    switch (type) {
        case DataType.FIELDSET:
            if (filter.operator === Operator.MATCHES_TEMPLATE && Guards.isTemplate(filter.value)) {
                return Object.entries(filter.value).every(([field, filter])=> { 
                    return apply((value as FieldMapping)[field], filter, getConfig(config, field));
                });
            } else {
                return false;
            }
            break;
        case DataType.RECORDSET:
            return false; // relevant operators not supported yet
        case DataType.REFERENCE:
            throw new ReferenceBoundary(config as Config /* can only be a REFERENCE if config is defined*/);
        default:
            if (StateGuards.isPrimitive(value) && Guards.isPrimitive(filter.value)) {
                switch (filter.operator) {
                    case Operator.GREATER_THAN: return comparator(value, filter.value) > 0;
                    case Operator.GREATER_THAN_OR_EQUALS: return comparator(value, filter.value) >= 0;
                    case Operator.LESS_THAN: return comparator(value, filter.value) < 0;
                    case Operator.LESS_THAN_OR_EQUALS: return comparator(value, filter.value) <= 0;
                    case Operator.EQUALS: return comparator(value, filter.value) === 0;
                    case Operator.STARTS_WITH: return String(value).startsWith(String(filter.value));
                    case Operator.MATCHES_TEMPLATE: throw new TypeError(`attempt to pass a primitive value to a MATCHES_TEMPLATE`);
                    default:
                        throw new RangeError(`unsupported operator ${filter.operator}`)
                }    
            } else {
                return false;
            }
    }
}