import { DataType, getDataType } from '../src/datatype';
import { DateTime } from 'luxon';
import { RecordsetConfig, getConfig } from '../src/config';

describe('get datatype from State without config', ()=>{

    it('gets datatype for a string', () => {
        expect(getDataType('hello')).toBe(DataType.STRING);
    });

    it('gets datatype for a number', () => {
        expect(getDataType(123)).toBe(DataType.NUMBER);
    });

    it('gets datatype for a DateTime', () => {
        expect(getDataType(DateTime.now())).toBe(DataType.DATETIME);
    });

    it('gets datatype for an array', () => {
        expect(getDataType([])).toBe(DataType.ARRAY);
    });

    it('gets datatype for an object', () => {
        expect(getDataType({ abc: 123 })).toBe(DataType.FIELDSET);
    });

    it('gets datatype for an IRecordset', () => {
        expect(getDataType({ records: [] })).toBe(DataType.RECORDSET);
    });

    it('gets datatype for an IRecord', () => {
        expect(getDataType({ value: 213 })).toBe(DataType.RECORD);
    });
    
})

const config : RecordsetConfig = {
    type: DataType.RECORDSET,
    value: {
        type: DataType.FIELDSET,
        fields: {
            fieldOne: { type: DataType.STRING },
            fieldTwo: { type: DataType.NUMBER },
            fieldThree: { type: DataType.ARRAY }
        }
    },
    collectionName: 'abc'
}

describe('get datatype from State with config', ()=>{

    it('gets datatype for a string', () => {
        expect(getDataType('hello', getConfig(config,'*','fieldOne'))).toBe(DataType.STRING);
    });

    it('gets datatype for a number', () => {
        expect(getDataType(123, getConfig(config,'*','fieldTwo'))).toBe(DataType.NUMBER);
    });

    it('gets datatype for an array', () => {
        expect(getDataType([], getConfig(config,'*','fieldThree'))).toBe(DataType.ARRAY);
    });

    it('gets datatype for a record', () => {
        expect(getDataType({ value: 123 }, getConfig(config,'*'))).toBe(DataType.FIELDSET);
    });

    it('gets datatype for an IRecordset', () => {
        expect(getDataType({ records: [] }, getConfig(config))).toBe(DataType.RECORDSET);
    });

    it('throws a TypeError when config and state disagree', () => {
        expect(()=>getDataType(123, getConfig(config,'*','fieldOne'))).toThrow(TypeError);
        expect(()=>getDataType('123', getConfig(config,'*','fieldTwo'))).toThrow(TypeError);
        expect(()=>getDataType(123, getConfig(config))).toThrow(TypeError);
        expect(()=>getDataType(123, getConfig(config,'*'))).toThrow(TypeError);
    })
})