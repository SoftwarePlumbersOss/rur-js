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
import { DexieDriver } from '../src/drivers/dexie';
import { FieldMapping, RichField } from '../src/state';

type DispatchExts = ThunkDispatch<any, void, any> // this sucks.

const middlewares = [ thunk ];
const initialState = (actions : any) => actions.reduce(getReducer(), {});
function createStore() { return configureMockStore<any, DispatchExts>(middlewares)(initialState); }

const navigator = getBrowserNavigator();


const drivers = registry(Driver);

drivers.register("dexie", new DexieDriver({ 
    queues: [],
    requests: []
}));

const queues = new DataSource(configQueues);
const requests = new DataSource(configRequests);

const datasources = registry(DataSource);

datasources.register('queues', queues);
datasources.register('requests', requests);


describe('test simple navigation actions', ()=>{

    // Preload the fake indexedDb with data
    beforeAll(async () => {
        const driver = drivers.resolve("dexie");
        const queues = driver.getCollection('queues');
        const requests = driver.getCollection('requests');
        try {
            for (let [key, data] of Object.entries(queueData.records)) await queues.set((data as RichField).value as FieldMapping, key)
            for (let [key, data] of Object.entries(requestData.records)) await requests.set((data as RichField).value as FieldMapping, key)
        } catch (err) {
            console.error(err);
            fail(String(err));
        }
    })

    it('can push a data path', async ()=>{
        let store = createStore();
        // navigate to a location on the default data path
        await store.dispatch(navigator.push('/queues/a'));
        // check that the data has been loaded from indexedDb
        expect(queues.get(store.getState(),'a','queueName')).toEqual('a');
    });
});