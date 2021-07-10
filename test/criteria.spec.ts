import { Filter, Operator, apply, expand } from '../src/criteria';


describe('test Filter', () => {
    it('compares simple strings', ()=>{
        expect(apply('a', { operator: Operator.EQUALS, value: 'a' })).toBe(true);
        expect(apply('a', { operator: Operator.EQUALS, value: 'b' })).toBe(false);
        expect(apply('a', { operator: Operator.LESS_THAN, value: 'b' })).toBe(true);
        expect(apply('a', { operator: Operator.LESS_THAN, value: 'a' })).toBe(false);
        expect(apply('a', { operator: Operator.LESS_THAN_OR_EQUALS, value: 'b' })).toBe(true);
        expect(apply('a', { operator: Operator.LESS_THAN_OR_EQUALS, value: 'a' })).toBe(true);
        expect(apply('b', { operator: Operator.LESS_THAN_OR_EQUALS, value: 'a' })).toBe(false);
        expect(apply('b', { operator: Operator.GREATER_THAN, value: 'a' })).toBe(true);
        expect(apply('a', { operator: Operator.GREATER_THAN, value: 'a' })).toBe(false);
        expect(apply('a', { operator: Operator.GREATER_THAN_OR_EQUALS, value: 'b' })).toBe(false);
        expect(apply('a', { operator: Operator.GREATER_THAN_OR_EQUALS, value: 'a' })).toBe(true);
        expect(apply('b', { operator: Operator.GREATER_THAN_OR_EQUALS, value: 'a' })).toBe(true);
        expect(apply('ab', { operator: Operator.STARTS_WITH, value: 'a' })).toBe(true);
        expect(apply('ab', { operator: Operator.STARTS_WITH, value: 'b' })).toBe(false);
    });

    it('compares simple numbers', ()=>{
        expect(apply(1, { operator: Operator.EQUALS, value: 1 })).toBe(true);
        expect(apply(1, { operator: Operator.EQUALS, value: 2 })).toBe(false);
        expect(apply(1, { operator: Operator.LESS_THAN, value: 2 })).toBe(true);
        expect(apply(1, { operator: Operator.LESS_THAN, value: 1 })).toBe(false);
        expect(apply(1, { operator: Operator.LESS_THAN_OR_EQUALS, value: 2 })).toBe(true);
        expect(apply(1, { operator: Operator.LESS_THAN_OR_EQUALS, value: 1 })).toBe(true);
        expect(apply(2, { operator: Operator.LESS_THAN_OR_EQUALS, value: 1 })).toBe(false);
        expect(apply(2, { operator: Operator.GREATER_THAN, value: 1 })).toBe(true);
        expect(apply(1, { operator: Operator.GREATER_THAN, value: 1 })).toBe(false);
        expect(apply(1, { operator: Operator.GREATER_THAN_OR_EQUALS, value: 2 })).toBe(false);
        expect(apply(1, { operator: Operator.GREATER_THAN_OR_EQUALS, value: 1 })).toBe(true);
        expect(apply(2, { operator: Operator.GREATER_THAN_OR_EQUALS, value: 1 })).toBe(true);
    });

    it('expands packed form', ()=>{
        expect(expand({ name: 'aaron', age : 100 })          
        ).toEqual({ operator: Operator.MATCHES_TEMPLATE, value: { name:  { operator: Operator.EQUALS, value: 'aaron' }, age: { operator: Operator.EQUALS, value: 100 } } })
        expect(expand({ name: { ">": 'aaron'}, age : { "<": 100 }})          
        ).toEqual({ operator: Operator.MATCHES_TEMPLATE, value: { name:  { operator: Operator.GREATER_THAN, value: 'aaron' }, age: { operator: Operator.LESS_THAN, value: 100 } } })
    });      

    it('compares objects', ()=>{
        expect(apply(
            { name: 'jonathan', age: 51 }, 
            expand({ name: { ">": 'aaron'}, age : { "<": 100 }})
        )).toBe(true);
        expect(apply(
            { name: 'jonathan', age: 51 }, 
            expand({ name: { "<": 'aaron'}, age : { "<": 100 }})
        )).toBe(false);
        expect(apply(
            { name: 'jonathan', age: 51 }, 
            expand({ name: { ">": 'aaron'}, age : { ">": 100 }})
        )).toBe(false);
        expect(apply(
            { name: 'jonathan', age: 51 }, 
            expand({ name: { "<": 'aaron'}, age : { ">": 100 }})
        )).toBe(false);
    });    

});