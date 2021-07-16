import { State, Guards as StateGuards, Field, IMetadataCarrier, MetadataPrimitive, FieldArray, FieldArrayContent, IRecordset, Filter as View } from '../state';
import { Key, KeyPart } from '../types';
import { getDataType } from '../datatype';
import { Config, getConfig } from '../config';
import { PackedCriteria } from '../criteria';
import { Sort } from '../sort'
import { MetadataEditor } from './metadata';
import { edit, editRecord } from './factory';
import { Guards } from './guards';
import { ViewEditor } from './view';

// Note: I'd love to break this into separate files for each class, but there a cyclic dependency since
// the edit function in factory needs to be able to create instances of all different subtypes of StateEditor and the
// subclasses in here all use the factory. I was not able to resolve the issues created by this. Gosh, the javascript
// ecosystem sucks quite badly sometimes.

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
        return (StateGuards.isIMetadataCarrier(state)) ? state : this.getMetadata();
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
            if (childMetadata && !MetadataEditor.isEmpty(childMetadata)) {
                this.replaceMetadata(
                    MetadataEditor
                        .edit(this.getAllMetadata())
                        .merge({ metadata: {}, childMetadata: { [head]: childMetadata } })
                        .prune()
                        .getState()                
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
            if (Guards.isRecordsetEditor(editor))
                editor.search(criteria);
            else
                throw new TypeError(`${key} does not refer to a recordset`);
        })
    }  

    sortAt(key: Key, sort : Sort): this {
        return this.editAt(key, editor => {
            if (Guards.isRecordsetEditor(editor))
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

    mergeAt(key: Key, value: State): this {
        return this.editAt(key, editor => editor.merge(value));
    }

    addAt(key: Key, value: State): this {
        if (value === null) throw new TypeError('cannot insert a null field');
        return this.editAt(key, editor => {
            if (Guards.isFieldArrayEditor(editor)) {
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

export abstract class BaseStateEditor<T extends State> extends StateEditor<T> {
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

export class FieldArrayEditor extends BaseStateEditor<FieldArray> {

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
            this.metadata = MetadataEditor.edit(this.metadata).merge({ metadata: metadata.metadata }).prune().getState();
        } else {
            // there's no child metadata supplied, so just merge without any fuss
            this.metadata = MetadataEditor.edit(this.metadata).merge(metadata).prune().getState();
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

export class RecordEditor extends StateEditor<State> {

    valueEditor: StateEditor<Field>;

    constructor(config: Config | undefined, state: State) {
        super();
        if (StateGuards.isRichField(state)) {
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

    getState(): State {
        let metadata = this.valueEditor.getMetadata();
        if (metadata && !MetadataEditor.isEmpty(metadata)) {
            return {
                ...metadata,
                value: this.valueEditor.getState()
            }
        } else {
            return this.valueEditor.getState() as State;
        }

    }

    getMetadata(): IMetadataCarrier {
        return { metadata: {} }
    }

    getConfig(): Config | undefined {
        return this.valueEditor.getConfig();
    }

    mergeMetadata(metadata: IMetadataCarrier): this {
        if (MetadataEditor.isEmpty(metadata)) return this;
        this.valueEditor.mergeMetadata(metadata);
        return this;
    }

    replaceMetadata(metadata: IMetadataCarrier): this {
        this.valueEditor.replaceMetadata(metadata);
        return this;
    }

    merge(record: State): this {
        if (StateGuards.isRichField(record)) {
            this.valueEditor.merge(record.value);
            this.mergeMetadata(record);
        } else {
            this.valueEditor.merge(record);
        }
        return this;
    }
}

export class RecordsetEditor extends BaseStateEditor<IRecordset> {

    private getViewEditor(view? : View) : ViewEditor {
        return new ViewEditor(
            getConfig(this.config, "value"), 
            this.state.filter || { keys: Object.keys(this.state.records) },
            this.state.records
        );
    }

    insertChild(head: KeyPart, record: State): this {
        const key = head as string;
        if (this.state.records[key] !== undefined) throw new RangeError('attempt to insert with key that exists');
        return this.setChild(key, record);
    }

    setChild(head: KeyPart, record: State): this {
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

    getChild(key: KeyPart): State {
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
        return editRecord(childConfig, childState);
    }

    mergeMetadata(metadata: IMetadataCarrier): this {
        if (MetadataEditor.isEmpty(metadata)) return this;
        // we don't merge child metadata as every record should be a metadata carrier, so there should be none
        this.state = MetadataEditor.edit({ ...this.state, metadata: { ...this.state.metadata, ...metadata.metadata } }).prune().getState();
        return this;
    }

    replaceMetadata(carrier: IMetadataCarrier): this {
        let { metadata } = carrier;
        // we don't replace child metadata as every record should be a metadata carrier, so there should be none
        this.state = { ...this.state, metadata }
        return this;
    }    

    mergeRecords(a: { [ key: string] : State }, b: { [ key: string] : State }) : { [ key: string] : State } {

        let result = { ...a }

        for (const [key,record] of Object.entries(b)) {
                if (record !== null) {
                    if (a[key]) {
                        result[key] = editRecord(this.config?.value, a[key]).merge(record).getState();
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
        let records: { [key: string] : State};

        mergedMetadata = MetadataEditor.edit(this.state).merge(recordset).prune().getState();
        records = this.mergeRecords(this.state.records, recordset.records);

        this.state = { ...this.state, ...mergedMetadata, records }

        return this;
    }

    getMetadata() : IMetadataCarrier {
        return { metadata: {} }
    }
}