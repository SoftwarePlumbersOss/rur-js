import { ThunkAction, ThunkDispatch } from 'redux-thunk';
import { AnyAction } from 'redux';
import { v4 as uuid } from 'uuid';

import { Accessor, Datum, Calculator } from './accessor';
import { FieldMapping, Record, IRecord, Guards } from './state';
import { Key, KeyPart } from './types';
import { ErrorCode, Exception } from './exceptions';
import { Config } from './config';
import { PackedCriteria } from './criteria';

export type DatasourceAction = ThunkAction<Promise<void>, any, undefined, AnyAction>;

export type Dispatch = ThunkDispatch<any, undefined, AnyAction>;

export class DataSource {

    accessor: Accessor;

    constructor(accessor: Accessor) {
        this.accessor = accessor;
    }

    expand(record: Record, key? : KeyPart) : IRecord {
        if (Guards.isIRecord(record)) {
            if (key)
                return { ...record, metadata: { ...record.metadata, key }};
            else
                return record;
        } else {
            return { value: record, metadata: { key }}
        }
    }

    setError(exception : Exception) : DatasourceAction {
        return (dispatch : Dispatch) => {
            dispatch(this.accessor.setError(exception));
            return Promise.reject(exception);
        }
    }

    thunkify(action: AnyAction) : DatasourceAction {
        return (dispatch : Dispatch, getState : () => any) => {
            dispatch(action);
            const exception = this.accessor.getError(getState())
            if (exception)
                return Promise.reject(exception);
            else
                return Promise.resolve();
        }
    }

    addRecord(record : FieldMapping) : DatasourceAction {
        return this.thunkify(this.accessor.addValue({ value: record, metadata: { key: uuid().toString() }}));
    }

    updateRecord(record : Record, key? : KeyPart) : DatasourceAction {
        const irecord = this.expand(record, key);
        if (irecord.metadata.key !== undefined) {
            return this.thunkify(this.accessor.updateValue(irecord, irecord.metadata.key as string));
        } else {
            return this.setError({ code: ErrorCode.KEY_REQUIRED, message: 'attempted to update a record with no key' });
        }
    }

    upsertRecord(record : Record, key? : KeyPart) : DatasourceAction {
        const irecord = this.expand(record, key);
        if (irecord.metadata.key !== undefined) {
            return this.thunkify(this.accessor.upsertValue(irecord, irecord.metadata.key as string));
        } else {
            return this.setError({ code: ErrorCode.KEY_REQUIRED, message: 'attempted to upsert a record with no key' });
        }
    }

    removeRecord(key : KeyPart) : DatasourceAction {
        return this.thunkify(this.accessor.removeValue(key));
    }

    get(state: any, ...key : Key) : Datum {
        return this.accessor.get(state, ...key);
    }
    
    getConfig(...key: Key) : Config | undefined {
        return this.accessor.getConfig(...key);
    }

    addCalculatedFields(calculator : Calculator) : DataSource {
        return new DataSource(this.accessor.addCalculatedFields(calculator));
    }

    search(criteria : PackedCriteria) : DatasourceAction {
        return this.thunkify(this.accessor.search(criteria));
    }
}
