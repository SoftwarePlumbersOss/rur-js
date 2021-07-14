import { State, NullablePrimitive, Primitive, FieldArray, FieldArrayContent, Record, IRecord, IRecordset, Guards, FieldMapping, Field, IMetadataCarrier, ChildMetadata, Metadata, MetadataPrimitive, Filter as View } from './state';
import { Key, KeyPart } from './types';
import { DataType, getDataType } from './datatype';
import { Config, getConfig } from './config';
import { ReferenceBoundary } from './exceptions';
import { pickBy, mapValues, slice, filter, max } from 'lodash';
import { PackedCriteria, Filter, Guards as CriteriaGuards, expand, apply } from './criteria';
import { Sort, apply as applySort } from './sort'


export abstract class StateEditor<T extends State> {

    /** Get a direct child of this state element,
     * 
     * @param head 
     */
    abstract getChild(head: KeyPart): State;

    /** Get metadata for a direct child of this state element,
     * 
     * @param head 
     */
     abstract getChildMetadata(head: KeyPart): IMetadataCarrier | undefined;    

    /** Insert a new child
     * 
     * * For arrays, this inserts a child *at* the specified position, 
     *   moving subsequent children backward
     * * For recordsets and fieldset, inserts a new child with the specified key. 
     *   An error will be thrown if the key already exisits
     * * For primitives, throws an error.
     * 
     */
    abstract insertChild(head: KeyPart, child: State): this;

    /** Upsert a child
     * 
     * * For arrays, this updates the child *at* the specified position
     * * For recordsets and fieldset, updates the child with the specified key 
     *   or inserts a new child with the specified key
     * * For primitives, throws an error.
     * 
     */
     abstract setChild(head: KeyPart, child: State): this;    

    /** Delete a child
     * 
     * * For arrays, this deletes the child *at* the specified position, 
     *   moving subsequent children backward
     * * For recordsets and fieldsets, deletes child with the specified key. 
     *   An error will be thrown if the key does not exist
     * * For primitives, throws an error.
     * 
     */
     abstract deleteChild(head: KeyPart): this;


     abstract merge(state: T): this;
     abstract mergeMetadata(metadata: IMetadataCarrier): this;
     abstract replaceMetadata(metadata: IMetadataCarrier): this; 
 
     /** Get an editor for a child.
      * 
      * Editors provide a mutable facade to the immutable state objects.
      * They also provide a temporary place to store metadata when traversing the
      * tree, since metadata for a node may not always be stored at that node,
      * but in some higher node in the tree.
      * 
      */
     getEditor(head: KeyPart): StateEditor<State> {
        const childState = this.getChild(head);
        const childConfig = getConfig(this.getConfig(), head);
        const childMetadata = this.getChildMetadata(head);
        return edit(childConfig, childState, childMetadata);
    }

     /** Get the immutable state from this editor.  
      * 
      */
     abstract getState(): T;

     /** Get metadata from this editor.
      *
      * Gets any metadata logically related to the node, but not incorporated into
      * the State object. An example would be for a Primitive, which can't store
      * metadata for itself. The metadata for a primtive will typically be stored
      * in the enclosing form or record.
      */
    abstract getMetadata(): IMetadataCarrier;

    /** Get the configuration for this node
     * 
     * Configuration may be useful in determining the type of state represented by this
     * editor and its children.
     */
    abstract getConfig(): Config | undefined;
     
    /** Sets a value somewhere in the state tree.
     * 
     * equivalent to editAt(path.slice(0,-1), editor=>editor.setChild(path.slice(-1).pop(), value))
     * 
     * @param path 
     * @param value 
     */
    set(path: Key, value: State): this {
        if (path.length > 0)
            this.editAt(path.slice(0,-1), editor=>editor.setChild(path[path.length - 1], value))
        else
            throw new RangeError('key must have at least one element in it');
        return this;
    }

    /** Gets a value from somewhere in the state tree.
     * 
     * equivalent to find(path).getState()
     * 
     * @param path 
     * @param value 
     */    
    get(path: Key): State | undefined {
        return this.find(path)?.getState() as Field || undefined;
    }

    /** Get an editor for somewhere in the state tree.
     * 
     * Recursively invokes getEditor(KeyPart) to get a specific editor.  
     * 
     */
    find(path : Key) : StateEditor<State> | undefined {
        if (path.length === 0) return this;
        const [head, ...tail] = path;
        return this.getEditor(head).find(tail);
    }

    /** Convenience method equivalent to getDataType(this.getState(), this.getConfig()) 
     * 
     */
    getType() {
        return getDataType(this.getState(), this.getConfig())
    }

    /** Convenience method which returns a merge of this.getMetadata() with this.getState() 
     * 
     */
    getAllMetadata() {
        const state = this.getState();
        return (Guards.isIMetadataCarrier(state)) ? state : this.getMetadata();
    }

    /** Edit state data/metadata at some path in the tree.
     * 
     * @param path 
     * @param editOperation 
     * @returns 
     */
    editAt(path: Key, editOperation: (editor: StateEditor<State>) => void): this {
        if (path.length > 0) {
            const [head, ...tail] = path;
            let childEditor = this.getEditor(head);
            childEditor.editAt(tail, editOperation);
            this.setChild(head, childEditor.getState())
            let childMetadata = childEditor.getMetadata();
            if (childMetadata && !isEmpty(childMetadata)) {
                this.replaceMetadata(
                    prune(mergeIMetadataCarrier(
                        this.getAllMetadata(),
                        { metadata: {}, childMetadata: { [head]: childMetadata } }
                    ))
                );
            }
        } else {
            editOperation(this);
        }
        return this;
    }
    
    setMetadata(key: Key, value: MetadataPrimitive): this {
        if (key.length > 0) {
            let metadata = { metadata: { [key[key.length - 1]]: value } };
            return this.editAt(key.slice(0, -1), editor => editor.mergeMetadata(metadata))
        } else {
            throw new RangeError('key should have a length of at least 1');
        }
    }

    mergeMetadataAt(key: Key, value: IMetadataCarrier): this {
        return this.editAt(key, editor => editor.mergeMetadata(value));
    }

    getMetadataAt(key: Key): MetadataPrimitive {
        return this.find(key.slice(0,-1))?.getAllMetadata().metadata?.[key[key.length-1]];
    }

    searchAt(key: Key, criteria: PackedCriteria): this {
        return this.editAt(key, editor => {
            if (editor instanceof RecordsetEditor)
                editor.search(criteria);
            else
                throw new TypeError(`${key} does not refer to a recordset`);
        })
    }  

    sortAt(key: Key, sort : Sort): this {
        return this.editAt(key, editor => {
            if (editor instanceof RecordsetEditor)
                editor.sort(sort);
            else
                throw new TypeError(`${key} does not refer to a recordset`);
        })
    }  
    
    insertAt(key: Key, value: State): this {
        if (value === null) throw new TypeError('cannot insert a null field');
        if (key.length > 0) {
            let recordsetKey = key.slice(0, -1);
            return this.editAt(recordsetKey, editor => {
                editor.insertChild(key[key.length - 1], value);
            })
        } else {
            throw new RangeError('key should have a length of at least 1');
        }
    }

    addAt(key: Key, value: State): this {
        if (value === null) throw new TypeError('cannot insert a null field');
        return this.editAt(key, editor => {
            if (editor instanceof FieldArrayEditor) {
                editor.addChild(value);
            } else {
                throw new TypeError('attempted to invoke array add on a non-array');
            }
        })
    }

    deleteAt(key: Key): this {
        if (key.length > 0) {
            let recordsetKey = key.slice(0, -1);
            return this.editAt(recordsetKey, editor => {
                    editor.deleteChild(key[key.length - 1]);
            })
        } else {
            throw new RangeError('key should have a length of at least 1');
        }
    }

}

abstract class BaseStateEditor<T extends State> extends StateEditor<T> {
    protected state: T
    protected config?: Config

    constructor(config: Config | undefined, state: T) {
        super();
        this.config = config;
        this.state = state;
    }

    getState(): T {
        return this.state;
    }

    getConfig(): Config | undefined {
        return this.config;
    }

}

class FieldArrayEditor extends BaseStateEditor<FieldArray> {

    metadata: IMetadataCarrier;

    constructor(config : Config | undefined, state : FieldArray, metadata?: IMetadataCarrier) {
        super(config, state);
        this.metadata = metadata || { metadata: {} } ;
    }

    getChild(head: KeyPart): State {
        return this.state[head as number];
    }

    getChildMetadata(head: KeyPart): IMetadataCarrier | undefined {
        return this.metadata?.memberMetadata?.[head as number];
    }

    getMetadata(): IMetadataCarrier {
        return this.metadata;
    }

    replaceMetadata(metadata: IMetadataCarrier): this {
        this.metadata = metadata;
        return this;
    }
    
    insertChild(head: KeyPart, child: State): this {
        const index = head as number;
        this.state = [ ...this.state.slice(0,index), child as FieldArrayContent, ...this.state.slice(index) ];
        return this;
    }
 
    addChild(child: State) : this {
        this.state = [ ...this.state, child as FieldArrayContent ];
        return this;
    }

    setChild(head: KeyPart, child: State): this {
        const index = head as number;
        this.state = [ ...this.state.slice(0,index), child as FieldArrayContent, ...this.state.slice(index+1) ];
        return this;
    }
 
    deleteChild(head: KeyPart): this {
        const index = head as number;
        this.state = [ ...this.state.slice(0,index), ...this.state.slice(index+1) ];
        return this;
    }

    mergeMetadata(metadata: IMetadataCarrier): this {
        let sourceMemberMetadata = metadata.memberMetadata;
        if (sourceMemberMetadata) {
            // this isn't quite the null operation it seems to be. Often just results
            // in the child metadata being merged back to this editor. However if a descendent
            // is actually an IMetadataCarrier, that metadata will stick to the descendent rather
            // than being merged back here
            for (let i = 0; i < sourceMemberMetadata.length; i++) {
                const child = sourceMemberMetadata[i];
                this.editAt([i], editor => editor.mergeMetadata(child))
            }
            // now merge any non-child metadata
            this.metadata = mergeIMetadataCarrier(this.metadata, { metadata: metadata.metadata });
        } else {
            // there's no child metadata supplied, so just merge without any fuss
            this.metadata = mergeIMetadataCarrier(this.metadata, metadata);
        }
        return this;
    }

    mergeElements(a: FieldArray, b: FieldArray) : FieldArray {        
        const length = Math.max(a.length, b.length);
        let result : FieldArray = [];
        for (let i = 0; i < length; i++) {
            if (a[i] != null && b[i] != null) 
                result.push(edit(this.config?.value, a[i]).merge(b[i]).getState())
            else if (b[i] === undefined && a[i] != null) // the === is deliberate so that if b[i] === null nothing gets pushed
                result.push(a[i]);
            else if (a[i] == null && b[i] != null) 
                result.push(b[i]);
        }        
        return result;
    }

    merge(array: FieldArray): this {
        const length = Math.max(this.state.length, array.length);
        let result : FieldArray = [];
        for (let i = 0; i < length; i++) {
            if (this.state[i] != null && array[i] != null) {
                let editor = edit(this.config?.value, this.state[i]).merge(array[i]);
                result.push(editor.getState());
            }
            else if (this.state[i] === undefined && array[i] != null) // the === is deliberate so that if b[i] === null nothing gets pushed
                result.push(this.state[i]);
            else if (this.state[i] == null && array[i] != null) 
                result.push(array[i]);
        }        
        this.state = result;
        return this;
    }
}

class ViewEditor {

    private expandedCriteria? : Filter;
    private config? : Config;
    private state : View;
    private allRecords : { [ key: string ] : Record };

    constructor(config : Config | undefined, state: View, allRecords: { [ key: string ] : Record }) {
        this.state = state;
        this.config = config;
        this.allRecords = allRecords;
        this.expandedCriteria = state.criteria && expand(state.criteria);
    }

    private filterRow(record: Record) : boolean {
        if (this.expandedCriteria !== undefined) {
            if (Guards.isIRecord(record)) {
                return apply(record.value, this.expandedCriteria, this.config?.value);
            } else {
                return apply(record, this.expandedCriteria, this.config?.value);
            }
        } else {
            return true;
        }
    }

    private compareRows(a: Record, b: Record) : number {
        if (this.state.sort) {
            let fieldA =  Guards.isIRecord(a) ? a.value : a;
            let fieldB = Guards.isIRecord(b) ? b.value : b;
            return applySort(fieldA, fieldB, this.state.sort, this.config?.value);
        } else {
            return 0;
        }
    }

    updateRow(key: string, value: Record /* record must already be merged with any existing data*/) : ViewEditor {
        if (!this.state.criteria || this.filterRow(value)) {
            let keys = this.state.keys;
            let index = keys.indexOf(key);
            if (index >= 0) {
                if (this.state.sort) {
                    /** Argh, the position of the row in the sort may have changed. So find the new position */
                    let insertIndex = keys.findIndex(key => this.compareRows(this.allRecords[key], value) > 0);
                    const delta = insertIndex < index ? 1 : -1; // This determines which way records shift in the order
                    keys = keys.map((k, i) => {
                        if (i === insertIndex) return key; // insert the record at its new positon
                        if (i < insertIndex && i < index || i > insertIndex && i > index) return k; // copy unaffected records
                        return keys[i + delta] // shift any records we need to shift
                    });
                } else {
                    // No sort, so just update the record
                    keys = keys.map((k, i) => i === index ? key : k);
                }
            } else {
                throw new RangeError('index out of range');
            }
            this.state = { ...this.state, keys };
        } else {
            // Do nothing, there is a criteria and the row does not match it
        }
        return this;
    }

    insertRow(key: string, value: Record /* record must already be merged with any existing data*/) : ViewEditor {
        if (!this.state.criteria || this.filterRow(value)) {
            let keys = this.state.keys;
            if (this.state.sort) {
                let index = keys.findIndex(key => this.compareRows(this.allRecords[key], value) > 0);
                this.state = { ...this.state, keys: [ ...keys.slice(0, index), key, ...keys.slice(index) ] };
            } else {
                this.state = { ...this.state, keys: [ ...keys, key ]}
            }
        } else {
            // Do nothing, there is a criteria and the row does not match it
        }
        return this;
    }    

    setRow(key: string, value: Record /* record must already be merged with any existing data*/) : ViewEditor {
        if (!this.state.criteria || this.filterRow(value)) {
            let keys = this.state.keys;
            if (keys.indexOf(key) >= 0) {
                this.updateRow(key, value);
            } else {
                this.insertRow(key, value);
            }
        } else {
            // Do nothing, there is a criteria and the row does not match it
        }
        return this;
    }       

    removeRow(key: string) : ViewEditor {
        let index = this.state.keys.indexOf(key);
        if (index >= 0)
            this.state = { ...this.state, keys: [ ...this.state.keys.slice(0, index), ...this.state.keys.slice(index + 1) ] };
        return this;
    } 

    sort(sort: Sort) : ViewEditor {
        this.state = { ...this.state, sort };
        this.state = { ...this.state,  keys: this.state.keys.sort((a,b) => this.compareRows(this.allRecords[a],this.allRecords[b])) } 
        return this;
    }

    search(criteria: PackedCriteria) : ViewEditor {
        this.expandedCriteria = expand(criteria);
        this.state = { ...this.state, criteria, keys: this.state.keys.filter(key => this.filterRow(this.allRecords[key])) };
        return this;
    }

    setData(records : { [key: string] : Record}) {
        this.allRecords = records;
        let keys = Object.keys(records);
        if (this.expandedCriteria) keys = keys.filter(key => this.filterRow(records[key]));
        if (this.state.sort) keys = keys.sort((a,b)=>this.compareRows(records[a],records[b]));
        this.state = { ...this.state, keys };
    }

    getState() : View {
        return this.state;
    }
}

class RecordsetEditor extends BaseStateEditor<IRecordset> {

    private getViewEditor(view? : View) : ViewEditor {
        return new ViewEditor(
            getConfig(this.config, "value"), 
            this.state.filter || { keys: Object.keys(this.state.records) },
            this.state.records
        );
    }

    insertChild(head: KeyPart, record: Record): this {
        const key = head as string;
        if (this.state.records[key] !== undefined) throw new RangeError('attempt to insert with key that exists');
        return this.setChild(key, record);
    }

    setChild(head: KeyPart, record: Record): this {
        let recordset = this.state;
        let view = recordset.filter;
        const key = head as string;
        if (view) {
            const editor = this.getViewEditor(view);
            view = editor.setRow(key, record).getState();
        }
        this.state = {
            ...recordset,
            records: { ...recordset.records, [key]: record },
            filter: view
        }
        return this;
    }    

    deleteChild(head: KeyPart): this {
        let view = this.state.filter;
        if (view) {
            const viewEditor = this.getViewEditor(view);
            view = viewEditor.removeRow(head as string).getState();
        }
        let { [head] : _drop, ...records } = this.state.records;
        this.state = {
            ...this.state,
            filter: view,
            records
        };
        return this;
    }

    getChild(key: KeyPart): Record {
        return this.state.records[key as string];
    }

    getChildMetadata(head: KeyPart): IMetadataCarrier | undefined {
        return this.state.childMetadata?.[head as string];
    }

    search(criteria: PackedCriteria) : RecordsetEditor {
        this.state = { ...this.state, filter: this.getViewEditor(this.state.filter).search(criteria).getState() } 
        return this;
    }

    sort(sort: Sort) : RecordsetEditor {
        this.state = { ...this.state, filter: this.getViewEditor(this.state.filter).sort(sort).getState() } 
        return this;
    }

    getEditor(head: KeyPart): StateEditor<State> {
        // A recordset child is always a Record, regardless of what the config says.
        // This is to avoid too many redundant layers in the state/config, basically
        // a Record is just a holder for whatever is in it, but it 'owns' the metadata
        const childState = this.getChild(head);
        const childConfig = getConfig(this.config, head);
        return new RecordEditor(childConfig, childState as Record);
    }

    mergeMetadata(metadata: IMetadataCarrier): this {
        if (isEmpty(metadata)) return this;
        // we don't merge child metadata as every record should be a metadata carrier, so there should be none
        this.state = prune({ ...this.state, metadata: { ...this.state.metadata, ...metadata.metadata } })
        return this;
    }

    replaceMetadata(carrier: IMetadataCarrier): this {
        let { metadata } = carrier;
        // we don't replace child metadata as every record should be a metadata carrier, so there should be none
        this.state = { ...this.state, metadata }
        return this;
    }    

    mergeRecords(a: { [ key: string] : Record }, b: { [ key: string] : Record }) : { [ key: string] : Record } {

        let result = { ...a }

        for (const [key,record] of Object.entries(b)) {
                if (record !== null) {
                    if (a[key]) {
                        result[key] = new RecordEditor(this.config?.value, a[key]).merge(record).getState();
                    } else {
                        result[key] = record;
                    }
                } else {
                    delete result[key];
                }
        }

        return result;

    }

    merge(recordset: IRecordset): this {
        let mergedMetadata: IMetadataCarrier;
        let records: { [key: string] : Record};

        mergedMetadata = mergeIMetadataCarrier(this.state, recordset);
        records = this.mergeRecords(this.state.records, recordset.records);

        this.state = { ...this.state, ...mergedMetadata, records }

        return this;
    }

    getMetadata() : IMetadataCarrier {
        return { metadata: {} }
    }
}

class PrimitiveEditor extends BaseStateEditor<NullablePrimitive> {

    metadata: IMetadataCarrier;

    constructor(config: Config | undefined, state: NullablePrimitive, metadata = {} as IMetadataCarrier) {
        super(config, state);
        this.metadata = metadata;
    }

    getChild(head: KeyPart): Primitive {
        if (this.getType() === DataType.REFERENCE)
            throw new ReferenceBoundary(this.config as Config, head);
        else
            throw new TypeError(`no element ${head} in ${this.getType()}`);    
    }

    getChildMetadata(head: KeyPart): IMetadataCarrier | undefined {
        if (this.getType() === DataType.REFERENCE)
            throw new ReferenceBoundary(this.config as Config, head);
        else
            throw new TypeError(`no element ${head} in ${this.getType()}`);    
    }

    insertChild(head: KeyPart, child: Primitive): this {
        if (this.getType() === DataType.REFERENCE)
            throw new ReferenceBoundary(this.config as Config, head);
        else
            throw new TypeError(`no element ${head} in ${this.getType()}`);    
    }

    deleteChild(head: KeyPart): this {
        if (this.getType() === DataType.REFERENCE)
            throw new ReferenceBoundary(this.config as Config, head);
        else
            throw new TypeError(`no element ${head} in ${this.getType()}`);    
    }

    setChild(head: KeyPart, child: Primitive): this {
        if (this.getType() === DataType.REFERENCE)
            throw new ReferenceBoundary(this.config as Config, head);
        else
            throw new TypeError(`no element ${head} in ${this.getType()}`);    
    }

    mergeMetadata(metadata: IMetadataCarrier): this {
        this.metadata = mergeIMetadataCarrier(this.metadata, metadata);
        return this;
    }

    replaceMetadata(metadata: IMetadataCarrier): this {
        this.metadata = metadata;
        return this;
    }

    merge(primitiveB: NullablePrimitive): this {
        if (primitiveB !== undefined) this.state = primitiveB;
        return this;
    }

    getMetadata(): IMetadataCarrier {
        return this.metadata;
    }
}

class RecordEditor extends StateEditor<Record> {

    valueEditor: StateEditor<Field>;

    constructor(config: Config | undefined, state: Record) {
        super();
        if (Guards.isIRecord(state)) {
            let { value, ...metadata } = state;
            this.valueEditor = edit(config, value, metadata) as StateEditor<Field>;
        } else {
            this.valueEditor = edit(config, state) as StateEditor<Field>;
        }
    }

    getChild(head: KeyPart): Field {
        return this.valueEditor.getChild(head) as Field;
    }

    getChildMetadata(head: KeyPart): IMetadataCarrier | undefined {
        return this.valueEditor.getChildMetadata(head);
    }

    insertChild(head: KeyPart, child: Field): this {
        this.valueEditor.insertChild(head, child); 
        return this;
    }

    setChild(head: KeyPart, child: Field): this {
        this.valueEditor.setChild(head, child); 
        return this;
    }    

    deleteChild(head: KeyPart): this {
        this.valueEditor.deleteChild(head); 
        return this;
    }    

    set(path: Key, value: Field): this {
        this.valueEditor.set(path, value);
        return this;
    }

    get(path: Key): State | undefined {
        return this.valueEditor.get(path);
    }

    getEditor(head: KeyPart): StateEditor<State> {
        return this.valueEditor.getEditor(head);
    }

    getState(): Record {
        let metadata = this.valueEditor.getMetadata();
        if (metadata && !isEmpty(metadata)) {
            return {
                ...metadata,
                value: this.valueEditor.getState()
            }
        } else {
            return this.valueEditor.getState() as Record;
        }

    }

    getMetadata(): IMetadataCarrier {
        return { metadata: {} }
    }

    getConfig(): Config | undefined {
        return this.valueEditor.getConfig();
    }

    mergeMetadata(metadata: IMetadataCarrier): this {
        if (isEmpty(metadata)) return this;
        this.valueEditor.mergeMetadata(metadata);
        return this;
    }

    replaceMetadata(metadata: IMetadataCarrier): this {
        this.valueEditor.replaceMetadata(metadata);
        return this;
    }

    merge(record: Record): this {
        if (Guards.isIRecord(record)) {
            this.valueEditor.merge(record.value);
            this.mergeMetadata(record);
        } else {
            this.valueEditor.merge(record);
        }
        return this;
    }
}

class FieldMappingEditor extends BaseStateEditor<FieldMapping> {


    metadata: IMetadataCarrier;

    constructor(config: Config | undefined, state: FieldMapping, metadata = {} as IMetadataCarrier) {
        super(config, state);
        this.metadata = metadata;
    }

    insertChild(head: KeyPart, value: Field): this {
        if (this.state[head] === undefined) throw new RangeError('attempt to insert field with existing key');
        return this.setChild(head, value);
    }

    setChild(head: KeyPart, value: Field): this {
        this.state = { ...this.state, [head]: value } as FieldMapping;
        return this;
    }

    deleteChild(head: KeyPart): this {
        const { [head] : _drop, ...state } = this.state;
        this.state = state;
        return this;
    }    

    getChild(head: KeyPart): Field {
        return this.state[head]; 
    }

    getChildMetadata(head: KeyPart): IMetadataCarrier | undefined {
        return this.metadata?.childMetadata?.[head]
    }

    replaceMetadata(metadata: IMetadataCarrier): this {
        this.metadata = metadata;
        return this;
    }

    private static createFieldsetFromMetadata(config: Config, metadata: IMetadataCarrier) {
        let sourceChildMetadata = ((metadata as IMetadataCarrier).childMetadata);
        if (sourceChildMetadata?.length) {
            let childState: FieldMapping = {};
            let childMetadata: ChildMetadata = {};
            for (const childName of Object.keys(sourceChildMetadata)) {
                let childResult = FieldMappingEditor.createStateFromMetadata(config, sourceChildMetadata[childName]);
                if (childResult.state) childState[childName] = childResult.state as Field;
                if (childResult.metadata) childMetadata[childName] = childResult.metadata;
            }
            return {
                state: childState,
                metadata: { metadata: metadata.metadata, childMetadata } as IMetadataCarrier
            }
        } else {
            return { metadata }
        }
    }

    private static createStateFromMetadata(config: Config, metadata: IMetadataCarrier): { state?: State, metadata?: IMetadataCarrier } {
        switch (config.type) {
            case DataType.RECORDSET:
                return { state: { ...metadata, records: {} } } // we don't merge record data
            case DataType.FIELDSET:
                return FieldMappingEditor.createFieldsetFromMetadata(config, metadata);
            default:
                if (metadata.childMetadata)
                    return FieldMappingEditor.createFieldsetFromMetadata(config, metadata);
                else
                    return { metadata }
        }
    }

    mergeMetadata(metadata: IMetadataCarrier): this {
        let sourceChildMetadata = metadata.childMetadata;
        if (sourceChildMetadata) {
                // If mergeForward is set we have to assume that the supplied metadata may contain
                // child metadata for metadata carriers which are children of this field mapping -
                // for example a recordset which is a field
                for (const fieldName of Object.keys(sourceChildMetadata)) {
                    const child = sourceChildMetadata[fieldName];
                    this.editAt([fieldName], editor => editor.mergeMetadata(child))
                }
                this.metadata = mergeIMetadataCarrier(this.metadata, { metadata: metadata.metadata });
        } else {
            this.metadata = mergeIMetadataCarrier(this.metadata, metadata);
        }
        return this;
    }

    merge(fieldsetB: FieldMapping): this {
        let merged: FieldMapping = {};
        for (const fieldName of new Set([...Object.keys(this.state), ...Object.keys(fieldsetB)])) {
            let childEditor = this.getEditor(fieldName);
            childEditor.merge(fieldsetB[fieldName]);
            let child = childEditor.getState();
            if (child) merged[fieldName] = child as Field;
        }
        this.state = merged;
        return this;
    }

    getMetadata(): IMetadataCarrier {
        return this.metadata;
    }
}

function prune<T extends IMetadataCarrier> (state : T) : T {
    return { 
        ...state, 
        metadata: pickBy(state.metadata, (v,k) => v!==null), 
        childMetadata: pickBy(mapValues(state.childMetadata, prune), (v,k) => v!==null)
    };
}

function mergeIMetadataCarrier(a = {} as IMetadataCarrier, b = {} as IMetadataCarrier): IMetadataCarrier {
    let childMetadata: { [index: string]: IMetadataCarrier } | undefined;
    if (a.childMetadata === undefined) childMetadata = b.childMetadata;
    if (b.childMetadata === undefined) childMetadata = a.childMetadata;
    if (a.childMetadata !== undefined && b.childMetadata !== undefined) {
        childMetadata = { ...a.childMetadata, ...b.childMetadata };
        for (const field of Object.keys(childMetadata)) {
            if (a.childMetadata[field] && b.childMetadata[field])
                childMetadata[field] = mergeIMetadataCarrier(a.childMetadata[field], b.childMetadata[field]);

        }
    }
    return {
        metadata: { ...a.metadata, ...b.metadata },
        childMetadata
    }
}

function isEmpty(carrier: IMetadataCarrier) {
    return (carrier?.metadata === undefined || Object.keys(carrier.metadata).length === 0) && (carrier?.childMetadata === undefined || Object.keys(carrier.childMetadata).length === 0)
}

export function edit<T extends State>(config?: Config, state?: T, metadata?: IMetadataCarrier): StateEditor<T> {
    const type = getDataType(state, config);
    switch (type) {
        case DataType.RECORDSET: return new RecordsetEditor(config, <IRecordset> state) as unknown as StateEditor<T>;
        case DataType.RECORD: return new RecordEditor(config, <Record>state) as unknown as StateEditor<T>;
        case DataType.FIELDSET: return new FieldMappingEditor(config, <FieldMapping>state, metadata) as unknown as StateEditor<T>;
        case DataType.ARRAY: return new FieldArrayEditor(config, <FieldArray>state, metadata) as unknown as StateEditor<T>;
        case DataType.STRING:
        case DataType.REFERENCE:
        case DataType.NUMBER:
        case DataType.DATETIME: return new PrimitiveEditor(config, <NullablePrimitive>state, metadata) as unknown as StateEditor<T>;
        default:
            throw new TypeError(`unhandled type ${type}`);
    }
}


