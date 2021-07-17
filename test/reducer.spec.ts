import { AnyAction } from 'redux';
import thunk, { ThunkDispatch } from 'redux-thunk';
import configureMockStore from 'redux-mock-store';

import { reduce, Action } from '../src/reducer';
import { Accessor, BaseAccessor } from '../src/accessor';
import { configQueues, state } from './testdata';

type DispatchExts = ThunkDispatch<any, void, any> // this sucks.

const middlewares = [ thunk ];
const initialState = (actions : any) => actions.reduce(reduce, state);
function createStore() { return configureMockStore<any, DispatchExts>(middlewares)(initialState); }

const queueAccessor : Accessor = new BaseAccessor(configQueues, ['recordset', 'queues']);

describe('test simple reducer', ()=>{

    it('can set a simple field by key', ()=>{
        let store = createStore();
        store.dispatch(queueAccessor.set("newQueueName", 'b', 'queueName'));
        expect(queueAccessor.get(store.getState(), 'b', 'queueName')).toBe('newQueueName');
    });

    it('can set a simple field metadata by key', ()=>{
        let store = createStore();
        store.dispatch(queueAccessor.setMetadata("wrong", 'b', 'queueName', 'error'));
        expect(queueAccessor.getMetadata(store.getState(), 'b', 'queueName', 'error')).toBe('wrong');
    });

    it('can merge simple field metadata by key', ()=>{
        let store = createStore();
        store.dispatch(queueAccessor.mergeMetadata({ metadata: { error: 'wrong' } }, 'b', 'queueName'));
        expect(queueAccessor.getMetadata(store.getState(), 'b', 'queueName', 'error')).toBe('wrong');
    });

    it('can set an array item by index', ()=>{
        let store = createStore();
        store.dispatch(queueAccessor.set("two", 'a', 'otherItems', 1));;
        expect(queueAccessor.get(store.getState(),'a','otherItems',1)).toBe('two');
    }); 

    it('can insert an array item by index', ()=>{
        let store = createStore();
        store.dispatch(queueAccessor.insertValue("two", 'a', 'otherItems', 1));;
        expect(queueAccessor.get(store.getState(),'a','otherItems',0)).toBe('one');
        expect(queueAccessor.get(store.getState(),'a','otherItems',1)).toBe('two');
        expect(queueAccessor.get(store.getState(),'a','otherItems',2)).toBe('three');
    })

    it('can remove an array item by index', ()=>{
        let store = createStore();
        store.dispatch(queueAccessor.removeValue('a', 'otherItems', 1));;
        expect(queueAccessor.get(store.getState(),'a','otherItems',0)).toBe('one');
        expect([...Accessor.keys(queueAccessor.get(store.getState(),'a','otherItems'))]).toHaveLength(1);
        store = createStore();
        store.dispatch(queueAccessor.removeValue('a', 'otherItems', 0));
        expect(queueAccessor.get(store.getState(),'a','otherItems',0)).toBe('three');
        expect([...Accessor.keys(queueAccessor.get(store.getState(),'a','otherItems'))]).toHaveLength(1);    
        store.dispatch(queueAccessor.removeValue('a', 'otherItems', 0));;
        expect([...Accessor.keys(queueAccessor.get(store.getState(),'a','otherItems'))]).toHaveLength(0);        
    })    

    it('can add an array item', ()=>{
        let store = createStore();
        store.dispatch(queueAccessor.addValue("four", 'a', 'otherItems'));;
        expect(queueAccessor.get(store.getState(),'a','otherItems',0)).toBe('one');
        expect(queueAccessor.get(store.getState(),'a','otherItems',1)).toBe('three');
        expect(queueAccessor.get(store.getState(),'a','otherItems',2)).toBe('four');
    })    
});

