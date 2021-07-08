import { State, Primitive, Record, Recordset, IRecordset, Guards, FieldMapping, Field, IMetadataCarrier, ChildMetadata, Metadata, MetadataPrimitive } from './state';
import { Key, KeyPart } from './types';
import { DataType, getDataType } from './datatype';
import { Config, getConfig } from './config';
import { ReferenceBoundary } from './exceptions';
import { pickBy, mapValues } from 'lodash';


export abstract class StateEditor<T extends State> {

    abstract getChild<U extends State>(head: KeyPart): U | undefined;
    abstract setChild<U extends State>(head: KeyPart, child: U): void;

    abstract set(path: Key, value: Primitive): this
    abstract get(path: Key): Primitive | undefined
    abstract getType(): DataType;
    abstract getEditor(head: KeyPart): StateEditor<State>;
    abstract getState(): T;
    abstract getMetadata(): IMetadataCarrier;
    abstract getConfig(): Config
    abstract mergeMetadata(metadata: IMetadataCarrier, mergeForward?: boolean): this;
    abstract mergeState(state: T): this;

    getChildMetadata(head: KeyPart): IMetadataCarrier | undefined {
        return this.getMetadata()?.childMetadata?.[head]
    }

    editAt(path: Key, editOperation: (editor: StateEditor<State>) => void): this {
        if (path.length > 0) {
            const [head, ...tail] = path;
            let childEditor = this.getEditor(head);
            childEditor.editAt(tail, editOperation);
            this.setChild(head, childEditor.getState())
            let childMetadata = childEditor.getMetadata();
            if (childMetadata && !isEmpty(childMetadata)) {
                this.mergeMetadata({ childMetadata: { [head]: childMetadata } }, false);
            }
        } else {
            editOperation(this);
        }
        return this;
    }

    setMetadata(key: Key, value: Primitive): this {
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
        return key.slice(0, -1).reduce((editor: StateEditor<State>, key) => editor.getEditor(key), this)
            .getMetadata()?.metadata?.[key[key.length - 1]];
    }

    insertRecordAt(key: Key, value: Record): this {
        if (key.length > 0) {
            let recordsetKey = key.slice(0, -1);
            return this.editAt(recordsetKey, editor => {
                if (editor instanceof RecordsetEditor)
                    editor.insertRow(key[key.length - 1], value);
                else
                    throw new TypeError(`${recordsetKey} does not refer to a recordset`);
            })
        } else {
            throw new RangeError('key should have a length of at least 1');
        }
    }

    addRecordAt(key: Key, value: Record): this {
        return this.editAt(key, editor => {
            if (editor instanceof RecordsetEditor)
                editor.addRow(value);
            else
                throw new TypeError(`${key} does not refer to a recordset`);
        })
    }

    removeRecord(key: Key): this {
        if (key.length > 0) {
            let recordsetKey = key.slice(0, -1);
            return this.editAt(recordsetKey, editor => {
                if (editor instanceof RecordsetEditor)
                    editor.removeRow(key[key.length - 1]);
                else
                    throw new TypeError(`${recordsetKey} does not refer to a recordset`);
            })
        } else {
            throw new RangeError('key should have a length of at least 1');
        }
    }

}

abstract class BaseStateEditor<T extends State> extends StateEditor<T> {
    protected state: T
    protected config: Config

    constructor(config: Config, state: T) {
        super();
        this.config = config;
        this.state = state;
    }


    set(path: Key, value: Primitive): this {
        if (path.length > 0) {
            const [head, ...tail] = path;
            this.setChild(head, this.getEditor(head).set(tail, value).getState());
        } else {
            this.state = value as T;
        }
        return this;
    }

    get(path: Key): Primitive | undefined {
        if (path.length > 0) {
            const [head, ...tail] = path;
            return this.getEditor(head).get(tail);
        } else {
            return this.state as Primitive;
        }
    }

    getType(): DataType {
        return getDataType(this.state, this.config);
    }

    getEditor(head: KeyPart): StateEditor<State> {
        const childState = this.getChild(head);
        const childConfig = getConfig(this.config, head);
        const childMetadata = this.getChildMetadata(head);
        return edit(childConfig, childState, childMetadata);
    }

    getState(): T {
        return this.state;
    }

    getMetadata(): IMetadataCarrier {
        if (Guards.isIMetadataCarrier(this.state))
            return this.state;
        else
            return {};
    }

    getConfig(): Config {
        return this.config;
    }

}

class RecordsetEditor extends BaseStateEditor<Recordset> {

    private updateRowByKey(key: string, value: Record) {
        let recordset = this.state;
        if (Guards.isIRecordset(recordset)) {
            this.state = { ...recordset, records: recordset.records.map((row, i) => (Guards.isIRecord(row) ? row.metadata?.key === key : row === key) ? value : row) }
        } else {
            this.state = recordset.map((row, i) => (Guards.isIRecord(row) ? row.metadata?.key === key : row === key) ? value : row);
        }
    }

    private updateRowByIndex(index: number, value: Record) {
        let recordset = this.state;
        if (Guards.isIRecordset(recordset)) {
            this.state = { ...recordset, records: recordset.records.map((row, i) => i === index ? value : row) }
        } else {
            this.state = recordset.map((row, i) => i === index ? value : row);
        }
        return recordset;
    }

    private updateRow(head: string | number, value: Record) {
        if (typeof head === 'number')
            this.updateRowByIndex(head, value)
        else
            this.updateRowByKey(head, value)
    }

    setChild<Record>(head: KeyPart, record: Record): void {
        this.updateRow(head, record as any); // What the fucking fuck was the problem here       
    }

    getChild<Record>(head: KeyPart): Record {
        let records = Guards.isIRecordset(this.state) ? this.state.records : this.state;
        let index = (typeof head === 'number') ? head : records.findIndex(record => Guards.isIRecord(record) ? record.metadata?.key === head : record === head)
        return records[index] as any; // What the fucking fuck was the problem here
    }

    insertRow(head: KeyPart, row: Record): RecordsetEditor {
        let recordset = this.state;
        if (Guards.isIRecordset(recordset)) {
            let index: number = typeof head === 'number' ? head : recordset.records.findIndex(row => Guards.isIRecord(row) ? row.metadata?.key === head : row === head);
            this.state = { ...recordset, records: [...recordset.records.slice(0, index), row, ...recordset.records.slice(index)] }
        } else {
            let index: number = typeof head === 'number' ? head : recordset.findIndex(row => Guards.isIRecord(row) ? row.metadata?.key === head : row === head);
            this.state = [...recordset.slice(0, index), row, ...recordset.slice(index)]
        }
        return this;
    }

    removeRow(head: KeyPart): RecordsetEditor {
        let recordset = this.state;
        if (Guards.isIRecordset(recordset)) {
            let index: number = typeof head === 'number' ? head : recordset.records.findIndex(row => Guards.isIRecord(row) ? row.metadata?.key === head : row === head);
            this.state = { ...recordset, records: [...recordset.records.slice(0, index), ...recordset.records.slice(index + 1)] }
        } else {
            let index: number = typeof head === 'number' ? head : recordset.findIndex(row => Guards.isIRecord(row) ? row.metadata?.key === head : row === head);
            this.state = [...recordset.slice(0, index), ...recordset.slice(index + 1)]
        }
        return this;
    }

    addRow(row: Record): RecordsetEditor {
        let recordset = this.state;
        if (Guards.isIRecordset(recordset)) {
            this.state = { ...recordset, records: [...recordset.records, row] }
        } else {
            this.state = [...recordset, row]
        }
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
        if (Guards.isIRecordset(this.state)) {
            this.state = prune({ ...this.state, metadata: { ...this.state.metadata, ...metadata.metadata } })
        } else {
            this.state = prune({ records: this.state, metadata: metadata.metadata })
        }
        return this;
    }

    mergeState(recordset: Recordset): this {
        let mergedMetadata: IMetadataCarrier;
        let records: Record[];

        if (Guards.isIRecordset(this.state) && Guards.isIRecordset(recordset)) {
            mergedMetadata = mergeIMetadataCarrier(this.state, recordset);
            records = [...this.state.records, ...recordset.records];
        } else if (Guards.isIRecordset(this.state)) {
            mergedMetadata = this.state;
            records = [...this.state.records, ...(recordset as Record[])];
        } else {
            mergedMetadata = recordset as IRecordset;
            records = [...(this.state as Record[]), ...(recordset as IRecordset).records];
        }

        if (isEmpty(mergedMetadata))
            this.state = records;
        else
            this.state = { ...mergedMetadata, records }

        return this;
    }


}

class PrimitiveEditor extends BaseStateEditor<Primitive> {

    metadata: IMetadataCarrier;

    constructor(config: Config, state: Primitive, metadata = {} as IMetadataCarrier) {
        super(config, state);
        this.metadata = metadata;
    }

    set(path: Key, value: Primitive): this {
        if (path.length > 0) {
            if (this.getType() === DataType.REFERENCE)
                throw new ReferenceBoundary(this.config, ...path);
            else
                throw new TypeError(`no element ${path.join('.')} in ${this.getType()}`);
        } else {
            this.state = value;
        }
        return this;
    }

    get(path: Key): Primitive {
        if (path.length > 0) {
            if (this.getType() === DataType.REFERENCE)
                throw new ReferenceBoundary(this.config, ...path);
            else
                throw new TypeError(`no element ${path.join('.')} in ${this.getType()}`);
        } else {
            return this.state;
        }
    }

    getChild<State>(head: KeyPart): State {
        throw new TypeError(`object type ${this.getType()} does not have a child ${head}`)
    }

    setChild<State>(head: KeyPart, child: State): void {
        throw new TypeError(`object type ${this.getType()} does not have a child ${head}`)
    }

    mergeMetadata(metadata: IMetadataCarrier): this {
        this.metadata = mergeIMetadataCarrier(this.metadata, metadata);
        return this;
    }

    mergeState(primitiveB: Primitive): this {
        if (primitiveB !== undefined) this.state = primitiveB;
        return this;
    }

    getMetadata(): IMetadataCarrier {
        return this.metadata;
    }
}

class RecordEditor extends StateEditor<Record> {

    valueEditor: StateEditor<Field>;

    constructor(config: Config, state: Record) {
        super();
        if (Guards.isIRecord(state)) {
            let { value, ...metadata } = state;
            this.valueEditor = edit(config, value, metadata) as StateEditor<Field>;
        } else {
            this.valueEditor = edit(config, state) as StateEditor<Field>;
        }
    }

    getChild<Field>(head: KeyPart): Field | undefined {
        return this.valueEditor.getChild(head) as unknown as Field;
    }

    setChild<Field>(head: KeyPart, child: Field): void {
        this.valueEditor.setChild(head, child as any); // Seriously, what the fuck is going on with this
    }

    set(path: Key, value: Primitive): this {
        this.valueEditor.set(path, value);
        return this;
    }

    get(path: Key): Primitive | undefined {
        return this.valueEditor.get(path);
    }

    getType(): DataType {
        return this.valueEditor.getType();
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
        return this.valueEditor.getMetadata();
    }

    getConfig(): Config {
        return this.valueEditor.getConfig();
    }

    mergeMetadata(metadata: IMetadataCarrier, mergeForward = true): this {
        if (isEmpty(metadata)) return this;

        // First we merge the record value
        this.valueEditor.mergeMetadata(metadata, mergeForward);
        this.valueEditor = edit(
            this.valueEditor.getConfig(), 
            this.valueEditor.getState(), 
            prune(this.valueEditor.getMetadata() || {})
        ) as StateEditor<Field>;

        return this;
    }

    mergeState(record: Record): this {
        if (Guards.isIRecord(record)) {
            this.valueEditor.mergeState(record.value);
        } else {
            this.valueEditor.mergeState(record);
        }
        return this;
    }

    editAt(path: Key, editOperation: (editor: StateEditor<State>) => void): this {
        if (path.length > 0) {
            const [head, ...tail] = path;
            let childEditor = this.valueEditor.getEditor(head);
            childEditor.editAt(tail, editOperation);
            this.setChild(head, childEditor.getState())
            let childMetadata = childEditor.getMetadata();
            if (childMetadata && !isEmpty(childMetadata)) this.mergeMetadata({ childMetadata: { [head]: childMetadata } }, false);
        } else {
            editOperation(this.valueEditor);
        }
        return this;
    }
}

class FieldMappingEditor extends BaseStateEditor<FieldMapping> {

    metadata: IMetadataCarrier;

    constructor(config: Config, state: FieldMapping, metadata = {} as IMetadataCarrier) {
        super(config, state);
        this.metadata = metadata;
    }

    setChild<Field>(head: KeyPart, value: Field): void {
        this.state = { ...this.state, [head]: value } as FieldMapping;
    }

    getChild<Field>(head: KeyPart): Field | undefined {
        return this.state[head] as any; // Really, really no idea why I need this cast to any 
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
                return { state: { ...metadata, records: [] } } // we don't merge record data
            case DataType.FIELDSET:
                return FieldMappingEditor.createFieldsetFromMetadata(config, metadata);
            default:
                if (metadata.childMetadata)
                    return FieldMappingEditor.createFieldsetFromMetadata(config, metadata);
                else
                    return { metadata }
        }
    }

    mergeMetadata(metadata: IMetadataCarrier, mergeForward = true): this {
        let sourceChildMetadata = metadata.childMetadata;
        let childMetadata: ChildMetadata = {}
        let resultFields: FieldMapping = { ...this.state }
        if (sourceChildMetadata) {
            if (mergeForward) {
                // If mergeForward is set we have to assume that the supplied metadata may contain
                // child metadata for metadata carriers which are children of this field mapping -
                // for example a recordset which is a field
                for (const fieldName of Object.keys(sourceChildMetadata)) {
                    const child = sourceChildMetadata[fieldName];
                    this.editAt([fieldName], editor => editor.mergeMetadata(child, true))
                }
                this.metadata = mergeIMetadataCarrier(this.metadata, { metadata: metadata.metadata });
            } else {
                this.metadata = mergeIMetadataCarrier(this.metadata, metadata);
            }
        } else {
            this.metadata = mergeIMetadataCarrier(this.metadata, metadata);
        }
        return this;
    }

    mergeState(fieldsetB: FieldMapping): this {
        let merged: FieldMapping = {};
        for (const fieldName of new Set([...Object.keys(this.state), ...Object.keys(fieldsetB)])) {
            let childEditor = this.getEditor(fieldName);
            childEditor.mergeState(fieldsetB[fieldName]);
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

export function edit(config: Config, state?: State, metadata?: IMetadataCarrier): StateEditor<State> {
    const type = getDataType(state, config);
    switch (type) {
        case DataType.RECORDSET: return new RecordsetEditor(config, state as Recordset);
        case DataType.RECORD: return new RecordEditor(config, state as Record);
        case DataType.FIELDSET: return new FieldMappingEditor(config, state as FieldMapping, metadata);
        case DataType.STRING:
        case DataType.REFERENCE:
        case DataType.NUMBER:
        case DataType.DATETIME: return new PrimitiveEditor(config, state as Primitive, metadata);
        default:
            throw new TypeError(`unhandled type ${type}`);
    }
}


