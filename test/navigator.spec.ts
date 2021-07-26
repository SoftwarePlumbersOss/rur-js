/**
 * @jest-environment jsdom
 */

import 'fake-indexeddb/auto';
import thunk, { ThunkDispatch } from 'redux-thunk';
import configureMockStore from 'redux-mock-store';
import { getBrowserNavigator } from '../src/navigator';
import { DataSource, Driver } from '../src/accessor';
import { configQueues, configRequests, queues as queueData, requests as requestData } from './testdata';
import { getReducer } from '../src/reducer';
import registry from '../src/registry';
import { DexieCollection, DexieDriver } from '../src/drivers/dexie';
import { FieldMapping, RichField } from '../src/state';
import { createBrowserHistory } from 'history';

// Set up the test store
type DispatchExts = ThunkDispatch<any, void, any> // this sucks.
const middlewares = [ thunk ];
const initialState = (actions : any) => actions.reduce(getReducer(), {});
function createStore() { return configureMockStore<any, DispatchExts>(middlewares)(initialState); }

// Get the history object so we can check calls are being made
const history = createBrowserHistory();
// Get the global Navigator object
const navigator = getBrowserNavigator(history);

// Set up the dexie (IndexedDB) driver
const drivers = registry(Driver);
drivers.register("dexie", new DexieDriver({ 
    queues: [],
    requests: []
}));

// Set up two datasources
const queues = new DataSource(configQueues);
const requests = new DataSource(configRequests);
const datasources = registry(DataSource);
datasources.register('queues', queues);
datasources.register('requests', requests);


describe('test simple navigation actions', ()=>{

    // Preload the fake indexedDb with data
    beforeEach(async () => {
        const driver = drivers.resolve("dexie");
        const queues = driver.getCollection('queues') as DexieCollection;
        const requests = driver.getCollection('requests') as DexieCollection;
        await queues.removeAll();
        await requests.removeAll();
        try {
            for (let [key, data] of Object.entries(queueData.records)) await queues.set((data as RichField).value as FieldMapping, key)
            for (let [key, data] of Object.entries(requestData.records)) await requests.set((data as RichField).value as FieldMapping, key)
        } catch (err) {
            console.error(err);
            fail(String(err));
        }
    })

    it('can push a data path', async ()=>{
        const spy = jest.spyOn(history, 'replace');
        const store = createStore();
        // navigate to a location on the default data path
        await store.dispatch(navigator.push('/queues/a'));
        // check that the data has been loaded from indexedDb
        expect(queues.get(store.getState(),'a','queueName')).toEqual('a');
        expect(store.getState().navigator.path).toEqual('/queues/a');
        // check that the underlying push was also called
        expect(spy).toHaveBeenCalledWith('/queues/a');
        spy.mockRestore();
    });

    it('can pop a data path', async ()=>{
        const spy = jest.spyOn(history, 'replace');
        const store = createStore();
        const queuesCollection = drivers.resolve("dexie").getCollection('queues');
        // navigate to a location on the default data path
        await store.dispatch(navigator.push('/queues/a'));
        // check we have set the current path
        expect(store.getState().navigator.path).toEqual('/queues/a');
        // navigate to a location on the default data path
        await store.dispatch(navigator.push('/queues/b'));
        expect(store.getState().navigator.path).toEqual('/queues/b');
        expect(store.getState().navigator.previous.path).toEqual('/queues/a');
        // sneakily change the value for a in the underlying data store
        await queuesCollection.set({ queueName: 'other'}, 'a');
        // navigate to a location on the default data path
        await store.dispatch(navigator.pop());
        // check that the data for 'a' has been refreshed
        expect(store.getState().navigator.path).toEqual('/queues/a');
        expect(queues.get(store.getState(),'a','queueName')).toEqual('other');
        // check that the underlying push was also called
        expect(spy).toHaveBeenCalledWith('/queues/a');
        spy.mockRestore();
    });

    it('can push a data path which traverses a reference', async ()=>{
        const spy = jest.spyOn(history, 'replace');
        const store = createStore();
        // navigate to a location on the default data path
        await store.dispatch(navigator.push('/queues/a/items/0'));
        // check that the data has been loaded from indexedDb
        expect(queues.get(store.getState(),'a','queueName')).toEqual('a');
        expect(requests.get(store.getState(),'a1','timeAt')).toEqual(((requestData.records.a1 as RichField).value as FieldMapping).timeAt);
        expect(store.getState().navigator.path).toEqual('/queues/a/items/0');
        // check that the underlying push was also called
        expect(spy).toHaveBeenCalledWith('/queues/a/items/0');
        spy.mockRestore();
    });

});