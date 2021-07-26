import 'fake-indexeddb/auto';
import thunk, { ThunkDispatch } from 'redux-thunk';
import configureMockStore from 'redux-mock-store';
import { DateTime } from 'luxon';
import { DataSource, Driver } from '../src/accessor';

import { DexieCollection, DexieDriver, DexieSchema } from '../src/drivers/dexie';
import { ErrorCode } from '../src/exceptions';
import { FieldMapping } from '../src/state';
import getRegistry from '../src/registry';
import { DataSourceConfig } from '../src/config';
import { DataType } from '../src/datatype';

import { getReducer } from '../src/reducer';
import { KeyPart } from '../src/types';

// set up a test redux store
type DispatchExts = ThunkDispatch<any, void, any> // this sucks.
const middlewares = [ thunk ];
const initialState = (actions : any) => actions.reduce(getReducer(), { data: { users: { records: [], metadata: {} } } });
function createStore() { return configureMockStore<any, DispatchExts>(middlewares)(initialState); }

// set up the dexie datasource driver
const schema : DexieSchema = {
    users: [ 'email']
}
const drivers = getRegistry(Driver)
drivers.register("dexie",new DexieDriver(schema));
// get a reference to the users collection so we can do low-level driver operations
const usersCollection = drivers.resolve("dexie").getCollection("users") as DexieCollection;

// set up the test datasource
const config : DataSourceConfig = {
    type: DataType.RECORDSET,
    name: 'users',
    collection: {
        driverName: 'dexie',
        collectionName: 'users'
    },
    value: {
        type: DataType.FIELD_MAPPING,
        fields: {
            email: { type: DataType.STRING },
            dateOfBirth: { type: DataType.DATETIME }
        }
    }
};
const datasource = new DataSource(config);

const dummyRecord = { 
    email: 'jonathan.essex@test.com', 
    firstName: 'jonathan', 
    lastName: 'essex',
    dateOfBirth: DateTime.fromISO('1987-05-25T09:08:34.123'),
    credit: 1032.32,
    tags: [ 'cool', 'unusual'],
    struct: { a : 'a', b: 'b'}
}

describe('Test a Datasource with the built-in Dexie driver', ()=>{

    it('can add a record', async ()=>{
        let store = createStore();        
        const id = await store.dispatch(datasource.addValue(dummyRecord)) as any;
        const state = store.getState();
        expect(id).toBeDefined();
        // check id is both in the redux store and the underlying database
        expect(state.data.users.records[id]).toBeDefined();
        expect(await usersCollection.load(id)).toBeDefined();
    });

    it('can roundtrip main data types', async ()=>{
        let store = createStore();        
        const id = await store.dispatch(datasource.addValue(dummyRecord)) as any;
        expect(id).toBeDefined();
        const state = store.getState();
        expect(datasource.get(state, id, "email")).toEqual(dummyRecord.email);
        expect(datasource.get(state, id, "firstName")).toEqual(dummyRecord.firstName);
        expect(datasource.get(state, id, "lastName")).toEqual(dummyRecord.lastName);
        expect(datasource.get(state, id, "dateOfBirth")).toEqual(dummyRecord.dateOfBirth);
        expect(datasource.get(state, id, "credit")).toEqual(dummyRecord.credit);
        expect(datasource.get(state, id, "tags", 0)).toEqual(dummyRecord.tags[0]);
        expect(datasource.get(state, id, "tags", 1)).toEqual(dummyRecord.tags[1]);
        expect(datasource.get(state, id, "struct", "a")).toEqual(dummyRecord.struct.a);
        expect(datasource.get(state, id, "struct", "b")).toEqual(dummyRecord.struct.b);
        expect(await usersCollection.load(id)).toEqual(dummyRecord);
    });

    it('can update main data types', async ()=>{
        let store = createStore();        
        const id = await store.dispatch(datasource.addValue(dummyRecord)) as any;
        expect(id).toBeDefined();
        const updated = { 
            email: 'john.essex@test.com', 
            firstName: 'John', 
            lastName: 'Essex',
            dateOfBirth: DateTime.fromISO('1972-05-25T09:08:34.123'),
            credit: 10.32,
            tags: [ 'dull', 'boring'],
            struct: { a : 'b', b: 'a'}
        };
        await store.dispatch(datasource.updateValue(updated, id));        
        const state = store.getState();
        expect(datasource.get(state, id, "email")).toEqual(updated.email);
        expect(datasource.get(state, id, "firstName")).toEqual(updated.firstName);
        expect(datasource.get(state, id, "lastName")).toEqual(updated.lastName);
        expect(datasource.get(state, id, "dateOfBirth")).toEqual(updated.dateOfBirth);
        expect(datasource.get(state, id, "credit")).toEqual(updated.credit);
        expect(datasource.get(state, id, "tags", 0)).toEqual(updated.tags[0]);
        expect(datasource.get(state, id, "tags", 1)).toEqual(updated.tags[1]);
        expect(datasource.get(state, id, "struct", "a")).toEqual(updated.struct.a);
        expect(datasource.get(state, id, "struct", "b")).toEqual(updated.struct.b);
        expect(await usersCollection.load(id)).toEqual(updated);
    });    

    it('fails when trying to update a record which does not exist', async ()=>{
        let store = createStore();        
        await usersCollection.removeAll();

        await expect(store.dispatch(datasource.updateValue({ 
            email: 'john.essex@test.com', 
            firstName: 'John', 
            lastName: 'Essex',
            dateOfBirth: DateTime.fromISO('1972-05-25T09:08:34.123'),
            credit: 10.32,
            tags: [ 'dull', 'boring'],
            struct: { a : 'b', b: 'a'}
        }, 123))).rejects.toHaveProperty("code", ErrorCode.KEY_NOT_FOUND);        
    });     

    it('set operates as update', async ()=>{
        let store = createStore();        
        await usersCollection.removeAll();
        const id = await store.dispatch(datasource.addValue(dummyRecord)) as any;
        expect(id).toBeDefined();
        const updated = { 
            email: 'john.essex@test.com', 
            firstName: 'John', 
            lastName: 'Essex',
            dateOfBirth: DateTime.fromISO('1972-05-25T09:08:34.123'),
            credit: 10.32,
            tags: [ 'dull', 'boring'],
            struct: { a : 'b', b: 'a'}
        };        
        await store.dispatch(datasource.set(updated, id));
        const state = store.getState();
        expect(datasource.get(state, id, "email")).toEqual(updated.email);
        expect(datasource.get(state, id, "firstName")).toEqual(updated.firstName);
        expect(datasource.get(state, id, "lastName")).toEqual(updated.lastName);
        expect(datasource.get(state, id, "dateOfBirth")).toEqual(updated.dateOfBirth);
        expect(datasource.get(state, id, "credit")).toEqual(updated.credit);
        expect(datasource.get(state, id, "tags", 0)).toEqual(updated.tags[0]);
        expect(datasource.get(state, id, "tags", 1)).toEqual(updated.tags[1]);
        expect(datasource.get(state, id, "struct", "a")).toEqual(updated.struct.a);                
        const result: FieldMapping = await usersCollection.load(id);
        expect(result).toEqual(updated);
    });    

    it('set operates as insert', async ()=>{
        let store = createStore();        
        await usersCollection.removeAll();
        const updated = { 
            email: 'john.essex@test.com', 
            firstName: 'John', 
            lastName: 'Essex',
            dateOfBirth: DateTime.fromISO('1972-05-25T09:08:34.123'),
            credit: 10.32,
            tags: [ 'dull', 'boring'],
            struct: { a : 'b', b: 'a'}
        };        
        await store.dispatch(datasource.set(updated, 123));
        const state = store.getState();
        expect(datasource.get(state, 123, "email")).toEqual(updated.email);
        expect(datasource.get(state, 123, "firstName")).toEqual(updated.firstName);
        expect(datasource.get(state, 123, "lastName")).toEqual(updated.lastName);
        expect(datasource.get(state, 123, "dateOfBirth")).toEqual(updated.dateOfBirth);
        expect(datasource.get(state, 123, "credit")).toEqual(updated.credit);
        expect(datasource.get(state, 123, "tags", 0)).toEqual(updated.tags[0]);
        expect(datasource.get(state, 123, "tags", 1)).toEqual(updated.tags[1]);
        expect(datasource.get(state, 123, "struct", "a")).toEqual(updated.struct.a);                
        const result: FieldMapping = await usersCollection.load(123);
        expect(result).toEqual(updated);
    });       

    it('can search by a key field', async ()=>{
        let store = createStore();        
        await usersCollection.removeAll();
        const id1 = await usersCollection.addValue({ 
            email: 'jonathan.essex@test.com', 
            dateOfBirth: DateTime.fromISO('1987-05-25T09:08:34.123'),
        });
        const id2 = await usersCollection.addValue({ 
            email: 'abraham.lincoln@test.com', 
            dateOfBirth: DateTime.fromISO('1809-02-12T09:08:34.123'),
        });
        const id3 = await usersCollection.addValue({ 
            email: 'zane.mczoomer@test.com', 
            dateOfBirth: DateTime.fromISO('1992-11-22T09:08:34.123'),
        });
        const search = await store.dispatch(datasource.search({ email: { '>': 'bonzo@babble.test' }}));

        const state = store.getState();

        expect (state.data.users.records[id1]).toBeDefined();
        expect (state.data.users.records[id2]).toBeUndefined();
        expect (state.data.users.records[id3]).toBeDefined();
    });

    it('can search by a non-key field', async ()=>{
        let store = createStore();        
        await usersCollection.removeAll();
        const id1 = await usersCollection.addValue({ 
            email: 'jonathan.essex@test.com', 
            dateOfBirth: DateTime.fromISO('1987-05-25T09:08:34.123'),
        });
        const id2 = await usersCollection.addValue({ 
            email: 'abraham.lincoln@test.com', 
            dateOfBirth: DateTime.fromISO('1809-02-12T09:08:34.123'),
        });
        const id3 = await usersCollection.addValue({ 
            email: 'zane.mczoomer@test.com', 
            dateOfBirth: DateTime.fromISO('1992-11-22T09:08:34.123'),
        });
        const search = await store.dispatch(datasource.search({ dateOfBirth: { '<': DateTime.fromISO('1988-05-25T09:08:34.123') }}));

        const state = store.getState();

        expect (state.data.users.records[id1]).toBeDefined();
        expect (state.data.users.records[id2]).toBeDefined();
        expect (state.data.users.records[id3]).toBeUndefined();
    });       
    
    it('can search by combined fields', async ()=>{
        let store = createStore();        
        await usersCollection.removeAll();
        const id1 = await usersCollection.addValue({ 
            email: 'jonathan.essex@test.com', 
            dateOfBirth: DateTime.fromISO('1987-05-25T09:08:34.123'),
        });
        const id2 = await usersCollection.addValue({ 
            email: 'abraham.lincoln@test.com', 
            dateOfBirth: DateTime.fromISO('1809-02-12T09:08:34.123'),
        });
        const id3 = await usersCollection.addValue({ 
            email: 'zane.mczoomer@test.com', 
            dateOfBirth: DateTime.fromISO('1992-11-22T09:08:34.123'),
        });
        const search = await store.dispatch(datasource.search({  email: { '>': 'bonzo@babble.test' }, dateOfBirth: { '<': DateTime.fromISO('1988-05-25T09:08:34.123') }}));
        const state = store.getState();

        expect (state.data.users.records[id1]).toBeDefined();
        expect (state.data.users.records[id2]).toBeUndefined();
        expect (state.data.users.records[id3]).toBeUndefined();
    });
    
    it('can remove a record', async ()=>{
        let store = createStore();        
        await usersCollection.removeAll();
        const id = await usersCollection.addValue({ 
            email: 'jonathan.essex@test.com', 
            firstName: 'jonathan', 
            lastName: 'essex',
            dateOfBirth: DateTime.fromISO('1987-05-25T09:08:34.123'),
            credit: 1032.32,
            tags: [ 'cool', 'unusual'],
            struct: { a : 'a', b: 'b'}
        });
        expect(id).toBeDefined();

        await store.dispatch(datasource.removeValue(id));        
        await expect(usersCollection.load(id)).rejects.toHaveProperty("code", ErrorCode.KEY_NOT_FOUND);
        const state = store.getState();        
        expect (state.data.users.records[id]).toBeUndefined();
    });   
});
