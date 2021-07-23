
import { createBrowserHistory } from 'history';
import { Action } from 'redux';
import { ThunkAction, ThunkDispatch } from 'redux-thunk';
import { Accessor } from './accessor';
import { DataSource } from './datasource';
import { pathToRegexp, match, parse, compile, Key } from 'path-to-regexp';
import registry from './registry';
import { ReferenceBoundary } from './exceptions';
import { KeyPart } from './types';

const history = createBrowserHistory();

const datasources = registry(DataSource);

enum ActionType {
    push = "RUR_NAV_PUSH",
    pop = "RUR_NAV_POP",
    replace = "RUR_NAV_REPLACE"
}

interface NavigationAction {
    type: ActionType
}

interface PathAction extends Action {
    path: string
}

export type Dispatch = ThunkDispatch<any, undefined, NavigationAction>;

export type AsyncAction<T extends NavigationAction> = ThunkAction<Promise<void>, any, undefined, T>;

abstract class Navigator {
    abstract push(path : string) : AsyncAction<PathAction>;
    abstract pop() : AsyncAction<Action>;
    abstract replace(path: string) : AsyncAction<PathAction>;
}

interface NavigatorState {
    path: string,
    parent?: NavigatorState
}

const Guards = {
    isPathAction(action: NavigationAction) : action is PathAction {
        return (action as PathAction).path !== undefined;
    }
}

class BaseNavigator extends Navigator {

    static reduce(state: NavigatorState, action: NavigationAction) {
        switch (action.type) {
            case ActionType.pop:
                state = state.parent ?? state;
                break;
            case ActionType.push:
                if (Guards.isPathAction(action)) {
                    state = { path: action.path, parent: state }
                } else {
                    throw new TypeError(`invalid action type`)
                }
                break;
            case ActionType.replace:
                if (Guards.isPathAction(action)) {
                    state = { ...state, path: action.path }
                } else {
                    throw new TypeError(`invalid action type`)
                }
                break;
        }

    }

    push(path: string): AsyncAction<PathAction> {
        return (dispatch, getState) => {
            history.replace(path);
            dispatch({type: ActionType.push, path : path});
            return Promise.resolve();
        }
    }

    pop(): AsyncAction<NavigationAction> {
        return (dispatch, getState) => {
            const path = getState().navigator.path;
            history.replace(path);
            dispatch({type: ActionType.pop});
            return Promise.resolve();
        }
    }

    replace(path: string): AsyncAction<PathAction> {
        return (dispatch, getState) => {
            history.replace(path);
            dispatch({type: ActionType.replace, path : path});
            return Promise.resolve();
        }
    }   
}

type DataPath = (Accessor | KeyPart)[]

type NavigatorConfig = [pathTemplate : string, config: DataPath][]

class DataNavigator extends Navigator {

    paths : { pathRegExp: RegExp, paramMap: { [index: string] : number }, config: DataPath } []
    navigator : Navigator;

    constructor(navigator: Navigator, config : NavigatorConfig = []) {
        super();
        this.paths = config.map(([pathTemplate, config]) => {
            const pathParams : Key[] = [];
            const pathRegExp = pathToRegexp(pathTemplate, pathParams);
            const paramMap : { [index: string] : number } = {}
            pathParams.forEach((key,index)=>{
                if (key.name && Number.isNaN(key.name)) paramMap[key.name] = index+1;
            });
            return { pathRegExp, paramMap, config }
        })
        this.navigator = navigator;
    }

    static loadDataPath(dispatch : Dispatch, getState : ()=>any, initialContext : Accessor, path : DataPath) : Promise<void> {
        if (path.length > 0) {
            const [ head, ...tail ] = path;
            if (head instanceof Accessor) 
                return this.loadDataPath(dispatch, getState, head, tail);
            else {
                if (initialContext instanceof DataSource) {
                    return dispatch(initialContext.load(head)).then(()=>DataNavigator.loadDataPath(dispatch, getState, initialContext.get(head), tail))
                } else {
                    try {
                        const data = initialContext.get(getState(), head); // is this actually necessary to trigger the ReferenceBoundary?
                        return DataNavigator.loadDataPath(dispatch, getState, initialContext.get(head), tail);
                    } catch (err) {
                        if (err instanceof ReferenceBoundary) {
                            let accessor: DataSource;
                            if (typeof err?.config?.recordset === 'string')
                                accessor = datasources.resolve(err.config.recordset);
                            else {
                                let name = err?.config?.recordset.name;
                                accessor = new DataSource(err?.config?.recordset, ["recordset", name]);
                                datasources.register(name, accessor);
                            }
                            return DataNavigator.loadDataPath(dispatch, getState, accessor, [...err.key, ...tail]);
                        } else {
                            throw err;
                        }
                    }
                }
            }
        } else {
            return Promise.resolve();
        }
    }

    protected parseConfiguredPath(path: string) : DataPath | null | undefined {
        for (const { pathRegExp, paramMap, config } of this.paths) {
            let match = pathRegExp.exec(path);
            if (match !== null) {                
                if (config === null) // this implies the path is matched but we just want to block default processing for that path
                    return null;
                else // substitute any matched variables from the path
                    return config.map(element => typeof element === 'string' && paramMap[element] !== undefined ? paramMap[element] : element);
            }
        }
        return undefined;
    }

    protected parseDefaultPath(path : string) : DataPath | undefined {
        const tokens = path.split('/');
        if (tokens.length > 0) {
            const [head, ...tail] = tokens;
            try {
                const datasource = datasources.resolve(head);
                return [ datasource, ...tail ];
            } catch (err) {
                if (err instanceof ReferenceError) 
                    return;
                else
                    throw err;
            }
        } else {
            return undefined;
        }
    }

    protected load(dispatch : Dispatch, getState : ()=>any, path: string) : Promise<void> {
        let dataPath = this.parseConfiguredPath(path);
        if (dataPath === undefined) {
            dataPath = this.parseDefaultPath(path);
        }        
        if (dataPath !== null && dataPath !== undefined) {
            const [ head, ...tail ] = dataPath;
            return DataNavigator.loadDataPath(dispatch, getState, head as Accessor, tail);
        } else {
            return Promise.resolve();
        }
    }

    push(path: string): AsyncAction<PathAction> {
        return (dispatch : Dispatch, getState) => this
            .load(dispatch, getState,path)
            .then(()=>dispatch(this.navigator.push(path)));
    }

    pop(): AsyncAction<NavigationAction> {
        return (dispatch : Dispatch, getState) => this
            .load(dispatch, getState, getState().navigator.path)
            .then(()=>dispatch(this.navigator.pop()));        
    }

    replace(path: string): AsyncAction<PathAction> {
        return (dispatch : Dispatch, getState) => this
            .load(dispatch, getState,path)
            .then(()=>dispatch(this.navigator.replace(path)));
    }
    
}