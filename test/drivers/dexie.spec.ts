import 'fake-indexeddb/auto';
import _ from 'lodash';
import { DateTime } from 'luxon';

import { DexieDriver, DexieSchema } from '../../src/drivers/dexie';
import { ErrorCode } from '../../src/exceptions';
import { FieldMapping } from '../../src/state';

const config : DexieSchema = {
    users: [ 'email']
}

const driver : DexieDriver = new DexieDriver(config);

describe('test simple accessor', ()=>{

    it('can add a record', async ()=>{
        const id = await driver.getCollection('users').addValue({ email: 'jonathan.essex@test.com', firstName: 'jonathan', lastName: 'essex'});
        expect(id).toBeDefined();
    });

    it('can roundtrip main data types', async ()=>{
        const id = await driver.getCollection('users').addValue({ 
            email: 'jonathan.essex@test.com', 
            firstName: 'jonathan', 
            lastName: 'essex',
            dateOfBirth: DateTime.fromISO('1987-05-25T09:08:34.123'),
            credit: 1032.32,
            tags: [ 'cool', 'unusual'],
            struct: { a : 'a', b: 'b'}
        });
        expect(id).toBeDefined();
        const result: FieldMapping = await driver.getCollection('users').load(id);
        expect(result.email).toBe('jonathan.essex@test.com');
        expect((result.dateOfBirth as DateTime).toMillis()).toEqual(DateTime.fromISO('1987-05-25T09:08:34.123').toMillis());
        expect(result.credit).toBe(1032.32);
        expect(result.tags).toEqual(['cool', 'unusual']);
        expect(result.struct).toEqual({ a : 'a', b: 'b'});
    });

    it('can update main data types', async ()=>{
        const id = await driver.getCollection('users').addValue({ 
            email: 'jonathan.essex@test.com', 
            firstName: 'jonathan', 
            lastName: 'essex',
            dateOfBirth: DateTime.fromISO('1987-05-25T09:08:34.123'),
            credit: 1032.32,
            tags: [ 'cool', 'unusual'],
            struct: { a : 'a', b: 'b'}
        });
        expect(id).toBeDefined();
        await driver.getCollection('users').updateValue({ 
            email: 'john.essex@test.com', 
            firstName: 'John', 
            lastName: 'Essex',
            dateOfBirth: DateTime.fromISO('1972-05-25T09:08:34.123'),
            credit: 10.32,
            tags: [ 'dull', 'boring'],
            struct: { a : 'b', b: 'a'}
        }, id);        
        const result: FieldMapping = await driver.getCollection('users').load(id);
        expect(result.email).toBe('john.essex@test.com');
        expect((result.dateOfBirth as DateTime).toMillis()).toEqual(DateTime.fromISO('1972-05-25T09:08:34.123').toMillis());
        expect(result.credit).toBe(10.32);
        expect(result.tags).toEqual(['dull', 'boring']);
        expect(result.struct).toEqual({ a : 'b', b: 'a'});
    });    

    it('fails when trying to update a record which does not exist', async ()=>{
        const users = driver.getCollection('users');
        await users.removeAll();

        await expect(users.updateValue({ 
            email: 'john.essex@test.com', 
            firstName: 'John', 
            lastName: 'Essex',
            dateOfBirth: DateTime.fromISO('1972-05-25T09:08:34.123'),
            credit: 10.32,
            tags: [ 'dull', 'boring'],
            struct: { a : 'b', b: 'a'}
        }, 123)).rejects.toHaveProperty("code", ErrorCode.KEY_NOT_FOUND);        
    });     

    it('set operates as update', async ()=>{
        const id = await driver.getCollection('users').addValue({ 
            email: 'jonathan.essex@test.com', 
            firstName: 'jonathan', 
            lastName: 'essex',
            dateOfBirth: DateTime.fromISO('1987-05-25T09:08:34.123'),
            credit: 1032.32,
            tags: [ 'cool', 'unusual'],
            struct: { a : 'a', b: 'b'}
        });
        expect(id).toBeDefined();
        await driver.getCollection('users').set({ 
            email: 'john.essex@test.com', 
            firstName: 'John', 
            lastName: 'Essex',
            dateOfBirth: DateTime.fromISO('1972-05-25T09:08:34.123'),
            credit: 10.32,
            tags: [ 'dull', 'boring'],
            struct: { a : 'b', b: 'a'}
        }, id);        
        const result: FieldMapping = await driver.getCollection('users').load(id);
        expect(result.email).toBe('john.essex@test.com');
        expect((result.dateOfBirth as DateTime).toMillis()).toEqual(DateTime.fromISO('1972-05-25T09:08:34.123').toMillis());
        expect(result.credit).toBe(10.32);
        expect(result.tags).toEqual(['dull', 'boring']);
        expect(result.struct).toEqual({ a : 'b', b: 'a'});
    });    

    it('set operates as insert', async ()=>{
        const users = driver.getCollection('users');
        await users.removeAll();

        await users.set({ 
            email: 'john.essex@test.com', 
            firstName: 'John', 
            lastName: 'Essex',
            dateOfBirth: DateTime.fromISO('1972-05-25T09:08:34.123'),
            credit: 10.32,
            tags: [ 'dull', 'boring'],
            struct: { a : 'b', b: 'a'}
        }, 123);        
        const result: FieldMapping = await users.load(123);
        expect(result.email).toBe('john.essex@test.com');
        expect((result.dateOfBirth as DateTime).toMillis()).toEqual(DateTime.fromISO('1972-05-25T09:08:34.123').toMillis());
        expect(result.credit).toBe(10.32);
        expect(result.tags).toEqual(['dull', 'boring']);
        expect(result.struct).toEqual({ a : 'b', b: 'a'});
    });       

    it('can search by a key field', async ()=>{
        const users = driver.getCollection('users');
        await users.removeAll();
        const id1 = await users.addValue({ 
            email: 'jonathan.essex@test.com', 
            dateOfBirth: DateTime.fromISO('1987-05-25T09:08:34.123'),
        });
        const id2 = await users.addValue({ 
            email: 'abraham.lincoln@test.com', 
            dateOfBirth: DateTime.fromISO('1809-02-12T09:08:34.123'),
        });
        const id3 = await users.addValue({ 
            email: 'zane.mczoomer@test.com', 
            dateOfBirth: DateTime.fromISO('1992-11-22T09:08:34.123'),
        });
        const search = await users.search({ email: { '>': 'bonzo@babble.test' }});
        expect (search[id1]).toBeDefined();
        expect (search[id2]).toBeUndefined();
        expect (search[id3]).toBeDefined();
    });

    it('can search by a non-key field', async ()=>{
        const users = driver.getCollection('users');
        await users.removeAll();
        const id1 = await users.addValue({ 
            email: 'jonathan.essex@test.com', 
            dateOfBirth: DateTime.fromISO('1987-05-25T09:08:34.123'),
        });
        const id2 = await users.addValue({ 
            email: 'abraham.lincoln@test.com', 
            dateOfBirth: DateTime.fromISO('1809-02-12T09:08:34.123'),
        });
        const id3 = await users.addValue({ 
            email: 'zane.mczoomer@test.com', 
            dateOfBirth: DateTime.fromISO('1992-11-22T09:08:34.123'),
        });
        const search = await users.search({ dateOfBirth: { '<': DateTime.fromISO('1988-05-25T09:08:34.123') }});
        expect (search[id1]).toBeDefined();
        expect (search[id2]).toBeDefined();
        expect (search[id3]).toBeUndefined();
    });       
    
    it('can search by combined fields', async ()=>{
        const users = driver.getCollection('users');
        await users.removeAll();
        const id1 = await users.addValue({ 
            email: 'jonathan.essex@test.com', 
            dateOfBirth: DateTime.fromISO('1987-05-25T09:08:34.123'),
        });
        const id2 = await users.addValue({ 
            email: 'abraham.lincoln@test.com', 
            dateOfBirth: DateTime.fromISO('1809-02-12T09:08:34.123'),
        });
        const id3 = await users.addValue({ 
            email: 'zane.mczoomer@test.com', 
            dateOfBirth: DateTime.fromISO('1992-11-22T09:08:34.123'),
        });
        const search = await users.search({  email: { '>': 'bonzo@babble.test' }, dateOfBirth: { '<': DateTime.fromISO('1988-05-25T09:08:34.123') }});
        expect (search[id1]).toBeDefined();
        expect (search[id2]).toBeUndefined();
        expect (search[id3]).toBeUndefined();
    });
    
    it('can remove a record', async ()=>{
        const users = driver.getCollection('users');
        await users.removeAll();
        const id = await users.addValue({ 
            email: 'jonathan.essex@test.com', 
            firstName: 'jonathan', 
            lastName: 'essex',
            dateOfBirth: DateTime.fromISO('1987-05-25T09:08:34.123'),
            credit: 1032.32,
            tags: [ 'cool', 'unusual'],
            struct: { a : 'a', b: 'b'}
        });
        expect(id).toBeDefined();

        await users.removeValue(id);        

        await expect(users.load(id)).rejects.toHaveProperty("code", ErrorCode.KEY_NOT_FOUND);  
    });     
});
