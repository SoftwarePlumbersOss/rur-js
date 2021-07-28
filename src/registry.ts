/** A Quick and Dirty IOC framework */

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

/** Organize objects by type.
 * 
 * Associates data with a type (e.g. a constructor). Implements a reasonably
 * efficient search for all data associated with a given class, which will 
 * pull in both data directly linked to that class and data linked to any
 * subclass of the requested class.
 * 
 */
export class InheritanceTree<U> {

    private children : InheritanceTree<U>[]
    private data : U;
    private type: Constructor<Object>;

    constructor(type : Constructor<any> = Object, data : U) {
        this.children = [];
        this.type = type;
        this.data = data;
    }

    /** Test to see whether one type is a subclass of another.
     * 
     * @param t1 
     * @param t2 
     * @returns true if t1 is either identical to, or a subclass of, t2
     */
    static isA<T1,T2>(t1 : Constructor<T1>, t2: Constructor<T2>) : boolean {
        return t1 === t2 || t2.prototype.isPrototypeOf(t1.prototype);
    }

    /** Add new data to the inheritance tree.
     * 
     * @param ctor Type with which we are associating some data
     * @param data Data to associate with the type
     */
    add<T>(ctor : Constructor<T>, data : U) : void {
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

    /** Get all data associated with a given type and its subtypes */
    get<T>(ctor: Constructor<T>) : U[] {
        if (InheritanceTree.isA(this.type, ctor)) {
            return this.children.map(child => child.get(ctor)).reduce((a,v)=>a.concat(v), [this.data]);
        } else if (InheritanceTree.isA(ctor, this.type)) {
            return this.children.map(child => child.get(ctor)).reduce((a,v)=>a.concat(v), []);
        } else {
            return [];
        }
    }

    /** Get data associated specifically with the given type */
    getExact<T>(ctor: Constructor<T>) : U | undefined {
        if (InheritanceTree.isA(ctor, this.type)) {
            return (this.type === ctor) ? this.data : this.children.map(child => child.getExact(ctor)).find(result => result !== undefined);
        } else {
            return undefined;
        }
    }
}

/** Global registry data */
const globalRegistry = new InheritanceTree<SubRegistry<any>>(Object, new SubRegistry<Object>());

/** Registry for data which is a subclass of some type T 
 * 
 */
class GlobalRegistry<T extends Object> {

    /** All data in this registry is of the given type or a subclass of it */
    private type : Constructor<T>;

    constructor(type: Constructor<T>) {
        this.type = type;
    }

    /** Get an instance which has previously been registered (or for which a factory has been registered).
     * 
     * The returned instance must be of type T or of some subclass of it. Throws a ReferenceError if no
     * instance or factory is registered with a compatible type and name.
     * 
     * @param key Unique name for the instance
     * @returns An instance of this registry's type which has previously been registered (or for which there is a registered factory)
     */
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

    /** Register an instance of type T under a given name */
    register(key: string, item : T) : void {
        let subregistry = globalRegistry.getExact(item.constructor);
        if (subregistry === undefined) {
            subregistry = new SubRegistry();
            globalRegistry.add(item.constructor, subregistry);
        }
        subregistry.register(key, item);
    }

    /** Register a factory for instances of type T under a given name 
     * 
     * The actual instance will not be created until it is actually requested.
     */
    registerFactory(key: string, itemFactory : ((key?: string)=>T)) : void {
        let subregistry = globalRegistry.getExact(this.type);
        if (subregistry === undefined) {
            subregistry = new SubRegistry();
            globalRegistry.add(this.type, subregistry);
        }
        subregistry.registerFactory(key, itemFactory);
    }
}

/** Get a registry we can use to register global named instances of a given type */
export default function getRegistry<T>(ctor: Constructor<T>) : GlobalRegistry<T> {
    return new GlobalRegistry(ctor);
}