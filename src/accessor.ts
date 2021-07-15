import { DataType, getDataType } from './datatype';
import { State, Guards as StateGuards, IRecordset, RichField, NullablePrimitive, Field, Metadata, IMetadataCarrier, FieldMapping, MetadataPrimitive, FieldArray, FieldArrayContent } from './state';
import { Config, getConfig } from './config';
import { ReferenceBoundary, Exception } from './exceptions';
import { Action, ActionType, MetadataAction, ValueAction, RowAction, MetadataValueAction, SearchAction } from './reducer';
import { Key, KeyPart } from './types';
import { PackedCriteria } from './criteria';
import getRegistry from "./registry"


function logReturn(name: string, value: any) : any {
    //console.log(`exiting ${name}`, value);
    return value;
}

function logEntry(name: string, ...value : any) {
    //console.log(`entering ${name}`, ...value);
}

export type DatumOut = NullablePrimitive | View | undefined;

export type DatumIn = Field | RichField

export class Guards {
    static isRichField(datum : DatumIn) : datum is RichField {
        const richDatum = datum as RichField;
        return richDatum.metadata !== undefined && richDatum.value !== undefined;
    }
}

export class View {
    protected accessor : Accessor;
    protected state : any;
    protected path : Key;

    constructor(accessor: Accessor, state : any, ...path : Key) {
        this.accessor = accessor;
        this.state = state;
        this.path = path;
    }

    get(...key : Key) : DatumOut {
        return this.accessor.getRoot(this.state, ...this.path, ...key);
    }

    getMetadata(...key : Key) : MetadataPrimitive | undefined {
        return this.accessor.getMetadata(this.state, ...this.path, ...key);
    }    

    keys() : Iterable<KeyPart> {
        return this.accessor.keys(this.state, ...this.path);
    }

    get key() : KeyPart {
        return this.path[this.path.length - 1];
    }
}

export type Calculator = (accessor : ((...key : Key) => NullablePrimitive | View | undefined), ...path : Key) => NullablePrimitive | undefined

export abstract class Accessor {

    protected parent?: Accessor

    constructor(parent? : Accessor) {
        this.parent = parent;
    }

    static keys(datum : DatumOut) : Iterable<KeyPart> {
        return (datum instanceof View) ? datum.keys() : [];
    }

    abstract get(state: any, ...key : Key) : DatumOut
    abstract getMetadata(state: any, ...key: Key) : MetadataPrimitive | undefined
    abstract getConfig(...key : Key) : Config | undefined
    abstract setParent(parent : Accessor) : Accessor;
    abstract keys(state: any, ...key: Key) : Iterable<KeyPart>;

    abstract set(value : DatumIn, ...key: Key) : ValueAction
    abstract setMetadata(value : MetadataPrimitive, ...key: Key) : MetadataValueAction
    abstract mergeMetadata(value : IMetadataCarrier, ...key: Key) : MetadataAction
    abstract insertValue(value : Field, ...key: Key) : ValueAction
    abstract removeValue(...key: Key) : Action
    abstract addValue(value : DatumIn, ...key: Key) : RowAction
    abstract updateValue(value : DatumIn, ...key: Key) : ValueAction
    abstract validate(metadata: IMetadataCarrier, ...key: Key) : MetadataAction
    abstract setError(Exception: Exception, ...key: Key) : MetadataAction
    abstract search(criteria : PackedCriteria, ...key: Key) : SearchAction

    getRoot(state : State, ...key : Key) : DatumOut {
        if (this.parent) 
            return this.parent.getRoot(state, ...key);
        else 
            return this.get(state, ...key);
    }

    getError(state: State, ...key: Key) : Exception | undefined {
        return this.getMetadata(state, ...key) as (Exception | undefined);
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

    keys(state: any, ...key : Key) : Iterable<KeyPart> {
        logEntry("BaseAccessor.keys", key);
        const base = this.getBaseState(state);
        let value : State | undefined;
        try {
            value = this.getState(state, base, this.config, ...key);
            const type = getDataType(value, getConfig(this.config, ...key));
            switch (type) {
                case DataType.RECORDSET:
                    const recordset = <IRecordset>value;
                    return recordset.filter?.keys ?? Object.keys(recordset.records);
                case DataType.ARRAY:
                    const array = <FieldArray>value;
                    return array.keys();
                case DataType.FIELDSET:
                    const fields = <FieldMapping>value;
                    return Object.keys(fields);
                default:
                    return [];                    
            }            
        } catch (err) {
            if (err instanceof ReferenceBoundary) {
                let registry = getRegistry(Accessor);
                let accessor;
                if (typeof err?.config?.recordset === 'string')
                    accessor = registry.resolve(err.config.recordset);
                else {
                    let name = err?.config?.recordset.name;
                    accessor = new BaseAccessor(err?.config?.recordset, ["recordset", name]);
                    registry.register(name, accessor);
                }
                return accessor.keys(state, ...err.key);
            } else {
                throw err;
            }
        }
    }


    getBaseState(state : any) : State {
        return this.basePath.reduce((state : any, part : string)=>state[part], state) as State;
    }
    
    getState(state : any, value : State, config? : Config, ...key : Key) : State | undefined {
        logEntry("getState", config, value, key);
        let result : State | undefined = value;
        if (key.length > 0) {
            const [head, ...tail] = key;
            const type = getDataType(value, config);
            switch (type) {
                case DataType.RECORDSET:
                    result = (value as IRecordset).records[head as string];
                    if (result !== undefined) {
                        if (StateGuards.isRichField(result)) result = result.value;
                        result = this.getState(state, result, getConfig(config, head), ...tail)
                    }
                    break;
                case DataType.ARRAY:
                    if (typeof head !== 'number') throw new TypeError('key for array must be a numbet');
                    const array = value as FieldArray;
                    result = this.getState(state, array[head], getConfig(config, head), ...tail);
                    break;
                case DataType.FIELDSET:
                    if (typeof head !== 'string') throw new TypeError('key for fieldset must be a string');
                    const fields = value as FieldMapping;
                    result = this.getState(state, fields[head], getConfig(config, head), ...tail);
                    break;
                case DataType.RECORD:
                    const record : Field = StateGuards.isRichField(value) ? value.value : value as FieldMapping
                    result = this.getState(state, record, config, ...key);
                    break;
                case DataType.REFERENCE:   
                    throw new ReferenceBoundary(config as Config /* unless config exists, we can't tell it's a reference */, value as string, ...key);
                default:
                    throw new TypeError(`State type ${type} does not have member for ${key.join('.')}`)

            }
        }
        return logReturn("getState", result);
    }

    getMetadataCarrier(state : any, value : State, config? : Config, ...key : Key) : { carrier: IMetadataCarrier, key : Key } | undefined {
        logEntry("getMetadataCarrier", config, value, key);
        let result = undefined;
        if (key.length > 0) {
            const [head, ...tail] = key;
            const type = getDataType(value, config);
            switch (type) {
                case DataType.RECORDSET:
                    let record = (value as IRecordset).records[head as string];
                    result = record ? this.getMetadataCarrier(state, record, getConfig(config, head), ...tail) : undefined
                    break;
                case DataType.FIELDSET:
                    if (typeof head !== 'string') throw new TypeError('key for fieldset must be a string');
                    const fields = value as FieldMapping;
                    result = this.getMetadataCarrier(state, fields[head], getConfig(config, head), ...tail);
                    break;
                case DataType.RECORD:
                    let field : Field = StateGuards.isRichField(value) ? value.value : value as FieldMapping
                    result = this.getMetadataCarrier(state, field, config, ...key);
                    break;
                case DataType.REFERENCE:   
                    throw new ReferenceBoundary(config as Config /* unless config exists, we can't tell it's a reference */, value as string, ...key);
                default:
                    throw new TypeError(`State type ${type} does not have member for ${key.join('.')}`)

            }
        } 
        if (!result && (StateGuards.isRichField(value) || StateGuards.isIRecordset(value))) {
            result = { carrier: value, key }
        }
        return logReturn("getMetadataCarrier", result);
    }    
    

    get(state : any, ...key : Key) : DatumOut {
        logEntry("BaseAccessor.get", key);
        const base = this.getBaseState(state);
        let value : State | undefined;
        try {
            value = this.getState(state, base, this.config, ...key);
            if (value === undefined) return undefined;
            let config = getConfig(this.config, ...key);
            let type = getDataType(value, config);
            let result : View | NullablePrimitive        
            switch (type) {
                case DataType.RECORDSET:
                case DataType.FIELDSET:
                case DataType.REFERENCE:
                case DataType.ARRAY:
                        result = new View(this, state, ...key);
                    break;
                default:
                    result = value as NullablePrimitive;
            }    
            return logReturn("BaseAccessor.get", result);
        } catch (err) {
            if (err instanceof ReferenceBoundary) {
                let registry = getRegistry(Accessor);
                let accessor;
                if (typeof err?.config?.recordset === 'string')
                    accessor = registry.resolve(err.config.recordset);
                else {
                    let name = err?.config?.recordset.name;
                    accessor = new BaseAccessor(err?.config?.recordset, ["recordset", name]);
                    registry.register(name, accessor);
                }
                return accessor.get(state, ...err.key);
            } else {
                throw err;
            }
        }
    }

    set(value: DatumIn, ...key : Key) : ValueAction {
        if (Guards.isRichField(value)) {
            return { ...value, type: ActionType.setValue, config: this.config, base: this.basePath, key };
        } else {
            return { type: ActionType.setValue, config: this.config, base: this.basePath, key, value };
        }
    }

    setMetadata(metaValue: MetadataPrimitive, ...key : Key) : MetadataValueAction {
        return { type: ActionType.setMetadata, config: this.config, base: this.basePath, key, metaValue } ;
    }

    setError(value: Exception, ...key : Key) : MetadataAction {
        return { type: ActionType.setMetadata, config: this.config, base: this.basePath, key, metadata: { error : value } };
    }    

    validate(value: IMetadataCarrier, ...key : Key) : MetadataAction {
        return { ...value, type: ActionType.validate, config: this.config, base: this.basePath, key };
    }

    mergeMetadata(metadata: IMetadataCarrier, ...key : Key) : MetadataAction {
        return { ...metadata, type: ActionType.mergeMetadata, config: this.config, base: this.basePath, key };
    }

    insertValue(value: Field, ...key : Key) : ValueAction {
        return { type: ActionType.insertValue, config: this.config, base: this.basePath, key, value };
    }

    removeValue(...key : Key) : Action {
        return { type: ActionType.delete, config: this.config, base: this.basePath, key };
    }

    addValue(row: FieldArrayContent, ...key : Key) : RowAction {
        return { type: ActionType.addValue, config: this.config, base: this.basePath, key, row };
    }

    updateValue(value: Field, ...key : Key) : ValueAction {
        return { type: ActionType.updateValue, config: this.config, base: this.basePath, key, value };
    }

    search(criteria : PackedCriteria, ...key : Key) : SearchAction {
        return { type: ActionType.search, config: this.config, base: this.basePath, key, criteria };
    }

    getConfig(...key : Key) : Config | undefined {
        return getConfig(this.config, ...key);
    }

    getMetadata(state : any, ...key : Key) : MetadataPrimitive | undefined {
        logEntry("BaseAccessor.getMetadata", key);
        if (key.length < 0) throw new RangeError('Metadata key must be nonzero length');
        const base = this.getBaseState(state);
        let result : MetadataPrimitive | undefined;
        try {
            const metadataParent = key.slice(0,-1);
            let carrier = this.getMetadataCarrier(state, base, this.config, ...metadataParent);
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

    set(value: NullablePrimitive, ...key : Key) : ValueAction {
        return this.accessor.set(value, ...key);
    }    

    keys(state : any, ...key : Key) : Iterable<KeyPart> {
        return this.accessor.keys(state, ...key);
    }


    setMetadata(value: MetadataPrimitive, ...key : Key) : MetadataValueAction {
        return this.accessor.setMetadata(value, ...key);
    }  

    setError(value: Exception, ...key: Key) : MetadataAction {
        return this.accessor.setError(value, ...key);

    }

    mergeMetadata(metadata: IMetadataCarrier, ...key : Key) : MetadataAction {
        return this.accessor.mergeMetadata(metadata, ...key);
    }      

    validate(metadata: IMetadataCarrier, ...key : Key) : MetadataAction {
        return this.accessor.validate(metadata, ...key);
    }      

    insertValue(value: Field, ...key : Key) : ValueAction {
        return this.accessor.insertValue(value, ...key);
    }  

    updateValue(value: Field, ...key : Key) : ValueAction {
        return this.accessor.updateValue(value, ...key);
    }  

    removeValue(...key : Key) : Action {
        return this.accessor.removeValue(...key);
    }  

    addValue(value: FieldArrayContent, ...key : Key) : RowAction {
        return this.accessor.addValue(value, ...key);
    }  

    search(criteria: PackedCriteria, ...key: Key) : SearchAction {
        return this.accessor.search(criteria, ...key);
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
        let result : NullablePrimitive | View | undefined = this.calculator((...k) => this.getRoot(state, ...k), ...key);
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