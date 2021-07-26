import { DataType, getDataType } from '../datatype';
import { State, Guards as StateGuards, IRecordset, RichField, NullablePrimitive, Field, Metadata, IMetadataCarrier, FieldMapping, MetadataPrimitive, FieldArray, FieldArrayContent } from '../state';
import { Config, getConfig } from '../config';
import { ReferenceBoundary, Exception } from '../exceptions';
import { Action, ActionType, MetadataAction, ValueAction, RowAction, MetadataValueAction, SearchAction } from './reducer';
import { Key, KeyPart, Guards as KeyGuards } from '../types';
import { PackedCriteria } from '../criteria';
import getRegistry from "../registry"
import { ThunkAction, ThunkDispatch } from 'redux-thunk';
import { getBasePath } from '../reducer';

export type AsyncAction<T extends Action> = ThunkAction<Promise<void>, any, undefined, T>;
export type AddAction = ThunkAction<Promise<KeyPart>, any, undefined, RowAction>;
export type Dispatch = ThunkDispatch<any, undefined, any>;

function logReturn(name: string, value: any) : any {
    //console.log(`exiting ${name}`, value);
    return value;
}

function logEntry(name: string, ...value : any) {
    //console.log(`entering ${name}`, ...value);
}

/** Represents possible return values from a 'get' operation on an accessor */
export type DatumOut = NullablePrimitive | View | undefined;

/** Represents possible input values for a 'set' operation on an accessor */
export type DatumIn = Field | RichField

export class Guards {
    static isRichField(datum : DatumIn) : datum is RichField {
        const richDatum = datum as RichField;
        return richDatum.metadata !== undefined && richDatum.value !== undefined;
    }
}

/** Represents a live view over some aggregate (...Recordset, Array, or FieldMapping).
 * 
 * 'get' operations on an accessor return a primitive (string, number, DateTime) or a View. This preserves
 * the immutablilty of the underlying state, since set operations on a view return dispatchable actions
 * rather than directly mutating the state,
 * 
 */
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

    set(value : DatumIn, ...key: Key) : ValueAction | AsyncAction<ValueAction> {
        return this.accessor.set(value, ...this.path, ...key);
    }

    keys() : Iterable<KeyPart> {
        return this.accessor.keys(this.state, ...this.path);
    }

    get key() : KeyPart {
        return this.path[this.path.length - 1];
    }
}

/** A Calculator function can be used to add calculated fields to an accessor */
export type Calculator = (accessor : ((...key : Key) => NullablePrimitive | View | undefined), ...path : Key) => NullablePrimitive | undefined

/** A Validator function can be used to add custom validations to an accessor */
export type Validator = (accessor : DatumOut, ...path : Key) => IMetadataCarrier | Metadata | undefined

/** The main Accessor class.
 * 
 * Accessors are used to represent immutable state data in a recomposable manner:
 * 
 * accessor.get(state, "recordA", "fieldB") returns the value of fieldB in record A from the state
 * accessor.get("recordA").get("fieldB").get(state) returns the same thing.
 * accessor.set("jonathan","recordA","fieldB") returns a dispatchable action to set the value of field B to "jonathan"
 * accessor.get("recordA").set("jonathan","fieldB") returns the same thign.
 * 
 * Thus an accessor can be used by a parent control to pass both state and the actions required to update
 * that state to some child control.
 */
export abstract class Accessor {

    protected parent?: Accessor

    constructor(parent? : Accessor) {
        this.parent = parent;
    }

    static keys(datum : DatumOut) : Iterable<KeyPart> {
        return (datum instanceof View) ? datum.keys() : [];
    }

    /** Get method.
     * 
     * if state is provided, a View on an aggregate data item or a Primitive. Otherwise an accessor which can retrieve that item given state.
     * 
     * Fundamentally, get(state, ...path) === get(...path).get(state)
     * 
     * @param state the redux state OR the first KeyPart in a key
     * @param key a number of key parts specifying a path to some data item
     * @return a View on an aggregate data item or a Primitive, OR an accessor which can retrieve the same thing.
     */
    abstract get(head: KeyPart, ...tail: Key) : Accessor;
    abstract get(state: any, ...key : Key) : DatumOut
    abstract get(state: any, ...key : Key) : DatumOut | Accessor;

    abstract getMetadata(state: any, ...key: Key) : MetadataPrimitive | undefined
    abstract getConfig(...key : Key) : Config | undefined
    abstract setParent(parent : Accessor) : Accessor;
    abstract keys(state: any, ...key: Key) : Iterable<KeyPart>;

    /** Set method.
     * 
     * Create a dispatchable action which updates the data at some path. Should be an 'upsert' operation, in
     * that a new data item should be created at that point in the path if one does not previously exist.
     * 
     * Fundamentally, set(state, ...path) === get(...path).set(state)
     * 
     * Errors can be handled two ways. For Async actions, the action may ultimately reject the returned promise with an
     * error (which should typically conform to the Exception interface defined in this module). For synchronous
     * actions, getMetadata(state, ...path, "error") should return an object conforming to the Exception
     * interface if some error occurred during the processing of a set(state, ...path) action.
     * 
     * @param value a new value to be stored at the given location
     * @param key a number of key parts specifying a path to some data item
     * @return an action which may be dispatched to perform the update.
     */    
    abstract set(value : DatumIn, ...key: Key) : ValueAction | AsyncAction<ValueAction>
    abstract setMetadata(value : MetadataPrimitive, ...key: Key) : MetadataValueAction
    abstract mergeMetadata(value : IMetadataCarrier, ...key: Key) : MetadataAction

    /** Insert method.
     * 
     * Similar to set, except specifically creates a new value and for map-like items (Recordsets and FieldMappings)
     * it should fail (updating error metadata or rejecting a promise) where an item already exists at the location
     * indicated by the last KeyPart in the key.
     * 
     * For an array, it will insert an item at the location specified by the final KeyPart, expanding the size of the
     * array.
     * 
     * @param value a new value to be stored at the given location
     * @param key a number of key parts specifying a path to some data item
     * @return an action which may be dispatched to perform the update.
     */
    abstract insertValue(value : Field, ...key: Key) : ValueAction | AsyncAction<ValueAction>  
    abstract removeValue(...key: Key) : Action | AsyncAction<Action>

    /** Add method for new array items and other aggregate items supporting auto-generated keys.
     * 
     * Adds an item to an aggregate. Key specifies the aggregate to which we are adding the new item. This
     * should always work for an array (it will add the item to the end of the array and return the index
     * of the new item). May throw a TypeError for other types of collection; it depends on whether the
     * collection supports auto-generation of keys. 
     * 
     * Dispatching this action will return a promise that resolves to the new key value.
     * 
     * @param value a new value to be stored in the aggregate item
     * @param key a number of key parts specifying a path to an aggregate item
     * @return an action which may be dispatched to perform the update, which will return a promise resolving to the new key value
     */
    abstract addValue(value : DatumIn, ...key: Key) : AddAction

    /** Update method.
     * 
     * Similar to set, except specifically updates and existing value and should fail (updating error metadata 
     * or rejecting a promise) where an item does not already exist at the location indicated by the last KeyPart 
     * in the key.
     * 
     * @param value a new value to be stored at the given location
     * @param key a number of key parts specifying a path to some data item
     * @return an action which may be dispatched to perform the update.
     */
    abstract updateValue(value : DatumIn, ...key: Key) : ValueAction | AsyncAction<ValueAction>

    /** Merge method.
     * 
     * Similar to set, except merges data where a previous record exists with the same key
     * 
     * @param value a new value to be merged at the given location
     * @param key a number of key parts specifying a path to some data item
     * @return an action which may be dispatched to perform the update.
     */
     abstract mergeValue(value : DatumIn, ...key: Key) : ValueAction | AsyncAction<ValueAction>    

    /** Validate a data item at the given location
     * 
     * @param key a number of key parts specifying a path to some data item
     * @return an action which may be dispatched to perform the validation. 
     */
    abstract validate(...key: Key) : Action | AsyncAction<Action>

    abstract setError(Exception: Exception, ...key: Key) : MetadataAction
    abstract search(criteria : PackedCriteria, ...key: Key) : SearchAction | AsyncAction<SearchAction>

    getRoot(state : State, ...key : Key) : DatumOut {
        if (this.parent) 
            return this.parent.getRoot(state, ...key);
        else 
            return this.get(state, ...key);
    }

    getError(state: State, ...key: Key) : Exception | undefined {
        return this.getMetadata(state, ...key) as (Exception | undefined);
    }   


    addCalculatedFields(calculator : Calculator) : Accessor {
        return new CalculatedFieldsAccessor(this, calculator);
    }
}


 export class BaseAccessor extends Accessor {

    protected config : Config
    basePath: string[]

    constructor(config : Config, basePath? : string[], parent? : Accessor) {
        super(parent);
        this.config = config;
        this.basePath = basePath ?? config.basePath ?? [ config.name ];
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
        const fullPath = [ ...getBasePath(), 'data', ...this.basePath ];
        return fullPath.reduce((state : any, part : string)=>state[part], state) as State;
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
    
    get(head: KeyPart, ...tail : Key) : Accessor;
    get(state : any, ...key : Key) : DatumOut;
    get(stateOrHead : any, ...key : Key) : DatumOut | Accessor {
        if (KeyGuards.isKeyPart(stateOrHead)) {
            const head = stateOrHead;
            return new PathAccessor(this, [stateOrHead, ...key]);
        } else {
            const state = stateOrHead;
            logEntry("BaseAccessor.get", key);
            const base = this.getBaseState(state) ?? { records: {}, metadata: {} }; 
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

    validate(...key : Key) : Action {
        return { type: ActionType.validate, config: this.config, base: this.basePath, key };
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

    addValue(row: FieldArrayContent, ...key : Key) : AddAction {
        return (dispatch : Dispatch, getState: ()=>any) => {
            dispatch({ type: ActionType.addValue, config: this.config, base: this.basePath, key, row });
            const state = getState();
            return Promise.resolve((this.getState(state, this.getBaseState(state), this.getConfig(), ...key) as FieldArray).length-1);
        }
    }

    updateValue(value: Field, ...key : Key) : ValueAction {
        return { type: ActionType.updateValue, config: this.config, base: this.basePath, key, value };
    }

    mergeValue(value: Field, ...key : Key) : ValueAction {
        return { type: ActionType.mergeValue, config: this.config, base: this.basePath, key, value };
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

    get(head: KeyPart, ...tail : Key) : Accessor;
    get(state : any, ...key : Key) : DatumOut;
    get(stateOrHead : any, ...key : Key) : DatumOut | Accessor {
        return this.accessor.get(stateOrHead, ...key);
    }

    set(value: DatumIn, ...key : Key) : ValueAction | AsyncAction<ValueAction> {
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

    validate(...key : Key) : Action | AsyncAction<Action> {
        return this.accessor.validate(...key);
    }      

    insertValue(value: Field, ...key : Key) : ValueAction | AsyncAction<ValueAction> {
        return this.accessor.insertValue(value, ...key);
    }  

    updateValue(value: Field, ...key : Key) : ValueAction | AsyncAction<ValueAction> {
        return this.accessor.updateValue(value, ...key);
    }  

    mergeValue(value: Field, ...key : Key) : ValueAction | AsyncAction<ValueAction> {
        return this.accessor.updateValue(value, ...key);
    }

    removeValue(...key : Key) : Action | AsyncAction<Action> {
        return this.accessor.removeValue(...key);
    }  

    addValue(value: FieldArrayContent, ...key : Key) : AddAction {
        return this.accessor.addValue(value, ...key);
    }  

    search(criteria: PackedCriteria, ...key: Key) : SearchAction | AsyncAction<SearchAction> {
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

    get(head: KeyPart, ...tail : Key) : Accessor;
    get(state : any, ...key : Key) : DatumOut;
    get(stateOrHead : any, ...key : Key) : DatumOut | Accessor {
        if (KeyGuards.isKeyPart(stateOrHead)) {
            return this.accessor.get(stateOrHead, ...key);
        } else {
            const state = stateOrHead;
            let result : NullablePrimitive | View | undefined = this.calculator((...k) => this.getRoot(state, ...k), ...key);
            if (result === undefined) result = this.accessor.get(stateOrHead, ...key);
            return result;
        }
    }

    setParent(parent : Accessor) {
        return new CalculatedFieldsAccessor(this.accessor, this.calculator, parent);
    }
}

export class ValidatingAccessor extends DelegatingAccessor {

    validator : Validator

    constructor(accessor : Accessor, validator : Validator, parent? : Accessor) {
        super(accessor, parent);
        this.validator = validator;
    }

    validate(...key : Key) : AsyncAction<Action> {
        return (dispatch : Dispatch, getState : () => any) => {
            let metadata = this.validator(this.get(getState(), ...key), ...key);
            if ((metadata as any)?.metadata) {
                dispatch(this.accessor.mergeMetadata(metadata as IMetadataCarrier))
            } else if (metadata) {
                dispatch(this.accessor.mergeMetadata({ metadata : metadata as Metadata}))
            } else {
                dispatch(this.accessor.validate(...key));
            }
            return Promise.resolve();
        }
    }      

    setParent(parent : Accessor) {
        return new ValidatingAccessor(this.accessor, this.validator, parent);
    }
}

export class PathAccessor extends DelegatingAccessor {

    path: Key

    constructor(accessor : Accessor, path : Key, parent?: Accessor) {
        super(accessor, parent)
        this.path = path;
    }
    
    get(head: KeyPart, ...tail : Key) : Accessor;
    get(state : any, ...key : Key) : DatumOut;
    get(stateOrHead : any, ...key : Key) : DatumOut | Accessor {    
        return this.accessor.get(stateOrHead, ...this.path, ...key);
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