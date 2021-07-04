export class Registry<T> {
    store: Map<string, T>
    factories: Map<string, ((key?: string)=>T)> 

    resolve(key : string) : T {
        let t = this.store.get(key);
        if (t !== undefined) return t;
        let factory = this.factories.get(key);
        if (factory !== undefined) {
            t = factory(key);
            this.store.set(key, t);
        } else {
            throw new ReferenceError(`${key} does not exist in the registry`)
        }
        return t;
    }

    register(key: string, item : T) : void {
        this.store.set(key, item);
    }

    registerFactory(key: string, itemFactory : ((key?: string)=>T)) : void {
        this.factories.set(key, itemFactory);
    }

    constructor() {
        this.store = new Map();
        this.factories = new Map();
    }
}

const globalRegistry = new Map<Function, Registry<any>>();

type Constructor<T> = Function & { prototype: T }

export default function getRegistry<T>(ctor: Constructor<T>) : Registry<T> {
    let registry = globalRegistry.get(ctor);
    if (!registry) {
        registry = new Registry<T>();
        globalRegistry.set(ctor, registry);
    }
    return registry as Registry<T>;
}