import { State, FieldMapping, Field, IMetadataCarrier, ChildMetadata } from '../state';
import { KeyPart } from '../types';
import { DataType } from '../datatype';
import { Config } from '../config';

import { MetadataEditor } from './metadata';
import { BaseStateEditor } from './base';

export class FieldMappingEditor extends BaseStateEditor<FieldMapping> {

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
            case DataType.FIELD_MAPPING:
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
                this.metadata = MetadataEditor.edit(this.metadata).merge({ metadata: metadata.metadata }).prune().getState();
        } else {
            this.metadata = MetadataEditor.edit(this.metadata).merge(metadata).prune().getState();
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

    update(fieldsetB: FieldMapping): this {
        this.state = fieldsetB;
        return this;
    }

    getMetadata(): IMetadataCarrier {
        return this.metadata;
    }
}

