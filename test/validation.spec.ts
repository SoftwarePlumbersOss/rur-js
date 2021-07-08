import { configQueues, configRequests, state } from './testdata';
import { validate } from '../src/validation';
import { edit } from '../src/editor';
import { Exception, ErrorCode } from '../src/exceptions';

const queues = state.recordset.queues;

describe('test simple validation', ()=>{
    it('can validate a simple field by index', ()=>{
        let editor = edit(configQueues, queues);
        editor.set([0, 'queueName'], "newQueueName");
        editor.editAt([0, 'queueName'], validate);
        expect(editor.getMetadataAt([0, 'queueName', 'error'])).toBeUndefined();
        editor.set([0, 'queueName'], "something greater than 32 characters which is the maximum in the config file");
        editor.editAt([0, 'queueName'], validate);
        expect((editor.getMetadataAt([0, 'queueName', 'error']) as Exception)?.code).toBe(ErrorCode.STATE_VALIDATION);
    });

    it('can cancel an error', ()=>{
        let editor = edit(configQueues, queues);
        editor.set([0, 'queueName'], "something greater than 32 characters which is the maximum in the config file");
        editor.editAt([0, 'queueName'], validate);
        expect((editor.getMetadataAt([0, 'queueName', 'error']) as Exception)?.code).toBe(ErrorCode.STATE_VALIDATION);
        editor.set([0, 'queueName'], "newQueueName");
        editor.editAt([0, 'queueName'], validate);
        expect(editor.getMetadataAt([0, 'queueName', 'error'])).toBeUndefined();
    });    
});