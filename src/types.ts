export type KeyPart = string | number;

export type Key = KeyPart[];

export interface Filterable<T> extends Iterable<T> {
    filter(predicate : (item: T) => boolean) : this;
}

export interface Mapable<T> extends Iterable<T> {
    map<U>(predicate : (item: T) => U) : Iterable<U>;
}

export const Guards = {

    isKeyPart(value : any) : value is KeyPart { 
        const t = typeof value;
        return t === 'string' || t === 'number'
    }
}