import { edit } from '../src/editor';
import { configQueues, state } from './testdata';
import { Record, IRecord, IRecordset, FieldMapping } from '../src/state';
import { Order } from '../src/sort';

const queues = state.recordset.queues;

describe('test simple editor', ()=>{

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
        let editor = edit(configQueues, queues).insertAt(['a', 'otherItems', 1], "two");
        expect(editor.get(['a','otherItems',0])).toBe('one');
        expect(editor.get(['a','otherItems',1])).toBe('two');
        expect(editor.get(['a','otherItems',2])).toBe('three');
    });

    it('can remove an array item by index', ()=>{
        let editor = edit(configQueues, queues).deleteAt(['a', 'otherItems', 1]);
        expect(editor.get(['a','otherItems',0])).toBe('one');
        expect(editor.get(['a','otherItems',1])).toBeUndefined();
        editor = edit(configQueues, queues).deleteAt(['a', 'otherItems', 0]);
        expect(editor.get(['a','otherItems',0])).toBe('three');
        expect(editor.get(['a','otherItems',1])).toBeUndefined();
        editor.deleteAt(['a', 'otherItems', 0]);
        expect(editor.get(['a','otherItems',0])).toBeUndefined();
    });    

    it('can add an array item', ()=>{
        let editor = edit(configQueues, queues).addAt(['a', 'otherItems'], "four");
        expect(editor.get(['a','otherItems',0])).toBe('one');
        expect(editor.get(['a','otherItems',1])).toBe('three');
        expect(editor.get(['a','otherItems',2])).toBe('four');
    }); 
    
    it('can insert an entire record by key', ()=>{
        let editor = edit(configQueues, queues);
        editor.insertAt(['d'], { metadata: {  }, value : { queueName: 'queueD' }} as IRecord);
        editor.insertAt(['c'], { metadata: {  }, value : { queueName: 'queueC' }} as IRecord);
        let records = (editor.getState() as IRecordset).records;
        expect(Object.values(records).map(record => ((record as IRecord).value as FieldMapping).queueName)).toEqual(['a','b','queueD','queueC']);
    });

    it('can filter a recordset', ()=>{
        let editor = edit(configQueues, queues);
        editor.searchAt([], { queueName: { '>': 'a' }});
        let records = (editor.getState() as IRecordset).filter?.keys;
        expect(records).toEqual(['b']);
    });    

    it('can sort a recordset', ()=>{
        let editor = edit(configQueues, queues);
        editor.sortAt([], { queueName: Order.DESCENDING });
        let records = (editor.getState() as IRecordset).filter?.keys;
        expect(records).toEqual(['b','a']);
    });

    it('can add a record to a filtered recordset', ()=>{
        let editor = edit(configQueues, queues);
        editor.searchAt([], { queueName: { '>': 'a' }});
        // check that when we add a record which complies with the criteria, it is added to to both the filter recordset and the main one
        editor.insertAt(['d'], { metadata: {}, value : { queueName: 'queueD' }} as IRecord);
        let keys = (editor.getState() as IRecordset).filter?.keys;
        expect(keys).toEqual(['b','d']);
        let records = (editor.getState() as IRecordset).records;
        expect(Object.values(records).map(record => ((record as IRecord).value as FieldMapping).queueName)).toEqual(['a', 'b','queueD']);
        // check that when we add a record which does not comply with the criteria, it is note added to to the filter recordset
        editor.insertAt(['0'], { metadata: { }, value : { queueName: '0queue' }} as IRecord);
        keys = (editor.getState() as IRecordset).filter?.keys;
        expect(keys).toEqual(['b','d']);
        records = (editor.getState() as IRecordset).records;
        expect(Object.values(records).map(record => ((record as IRecord).value as FieldMapping).queueName)).toEqual(['0queue', 'a', 'b','queueD']);
    })

});
