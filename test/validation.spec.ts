import { configQueues, state } from './testdata';
import { validate } from '../src/validation';
import { edit } from '../src/editor';
import { Exception, ErrorCode } from '../src/exceptions';

const queues = state.data.queues;

describe('test simple validation', ()=>{
    it('can validate a simple field by key', ()=>{
        let editor = edit(configQueues, queues);
        editor.set(['a', 'queueName'], "newQueueName");
        editor.editAt(['a', 'queueName'], validate);
        expect(editor.getMetadataAt(['a', 'queueName', 'error'])).toBeUndefined();
        editor.set(['a', 'queueName'], "something greater than 32 characters which is the maximum in the config file");
        editor.editAt(['a', 'queueName'], validate);
        expect((editor.getMetadataAt(['a', 'queueName', 'error']) as Exception)?.code).toBe(ErrorCode.STATE_VALIDATION);
    });

    it('can cancel an error', ()=>{
        let editor = edit(configQueues, queues);
        editor.set(['a', 'queueName'], "something greater than 32 characters which is the maximum in the config file");
        editor.editAt(['a', 'queueName'], validate);
        expect((editor.getMetadataAt(['a', 'queueName', 'error']) as Exception)?.code).toBe(ErrorCode.STATE_VALIDATION);
        editor.set(['a', 'queueName'], "newQueueName");
        editor.editAt(['a', 'queueName'], validate);
        expect(editor.getMetadataAt(['a', 'queueName', 'error'])).toBeUndefined();
    });    

    it('can validate a field set by key', ()=>{
        let editor = edit(configQueues, queues);
        editor.set(['a', 'queueName'], "something greater than 32 characters which is the maximum in the config file");
        editor.editAt(['a'], validate);
        expect((editor.getMetadataAt(['a', 'queueName', 'error']) as Exception)?.code).toBe(ErrorCode.STATE_VALIDATION);
        expect((editor.getMetadataAt(['a', 'error']) as Exception)?.code).toBe(ErrorCode.STATE_VALIDATION);
    });

});