
/** Registry for items of a particular type */
class SubRegistry<T> {
    store: Map<string, T>
    factories: Map<string, ((key?: string)=>T)> 

    resolveInstance(key : string) : T | undefined {
        return this.store.get(key);
    }

    resolveFactory(key : string) :  ((key?: string)=>T) | undefined {
        return this.factories.get(key);
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

type Constructor<T> = Function & { prototype: T }

/** Organize subregistries by type */
export class InheritanceTree<U> {

    private children : InheritanceTree<U>[]
    private data : U;
    private type: Constructor<Object>;

    constructor(type : Constructor<any> = Object, data : U) {
        this.children = [];
        this.type = type;
        this.data = data;
    }

    // t1 is a subclass or same class as T2
    static isA<T1,T2>(t1 : Constructor<T1>, t2: Constructor<T2>) : boolean {
        return t1 === t2 || t2.prototype.isPrototypeOf(t1.prototype);
    }

    add<T>(ctor : Constructor<T>, data : U) {
        for (let child of this.children) {
            // Simple; new class is a subclass of one of our children. Add it to
            // that child, then return
            if (child.type.prototype.isPrototypeOf(ctor.prototype)) {
                child.add(ctor, data);
                return;
            }
        }
        // Not a child of any existing child, must be a peer
        let newChild = new InheritanceTree<U>(ctor, data);
        let newChildren = [ newChild ];
        for (let child of this.children) {
            if (ctor.prototype.isPrototypeOf(child.type.prototype)) {
                newChild.children.push(child);
            } else {
                newChildren.push(child);
            }
        }
        this.children = newChildren;
    }

    get<T>(ctor: Constructor<T>) : U[] {
        if (InheritanceTree.isA(this.type, ctor)) {
            return this.children.map(child => child.get(ctor)).reduce((a,v)=>a.concat(v), [this.data]);
        } else if (InheritanceTree.isA(ctor, this.type)) {
            return this.children.map(child => child.get(ctor)).reduce((a,v)=>a.concat(v), []);
        } else {
            return [];
        }
    }

    getExact<T>(ctor: Constructor<T>) : U | undefined {
        if (InheritanceTree.isA(ctor, this.type)) {
            return (this.type === ctor) ? this.data : this.children.map(child => child.getExact(ctor)).find(result => result !== undefined);
        } else {
            return undefined;
        }
    }

}

const globalRegistry = new InheritanceTree<SubRegistry<any>>(Object, new SubRegistry<Object>());
class GlobalRegistry<T extends Object> {

    type : Constructor<T>;

    constructor(type: Constructor<T>) {
        this.type = type;
    }

    resolve(key: string) : T {
        const subregistries = globalRegistry.get(this.type);
        // first try to resolve an existing instance
        for (const subregistry of subregistries) {
            const result = subregistry.resolveInstance(key);
            if (key) return result;
        }
        // now try to resolve a factory
        for (const subregistry of subregistries) {
            const factory = subregistry.resolveFactory(key);
            if (factory) {
                const instance = factory(key);
                this.register(key, instance);
                return instance;
            }
        }
        throw new ReferenceError(`${key} does not exist in the registry`)
    }

    register(key: string, item : T) : void {
        let subregistry = globalRegistry.getExact(item.constructor);
        if (subregistry === undefined) {
            subregistry = new SubRegistry();
            globalRegistry.add(item.constructor, subregistry);
        }
        subregistry.register(key, item);
    }

    registerFactory(key: string, itemFactory : ((key?: string)=>T)) : void {
        let subregistry = globalRegistry.getExact(this.type);
        if (subregistry === undefined) {
            subregistry = new SubRegistry();
            globalRegistry.add(this.type, subregistry);
        }
        subregistry.registerFactory(key, itemFactory);
    }
}

export default function getRegistry<T>(ctor: Constructor<T>) : GlobalRegistry<T> {
    return new GlobalRegistry(ctor);
}