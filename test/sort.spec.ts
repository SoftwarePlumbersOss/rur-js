import { Order, apply } from '../src/sort';


describe('test sort', () => {

    if ('has output compatible with array sort') {
        expect(Number(true)).toBeGreaterThan(0);
        expect(Number(false)).toBeLessThanOrEqual(0);
    }

    it('sorts simple strings', ()=>{
        expect(apply('a', 'a', Order.ASCENDING)).toBe(0);
        expect(apply('a', 'b', Order.ASCENDING)).toBe(-1);
        expect(apply('b', 'a', Order.ASCENDING)).toBe(1);
        expect(apply('a', 'a', Order.DESCENDING)).toBe(0);
        expect(apply('a', 'b', Order.DESCENDING)).toBe(1);
        expect(apply('b', 'a', Order.DESCENDING)).toBe(-1);
    });

    it('sorts simple numbers', ()=>{
        expect(apply(1, 1, Order.ASCENDING)).toBe(0);
        expect(apply(1, 2, Order.ASCENDING)).toBe(-1);
        expect(apply(2, 1, Order.ASCENDING)).toBe(1);
        expect(apply(1, 1, Order.DESCENDING)).toBe(0);
        expect(apply(1, 2, Order.DESCENDING)).toBe(1);
        expect(apply(2, 1, Order.DESCENDING)).toBe(-1);        
    });    

    it('sorts simple objects', ()=>{
        expect(apply({ A: 1, B: 2 }, { A: 1, B: 3 }, { A: Order.ASCENDING })).toBe(0);
        expect(apply({ A: 1, B: 2 }, { A: 2, B: 3 }, { A: Order.ASCENDING })).toBe(-1);
        expect(apply({ A: 2, B: 2 }, { A: 1, B: 3 }, { A: Order.ASCENDING })).toBe(1);

        expect(apply({ A: 1, B: 2 }, { A: 2, B: 3 }, { A: Order.ASCENDING, B: Order.ASCENDING })).toBe(-1);
        expect(apply({ A: 1, B: 3 }, { A: 2, B: 2 }, { A: Order.ASCENDING, B: Order.ASCENDING })).toBe(-1);
        expect(apply({ A: 2, B: 2 }, { A: 1, B: 3 }, { A: Order.ASCENDING, B: Order.ASCENDING })).toBe(1);
        expect(apply({ A: 2, B: 3 }, { A: 1, B: 2 }, { A: Order.ASCENDING, B: Order.ASCENDING })).toBe(1);
        expect(apply({ A: 2, B: 2 }, { A: 2, B: 3 }, { A: Order.ASCENDING, B: Order.ASCENDING })).toBe(-1);
        expect(apply({ A: 2, B: 3 }, { A: 2, B: 2 }, { A: Order.ASCENDING, B: Order.ASCENDING })).toBe(1);
        expect(apply({ A: 1, B: 2 }, { A: 2, B: 2 }, { A: Order.ASCENDING, B: Order.ASCENDING })).toBe(-1);
        expect(apply({ A: 2, B: 2 }, { A: 1, B: 2 }, { A: Order.ASCENDING, B: Order.ASCENDING })).toBe(1);
        expect(apply({ A: 2, B: 2 }, { A: 2, B: 2 }, { A: Order.ASCENDING, B: Order.ASCENDING })).toBe(0);
    });
});