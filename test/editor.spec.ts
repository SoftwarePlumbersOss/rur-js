import { edit } from '../src/editor';
import { configQueues, state } from './testdata';

const queues = state.recordset.queues;

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
