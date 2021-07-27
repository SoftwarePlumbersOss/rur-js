import getRegistry, { InheritanceTree } from "../src/registry";

abstract class TestType {
    abstract doSomething() : string;
}

class ConcreteType extends TestType {
    name: string;
    doSomething() { return this.name }
    constructor(name: string) { super(); this.name = name; }
}

describe('Registry tests', ()=>{
    it('can retrieve correct registered object', ()=>{
        const registry = getRegistry(TestType);
        registry.register('abc', new ConcreteType('abc Instance'));
        registry.register('def', new ConcreteType('def Instance'));
        const item : TestType = registry.resolve('abc');
        expect(item.doSomething()).toBe('abc Instance');
    })
});

describe('Inheritance tree tests', ()=>{
    it('can retrieve correct registered object', ()=>{
        const iht = new InheritanceTree<number>(Object, 0);
        iht.add(TestType, 1);
        iht.add(ConcreteType, 2);

        expect(iht.get(ConcreteType)).toEqual([2]);
        expect(iht.get(TestType).sort()).toEqual([1,2]);
        expect(iht.getExact(TestType)).toEqual(1);
        expect(iht.get(Object).sort()).toEqual([0,1,2]);
        expect(iht.getExact(Object)).toEqual(0);
    })

    it('can retrieve correct registered object when types added in wrong order', ()=>{
        const iht = new InheritanceTree<number>(Object, 0);
        iht.add(ConcreteType, 2);
        iht.add(TestType, 1);
        expect(iht.get(ConcreteType)).toEqual([2]);
        expect(iht.get(TestType).sort()).toEqual([1,2]);
        expect(iht.get(Object).sort()).toEqual([0,1,2]);
    })    

});