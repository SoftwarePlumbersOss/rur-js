import { pickBy, mapValues } from 'lodash';
import { IMetadataCarrier } from '../state';

export class MetadataEditor<T extends IMetadataCarrier> {

    state : T

    constructor(state: T) {
        this.state = state;
    }

    static edit<T extends IMetadataCarrier>(state : T) : MetadataEditor<T> { return new MetadataEditor<T>(state); }

    getState() : T { return this.state; }

    prune() : this {
        this.state = { 
            ...this.state, 
            metadata: pickBy(this.state.metadata, (v,k) => v!==null), 
            childMetadata: pickBy(mapValues(this.state.childMetadata, m => MetadataEditor.edit(m).prune().getState()), (v,k) => v!==null)
        };
        return this;
    }

    merge(b = {} as IMetadataCarrier): this {
        let childMetadata: { [index: string]: IMetadataCarrier } | undefined;
        if (this.state.childMetadata === undefined) childMetadata = b.childMetadata;
        if (b.childMetadata === undefined) childMetadata = this.state.childMetadata;
        if (this.state.childMetadata !== undefined && b.childMetadata !== undefined) {
            childMetadata = { ...this.state.childMetadata, ...b.childMetadata };
            for (const field of Object.keys(childMetadata)) {
                if (this.state.childMetadata[field] && b.childMetadata[field])
                    childMetadata[field] = MetadataEditor.edit(this.state.childMetadata[field]).merge(b.childMetadata[field]).getState();

            }
        }
        this.state = {
            ...this.state,
            metadata: { ...this.state.metadata, ...b.metadata },
            childMetadata
        }
        return this;
    }

    isEmpty() {
        return MetadataEditor.isEmpty(this.state);
    }

    static isEmpty(carrier: IMetadataCarrier) {
        return (carrier?.metadata === undefined || Object.keys(carrier.metadata).length === 0) && (carrier?.childMetadata === undefined || Object.keys(carrier.childMetadata).length === 0)
    }
}