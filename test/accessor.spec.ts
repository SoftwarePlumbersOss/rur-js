import { DataType } from '../src/datatype';
import { RecordsetConfig } from '../src/config';
import { Recordset } from '../src/state';
import { Accessor, BaseAccessor } from '../src/accessor';
import getRegistry from '../src/registry';

export const configQueues : RecordsetConfig = {
    firestoreCollection: 'queues',
    type: DataType.RECORDSET,
    value: {
        type: DataType.FIELDSET,
        fields: {
            queueName: { maxLength: 32 },
            items: { 
                type: DataType.RECORDSET, 
                value: {
                    type: DataType.REFERENCE,
                    recordset: 'requests'
                }
            }
        }
    },
    textSearchFields: [ "queueName" ]
};

export const configRequests: RecordsetConfig = {
    firestoreCollection: 'requests',
    type: DataType.RECORDSET,
    value: {
        type: DataType.FIELDSET,
        fields: {
            user: {
                type: DataType.REFERENCE,
                recordset: 'users'
            },
            song: {
                type: DataType.REFERENCE,
                recordset: 'songs'
            },
        }
    }
}

const requests : Recordset = [
    { 
        metadata: { key: 'a1'},
        value: {
            user: 'a1user',
            song: 'a1song'
        }
    },{
        metadata: { key: 'a2'},
        value: {
            user: 'a2user',
            song: 'a2song'
        }

    },{ 
        metadata: { key: 'b1'},
        value: {
            user: 'b1user',
            song: 'b1song'
        }
    },{
        metadata: { key: 'b2'},
        value: {
            user: 'b2user',
            song: 'b2song'
        }

    }
]

const users : Recordset = [
    {
        metadata: { key: 'a1user' },
        value: {
            firstName: 'jonathan',
            lastName: 'essex'
        }
    },{
        metadata: { key: 'a2user' },
        value: {
            firstName: 'commander',
            lastName: 'keene'
        }
    },{
        metadata: { key: 'b1user' },
        value: {
            firstName: 'simon',
            lastName: 'templar'
        }
    },{
        metadata: { key: 'b2user' },
        value: {
            firstName: 'testy',
            lastName: 'mctester'
        }
    }
]

const songs : Recordset = [
    {
        metadata: { key: 'a1song' },
        value: {
            title: 'song1',
            artist: 'artist1'
        }
    },{
        metadata: { key: 'a2song' },
        value: {
            title: 'song2',
            artist: 'artist2'
        }
    },{
        metadata: { key: 'b1song' },
        value: {
            title: 'song3',
            artist: 'artist3'
        }
    },{
        metadata: { key: 'b2song' },
        value: {
            title: 'song4',
            artist: 'artist4'
        }
    }
]

const queues : Recordset = [
    {
        metadata: { key: 'a' },
        value: {
            queueName: 'a',
            otherItems: [ 'one', 'three'],
            items: ['a1','a2']
        }
    },{
        metadata: { key: 'b' },
        value: {
            queueName: 'b',
            items: ['b1', 'b2']
        }
    }
]

const state = {
    recordset: {
        queues: {
            records: queues,
        },
        users: {
            records: users,
        },
        songs: {
            records: songs,
        },
        requests: {
            records: requests,
        }
    }
}

const queueAccessor : Accessor = new BaseAccessor(configQueues, ['recordset', 'queues']);

describe('test simple accessor', ()=>{
    it('can fetch a simple field by index', ()=>{
        expect(queueAccessor.get(state, 0, 'queueName')).toBe('a');
        expect(queueAccessor.get(state, 1, 'queueName')).toBe('b');
    });

    it('can fetch a simple field by key', ()=>{
        expect(queueAccessor.get(state, 'a', 'queueName')).toBe('a');
        expect(queueAccessor.get(state, 'b', 'queueName')).toBe('b');
    });

    it('can fetch config', () => {
        expect(queueAccessor.getConfig().firestoreCollection).toBe('queues');
        expect(queueAccessor.getConfig('a').type).toBe(DataType.FIELDSET);
        expect(queueAccessor.getConfig('a','queueName').maxLength).toBe(32);
        expect(queueAccessor.getConfig('a','items',0).recordset).toBe('requests');
    });

    it('can iterate over fields', ()=>{
        const result = [...queueAccessor.get(state) as Iterable<any>] 
        expect(result).toHaveLength(2);
        expect(result[0].get('queueName')).toBe('a');
        expect(result[1].get('queueName')).toBe('b');
    });
    
    it('can fetch an array item by index', ()=>{
        expect(queueAccessor.get(state,'a','otherItems',0)).toBe('one');
        expect(queueAccessor.get(state,'a','otherItems',1)).toBe('three');
    }); 

    it('can fetch an item metadata by index', ()=>{
        expect(queueAccessor.getMetadata(state,0,'key')).toBe('a');
        expect(queueAccessor.getMetadata(state,1,'key')).toBe('b');
    }); 

});

const requestAccessor = new BaseAccessor(configRequests, ['recordset', 'requests']);

getRegistry(Accessor).register("requests", requestAccessor);
getRegistry(Accessor).register("users", new BaseAccessor({ type: DataType.RECORDSET }, ['recordset', 'users']));
getRegistry(Accessor).register("songs", new BaseAccessor({ type: DataType.RECORDSET }, ['recordset', 'songs']));

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
        expect(queueAccessor.getConfig('a','items',0,'user').type).toBe(DataType.REFERENCE);
    });    

    it('can iterate over fields in a reference', ()=>{
        const result = [...requestAccessor.get(state) as Iterable<any>] 
        expect(result).toHaveLength(4);
        expect(result[0].get('user','firstName')).toBe('jonathan');
        expect(result[1].get('user','firstName')).toBe('commander');
    });

    it('can fetch a referenced field by name', ()=>{
        expect(queueAccessor.get(state,'a','items',0,'user','firstName')).toBe('jonathan');
    });    
});