import { DataType, getDataType } from './datatype';
import { State, Guards as StateGuards, Recordset, Record, Primitive, Field, IRecord, IRecordset, IFieldSet, IMetadata } from './state';
import { Config, getConfig } from './config';
import { ActionType } from './reducer';
import { ReferenceBoundary } from './exceptions';
import { AnyAction } from 'redux';
import getRegistry from "./registry"


function logReturn(name: string, value: any) : any {
    //console.log(`exiting ${name}`, value);
    return value;
}

function logEntry(name: string, ...value : any) {
    //console.log(`entering ${name}`, ...value);
}

export function getRow(state : Recordset, index : number) : Record {
    if (StateGuards.isIRecordset(state)) {
        return state.records[index];
    } else {
        return state[index];
    } 
}

export function getRowByKey(state: Recordset, key : Primitive) : Record | undefined {
    if (StateGuards.isIRecordset(state)) {
        return state.records.find(row => StateGuards.isIRecord(row) ? row.metadata?.key === key : row === key);
    } else {
        return state.find(row => StateGuards.isIRecord(row) ? row.metadata?.key === key : row === key);
    } 
}

export type KeyPart = string | number;

export type Key = KeyPart[];

type Datum = Primitive | Proxy | undefined;

class Proxy implements Iterable<Datum> {
    protected accessor : Accessor;
    protected state : any;
    protected path : Key;

    constructor(accessor: Accessor, state : any, ...path : Key) {
        this.accessor = accessor;
        this.state = state;
        this.path = path;
    }

    get(...key : Key) : Datum {
        return this.accessor.getRoot(this.state, ...this.path, ...key);
    }

    getMetadata(...key : Key) : Primitive | undefined {
        return this.accessor.getMetadata(this.state, ...this.path, ...key);
    }    

    getIndex() {
        return this.path[this.path.length - 1] as number;
    }

    [Symbol.iterator]() : Iterator<Datum> {
        return {
            next(value?: any) {
                return {
                    done: true,
                    value: undefined
                }
            }
        }
    }
}

class Slice extends Proxy {

    protected from : number
    protected to : number

    constructor(accessor: Accessor, state : any, from: number, to: number, ...path : Key) {
        super(accessor, state, ...path);
        this.from = from;
        this.to = to;
    }

    [Symbol.iterator]() : Iterator<Datum> {
        let index = this.from;
        const _this = this;
        return {
            next(value? : any) {
                if (_this.to > index) {
                    const current = index++;
                    return {
                        done: false,
                        value: _this.accessor.getRoot(_this.state, ..._this.path, current)
                    }
                } else {
                    return {
                        done: true,
                        value: undefined
                    };
                }
            }
        }
    }
}

export type Calculator = (accessor : ((...key : Key) => Primitive | Proxy | undefined), ...path : Key) => Primitive | undefined

export abstract class Accessor {

    protected parent?: Accessor

    constructor(parent? : Accessor) {
        this.parent = parent;
    }

    abstract get(state: any, ...key : Key) : Datum
    abstract getMetadata(state: any, ...key: Key) : Primitive | undefined
    abstract getConfig(...key : Key) : Config
    abstract setParent(parent : Accessor) : Accessor;
    abstract set(value : Primitive, ...key: Key) : AnyAction
    abstract setMetadata(value : Primitive, ...key: Key) : AnyAction
    abstract insertValue(value : Record, ...key: Key) : AnyAction
    abstract removeValue(...key: Key) : AnyAction
    abstract addValue(value : Record, ...key: Key) : AnyAction

    getRoot(state : State, ...key : Key) : Datum {
        if (this.parent) 
            return this.parent.getRoot(state, ...key);
        else 
            return this.get(state, ...key);
    }

    getAccessor(...key : Key) : Accessor {
        return key.length > 0 ? new PathAccessor(this, key) : this;
    }

    addCalculatedFields(calculator : Calculator) : Accessor {
        return new CalculatedFieldsAccessor(this, calculator);
    }
}


/** Get data from a recordset
 * 
 * get will return one of three things:
 * 
 * * A primitive value
 * * An object on which get(...keys) can be called
 * * An iterable over objects on which get(...keys) can be called
 * 
 * The specified keys may be strings (a field name or the key of a value in a collection) or numbers
 * (the index of a value in a collection)
 * 
 * @param {*} config 
 * @param {*} collection 
 * @param  {...string | number} key 
 * @returns 
 */
 export class BaseAccessor extends Accessor {

    config : Config
    basePath: string[]

    constructor(config : Config, basePath : string[], parent? : Accessor) {
        super(parent);
        this.config = config;
        this.basePath = basePath;
    }

    setParent(parent: Accessor) {
        return new BaseAccessor(this.config, this.basePath, parent);
    }

    getBaseState(state : any) : State {
        return this.basePath.reduce((state : any, part : string)=>state[part], state) as State;
    }
    
    getState(state : any, config : Config, value : State, ...key : Key) : State | undefined {
        logEntry("getState", config, value, key);
        let result : State | undefined = value;
        if (key.length > 0) {
            const [head, ...tail] = key;
            const type = getDataType(value, config);
            switch (type) {
                case DataType.RECORDSET:
                    result = (typeof head === 'number') ? getRow(value as Recordset, head) : getRowByKey(value as Recordset, head);
                    if (result !== undefined) {
                        if (StateGuards.isIRecord(result)) result = result.value;
                        result = this.getState(state, getConfig(config, head), result, ...tail)
                    }
                    break;
                case DataType.FIELDSET:
                    if (typeof head !== 'string') throw new TypeError('key for fieldset must be a string');
                    result = this.getState(state, getConfig(config, head), (value as IFieldSet)[head], ...tail);
                    break;
                case DataType.RECORD:
                    let record : Field = StateGuards.isIRecord(value) ? value.value : value
                    result = this.getState(state, config, record, ...key);
                    break;
                case DataType.REFERENCE:   
                    throw new ReferenceBoundary(config, value as string, ...key);
                default:
                    throw new TypeError(`State type ${type} does not have member for ${key.join('.')}`)

            }
        }
        return logReturn("getState", result);
    }

    getMetadataCarrier(state : any, config : Config, value : State, ...key : Key) : { carrier: IMetadata, key : Key } | undefined {
        logEntry("getMetadataCarrier", config, value, key);
        let result = undefined;
        if (key.length > 0) {
            const [head, ...tail] = key;
            const type = getDataType(value, config);
            switch (type) {
                case DataType.RECORDSET:
                    if (typeof head === 'number')
                        result = this.getMetadataCarrier(state, getConfig(config, head), getRow(value as Recordset, head), ...tail)
                    else {
                        let record = getRowByKey(value as Recordset, head);
                        result = record ? this.getMetadataCarrier(state, getConfig(config, head), record, ...tail) : undefined
                    }
                    break;
                case DataType.FIELDSET:
                    if (typeof head !== 'string') throw new TypeError('key for fieldset must be a string');
                    result = this.getMetadataCarrier(state, getConfig(config, head), (value as IFieldSet)[head], ...tail);
                    break;
                case DataType.RECORD:
                    let record : Field = StateGuards.isIRecord(value) ? value.value : value
                    result = this.getMetadataCarrier(state, config, record, ...key);
                    break;
                case DataType.REFERENCE:   
                    throw new ReferenceBoundary(config, value as string, ...key);
                default:
                    throw new TypeError(`State type ${type} does not have member for ${key.join('.')}`)

            }
        } 
        if (!result && (StateGuards.isIRecord(value) || StateGuards.isIRecordset(value))) {
            result = { carrier: value, key }
        }
        return logReturn("getMetadataCarrier", result);
    }    
    

    get(state : any, ...key : Key) : Datum {
        logEntry("BaseAccessor.get", key);
        const base = this.getBaseState(state);
        let value : State | undefined;
        try {
            value = this.getState(state, this.config, base, ...key);
            if (value === undefined) return undefined;
            let config = getConfig(this.config, ...key);
            let type = getDataType(value, config);
            let result : Proxy | Primitive        
            switch (type) {
                case DataType.RECORDSET:
                    let recordset = value as Recordset;
                    let length : number = StateGuards.isIRecordset(recordset) ? recordset.records.length : recordset.length;
                    result = new Slice(this, state, 0, length, ...key);
                    break;
                case DataType.FIELDSET:
                case DataType.REFERENCE:
                    result = new Proxy(this, state, ...key);
                    break;
                default:
                    result = value as Primitive;
            }    
            return logReturn("BaseAccessor.get", result);
        } catch (err) {
            if (err instanceof ReferenceBoundary) {
                let registry = getRegistry(Accessor);
                let accessor;
                if (typeof err.config.recordset === 'string')
                    accessor = registry.resolve(err.config.recordset);
                else {
                    let name = err.config.recordset.name;
                    accessor = new BaseAccessor(err.config.recordset, ["recordset", name]);
                    registry.register(name, accessor);
                }
                return accessor.get(state, ...err.key);
            } else {
                throw err;
            }
        }
    }

    set(value: Primitive, ...key : Key) : AnyAction {
        return { type: ActionType.setValue, config: this.config, base: this.basePath, key, value };
    }

    setMetadata(value: Primitive, ...key : Key) : AnyAction {
        return { type: ActionType.setMetadata, config: this.config, base: this.basePath, key, value };
    }

    insertValue(record: Record, ...key : Key) : AnyAction {
        return { type: ActionType.insertValue, config: this.config, base: this.basePath, key, record };
    }

    removeValue(...key : Key) : AnyAction {
        return { type: ActionType.removeValue, config: this.config, base: this.basePath, key };
    }

    addValue(record: Record, ...key : Key) : AnyAction {
        return { type: ActionType.addValue, config: this.config, base: this.basePath, key, record };
    }

    getConfig(...key : Key) : Config {
        return getConfig(this.config, ...key);
    }

    getMetadata(state : any, ...key : Key) : Primitive | undefined {
        logEntry("BaseAccessor.getMetadata", key);
        if (key.length < 0) throw new RangeError('Metadata key must be nonzero length');
        const base = this.getBaseState(state);
        let result : Primitive | undefined;
        try {
            const metadataParent = key.slice(0,-1);
            let carrier = this.getMetadataCarrier(state, this.config, base, ...metadataParent);
            if (carrier !== undefined) {
                let metadataKey = carrier.key;
                let child = metadataKey.reduce((carrier : any, part : KeyPart)=>carrier?.childMetadata && carrier.childMetadata[part], carrier.carrier);
                result = child?.metadata && child.metadata[key[key.length-1]];
            }
        } catch (err) {
            if (err instanceof ReferenceBoundary) {
                let registry = getRegistry(Accessor);
                let accessor = registry.resolve(err.name);
                if (!accessor && err.config) {
                    accessor = new BaseAccessor(err.config, ["recordset", err.name]);
                    registry.register(err.name, accessor);
                }
                result = accessor.getMetadata(state, ...err.key);
            } else {
                throw err;
            }
        }
        return logReturn("BaseAccessor.getMetadata", result);
    }
}

export abstract class DelegatingAccessor extends Accessor {

    accessor : Accessor

    constructor(accessor : Accessor, parent?: Accessor) {
        super(parent);
        this.accessor = accessor.setParent(this);
    }

    get(state : any, ...key : Key) {
        return this.accessor.get(state, ...key);
    }

    set(value: Primitive, ...key : Key) : AnyAction {
        return this.accessor.set(value, ...key);
    }    

    setMetadata(value: Primitive, ...key : Key) : AnyAction {
        return this.accessor.setMetadata(value, ...key);
    }  

    insertValue(value: Record, ...key : Key) : AnyAction {
        return this.accessor.insertValue(value, ...key);
    }  

    removeValue(...key : Key) : AnyAction {
        return this.accessor.removeValue(...key);
    }  

    addValue(value: Record, ...key : Key) : AnyAction {
        return this.accessor.addValue(value, ...key);
    }  

    getConfig(...key : Key) {
        return this.accessor.getConfig(...key);
    }

    getMetadata(state: any, ...key : Key) {
        return this.accessor.getMetadata(state, ...key);
    }    
}

export class CalculatedFieldsAccessor extends DelegatingAccessor {

    calculator : Calculator

    constructor(accessor : Accessor, calculator : Calculator, parent? : Accessor) {
        super(accessor, parent);
        this.calculator = calculator;
    }

    get(state : any, ...key : Key) {
        let result : Primitive | Proxy | undefined = this.calculator((...k) => this.getRoot(state, ...k), ...key);
        if (result === undefined) result = this.accessor.get(state, ...key);
        return result;
    }

    setParent(parent : Accessor) {
        return new CalculatedFieldsAccessor(this.accessor, this.calculator, parent);
    }
}

export class PathAccessor extends DelegatingAccessor {

    path: Key

    constructor(accessor : Accessor, path : Key, parent?: Accessor) {
        super(accessor, parent)
        this.path = path;
    }
    
    get(state : any, ...key : Key) {
        return this.accessor.get(state, ...this.path, ...key);
    }

    getConfig(...key : Key) {
        return this.accessor.getConfig(...this.path, ...key);
    }

    getMetadata(state : any, ...key : Key) {
        return this.accessor.getMetadata(state, ...this.path, ...key);
    }      

    getRoot(state : any, ...key : Key) {
        if (this.parent) {
            if (key.length >= this.path.length && this.path.every((element,index)=>element === key[index]))
                return this.parent.getRoot(state, ...key.slice(this.path.length));
            else
                return this.accessor.get(state, ...key);
        } else {
            return this.accessor.get(state, ...key);
        }
    }

    setParent(parent : Accessor) {
        return new PathAccessor(this.accessor, this.path, parent);
    }    
}