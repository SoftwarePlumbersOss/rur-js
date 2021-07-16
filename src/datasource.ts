
import { Accessor, BaseAccessor, AsyncAction, AddAction, Dispatch, DelegatingAccessor } from './accessor';
import { FieldMapping } from './state';
import { KeyPart } from './types';
import { Config } from './config';
import { PackedCriteria } from './criteria';
import { Action, ValueAction, SearchAction } from './reducer';
import getRegistry from './registry';

export abstract class Collection {    
    abstract insertValue(value: FieldMapping, key : KeyPart) : Promise<void>;
    abstract updateValue(value: FieldMapping, key : KeyPart) : Promise<void>;
    abstract removeValue(key : KeyPart) : Promise<void>;
    abstract addValue(value: FieldMapping) : Promise<KeyPart>;
    abstract search(criteria: PackedCriteria) : Promise<{[ key: string] : FieldMapping}>;
}

export abstract class Driver {
    abstract getCollection(collectionName: string, config: Config) : Collection;
}

const drivers = getRegistry(Driver);

/** A DataSource is just an Accessor which can only update top-level items. 
 * 
 */
export abstract class DataSource extends DelegatingAccessor {

    constructor(config : Config, basePath: string[], parent? : Accessor) {
        super(new BaseAccessor(config, basePath), parent);
    }

    get collection() : Collection {
        const config = this.getConfig("datasource");
        if (config === undefined) throw new Error("No config");
        const { driverName, collectionName, ...rest } = config;
        return drivers.resolve(driverName).getCollection(collectionName, rest);
    }

    insertValue(value: FieldMapping, key : KeyPart) : AsyncAction<ValueAction> {
        return (dispatch : Dispatch) => {            
            return this.collection.insertValue(value, key).then(()=>{
                const result = dispatch(this.accessor.insertValue(value, key));
                if (result instanceof Promise) return result;
            });
        }
    }  

    updateValue(value: FieldMapping, key : KeyPart) : AsyncAction<ValueAction> {
        return (dispatch : Dispatch) => {            
            return this.collection.updateValue(value, key).then(()=>{
                const result = dispatch(this.accessor.updateValue(value, key));
                if (result instanceof Promise) return result;
            });
        }
    }  

    removeValue(key : KeyPart) : AsyncAction<Action> {
        return (dispatch : Dispatch) => {            
            return this.collection.removeValue(key).then(()=>{
                const result = dispatch(this.accessor.removeValue(key));
                if (result instanceof Promise) return result;
            });
        }
    }  

    addValue(value: FieldMapping) : AddAction {
        return (dispatch : Dispatch) => {            
            return this.collection.addValue(value).then((key)=>{
                return Promise.resolve(dispatch(this.accessor.insertValue(value, key))).then(()=>key);
            });
        };
    }  

    search(criteria: PackedCriteria) : AsyncAction<SearchAction> {
        return (dispatch : Dispatch) => {            
            return this.collection.search(criteria).then((result)=>{
                dispatch(this.accessor.mergeValue(result));
            });
        };
    }
}
