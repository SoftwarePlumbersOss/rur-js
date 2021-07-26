import { combineReducers, Reducer, AnyAction } from "redux";
import { reduce as accessorReducer } from "./accessor";
import { reduce as navigatorReducer } from "./navigator";


let basePath : string[] = [];
let reducer : Reducer<any, AnyAction> | undefined = undefined;

/** Get the RUR reducer.
 * 
 * If the RUR reducer is combined with other reducers, specify its name in the combined reducer below.
 * 
 * We'd expect to see something like:
 * 
 * const reducer = combineReducers({ rur: getReducer('rur'), ...other reducers... }).
 * 
 * This is because we have much code in this module which needs to know how to find the RUR state in
 * the application state. If you don't specify the location below, RUR will assume that it is
 * the root reducer - which is fine if RUR is the only reducer in your application but not otherwise.
 * 
 * @param reducerName the name of the reducer in the global application state 
 * @returns  the RUR reducer
 */
export function getReducer(...reducerName : string[]) {
    if (reducer === undefined) {
        reducer = combineReducers({ navigator: navigatorReducer, data: accessorReducer });
        basePath = reducerName;
    }
    return reducer;
}

/** Get the base path of the RUR reducer */
export function getBasePath() : string[] {
    return basePath;
}