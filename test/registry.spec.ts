import getRegistry from "../src/registry";

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