import 'fake-indexeddb/auto';
import { DateTime } from 'luxon';

import { DexieDriver, DexieSchema } from '../../src/drivers/dexie';
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
    
});
