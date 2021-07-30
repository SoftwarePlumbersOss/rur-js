import { NullablePrimitive, Primitive, IMetadataCarrier } from '../state';
import { KeyPart } from '../types';
import { DataType } from '../datatype';
import { Config } from '../config';
import { ReferenceBoundary } from '../exceptions';

import { MetadataEditor } from './metadata';
import { BaseStateEditor } from './base';


export class PrimitiveEditor extends BaseStateEditor<NullablePrimitive> {

    metadata: IMetadataCarrier;

    constructor(config: Config | undefined, state: NullablePrimitive, metadata = {} as IMetadataCarrier) {
        super(config, state);
        this.metadata = metadata;
    }

    private getAccessError(head: KeyPart) {
        if (this.getType() === DataType.REFERENCE)
            return new ReferenceBoundary(this.config as Config, undefined, this.state as KeyPart, head);
        if (this.getType() === DataType.REFERENCED_BY)
            return new ReferenceBoundary(this.config as Config, undefined, head);
        else
            return new TypeError(`no element ${head} in ${this.getType()}`);    
    }

    getChild(head: KeyPart): Primitive {
        throw this.getAccessError(head);
    }

    getChildMetadata(head: KeyPart): IMetadataCarrier | undefined {
        throw this.getAccessError(head);
    }

    insertChild(head: KeyPart, child: Primitive): this {
        throw this.getAccessError(head);
    }

    deleteChild(head: KeyPart): this {
        throw this.getAccessError(head);
    }

    setChild(head: KeyPart, child: Primitive): this {
        throw this.getAccessError(head);
    }

    mergeMetadata(metadata: IMetadataCarrier): this {
        this.metadata = MetadataEditor.edit(this.metadata).merge(metadata).prune().getState();
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

    update(primitiveB: NullablePrimitive): this {
        if (primitiveB !== undefined) this.state = primitiveB;
        return this;
    }

    getMetadata(): IMetadataCarrier {
        return this.metadata;
    }
}
