import { Accessor, BaseAccessor, View } from '../src/accessor';
import { DataType } from '../src/datatype';
import { configQueues, configRequests, state } from './testdata';
import getRegistry from '../src/registry';

const queueAccessor : Accessor = new BaseAccessor(configQueues);

describe('test simple accessor', ()=>{

    it('can fetch a simple field by key', ()=>{
        expect(queueAccessor.get(state, 'a', 'queueName')).toBe('a');
        expect(queueAccessor.get(state, 'b', 'queueName')).toBe('b');
    });

    it('can fetch config', () => {
        expect(queueAccessor.getConfig()?.collection).toBeDefined();
        expect(queueAccessor.getConfig('a')?.type).toBe(DataType.FIELD_MAPPING);
        expect(queueAccessor.getConfig('a','queueName')?.maxLength).toBe(32);
        expect(queueAccessor.getConfig('a','items',0)?.recordset).toBe('requests');
    });

    it('can iterate over fields', ()=>{
        const result = [...Accessor.keys(queueAccessor.get(state))];
        expect(result).toHaveLength(2);
        expect(queueAccessor.get(state, result[0], 'queueName')).toBe('a');
        expect(queueAccessor.get(state, result[1], 'queueName')).toBe('b');
    });
    
    it('can fetch an array item by index', ()=>{
        expect(queueAccessor.get(state,'a','otherItems',0)).toBe('one');
        expect(queueAccessor.get(state,'a','otherItems',1)).toBe('three');
    }); 

    it('can fetch an item metadata by key', ()=>{
        expect(queueAccessor.getMetadata(state,'a','metaOne')).toBe(1);
        expect(queueAccessor.getMetadata(state,'b','metaOne')).toBe(2);
    }); 

});

const requestAccessor = new BaseAccessor(configRequests);

getRegistry(Accessor).register("requests", requestAccessor);
getRegistry(Accessor).register("users", new BaseAccessor({ type: DataType.RECORDSET }, ['users']));
getRegistry(Accessor).register("songs", new BaseAccessor({ type: DataType.RECORDSET }, ['songs']));

describe('test accessor references', ()=>{
    it('can fetch a referenced field by key', ()=>{
        expect(requestAccessor.get(state,'a1','user','firstName')).toBe('jonathan');
        expect(requestAccessor.get(state,'b1','song','title')).toBe('song3');
    });

    it('can fetch a referenced field over multiple steps', ()=>{
        expect(queueAccessor.get(state,'a','items',0,'user','firstName')).toBe('jonathan');
        expect(queueAccessor.get(state,'b','items',0,'song','title')).toBe('song3');
    });

    it('can fetch referenced config by index', ()=>{
        expect(queueAccessor.getConfig('a','items',0,'user')?.type).toBe(DataType.REFERENCE);
    });    

    it('can iterate over fields in a reference', ()=>{
        const view = requestAccessor.get(state) as View;
        const result = [...Accessor.keys(view)] 
        expect(result).toHaveLength(4);
        expect(view.get(result[0],'user','firstName')).toBe('jonathan');
        expect(view.get(result[1],'user','firstName')).toBe('commander');
    });

    it('can fetch a referenced field by name', ()=>{
        expect(queueAccessor.get(state,'a','items',0,'user','firstName')).toBe('jonathan');
    });    
});