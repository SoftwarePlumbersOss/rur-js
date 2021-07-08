import { DataType } from '../src/datatype';
import { RecordsetConfig } from '../src/config';
import { Recordset } from '../src/state';
import { StateEditor, edit } from '../src/editor';
import { Accessor, BaseAccessor } from '../src/accessor';

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

describe('test simple editor', ()=>{
    it('can set a simple field by index', ()=>{
        let editor = edit(configQueues, queues).set([0, 'queueName'], "newQueueName");
        expect(editor.get([0, 'queueName'])).toBe('newQueueName');
    });

    it('can set a simple field metadata by index', ()=>{
        let editor = edit(configQueues, queues).setMetadata([0, 'queueName',"error"], "wrong");
        expect(editor.getMetadataAt([0, 'queueName', 'error'])).toBe('wrong');
    });

    it('can set a simple field by key', ()=>{
        let editor = edit(configQueues, queues).set(['b', 'queueName'], "newQueueName");
        expect(editor.get(['b', 'queueName'])).toBe('newQueueName');
    });

    it('can set a simple field metadata by key', ()=>{
        let editor = edit(configQueues, queues).setMetadata(['b', 'queueName',"error"], "wrong");
        expect(editor.getMetadataAt(['b', 'queueName',"error"])).toBe('wrong');
    });

    it('can merge simple field metadata by key', ()=>{
        let editor = edit(configQueues, queues).mergeMetadataAt(['b', 'queueName'], { metadata: { error: 'wrong' } });
        expect(editor.getMetadataAt(['b', 'queueName', 'error'])).toBe('wrong');
    });

    it('can set an array item by index', ()=>{
        let editor = edit(configQueues, queues).set(['a', 'otherItems', 1], 'two');
        expect(editor.get(['a','otherItems',1])).toBe('two');
    }); 

    it('can insert an array item by index', ()=>{
        let editor = edit(configQueues, queues).insertRecordAt(['a', 'otherItems', 1], "two");
        expect(editor.get(['a','otherItems',0])).toBe('one');
        expect(editor.get(['a','otherItems',1])).toBe('two');
        expect(editor.get(['a','otherItems',2])).toBe('three');
    })

    it('can remove an array item by index', ()=>{
        let editor = edit(configQueues, queues).removeRecord(['a', 'otherItems', 1]);
        expect(editor.get(['a','otherItems',0])).toBe('one');
        expect(editor.get(['a','otherItems',1])).toBeUndefined();
        editor = edit(configQueues, queues).removeRecord(['a', 'otherItems', 0]);
        expect(editor.get(['a','otherItems',0])).toBe('three');
        expect(editor.get(['a','otherItems',1])).toBeUndefined();
        editor.removeRecord(['a', 'otherItems', 0]);
        expect(editor.get(['a','otherItems',0])).toBeUndefined();
    })    

    it('can add an array item', ()=>{
        let editor = edit(configQueues, queues).addRecordAt(['a', 'otherItems'], "four");
        expect(editor.get(['a','otherItems',0])).toBe('one');
        expect(editor.get(['a','otherItems',1])).toBe('three');
        expect(editor.get(['a','otherItems',2])).toBe('four');
    })    
});
