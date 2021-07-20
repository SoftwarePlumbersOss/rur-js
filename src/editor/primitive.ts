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
