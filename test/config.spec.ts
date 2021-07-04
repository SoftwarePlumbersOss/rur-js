import { RecordsetConfig, getConfig } from '../src/config';
import { DataType } from '../src/datatype';


const config : RecordsetConfig = {
    type: DataType.RECORDSET,
    value: {
        type: DataType.FIELDSET,
        fields: {
            fieldOne: { type: DataType.STRING },
            fieldTwo: { type: DataType.NUMBER }
        }
    },
    collectionName: 'abc'
}

describe('test Config for recordset', () => {
    it('retrieves config for fields in record', ()=>{
        expect(getConfig(config, '*', 'fieldOne').type).toBe(DataType.STRING);
        expect(getConfig(config, '*', 'fieldTwo').type).toBe(DataType.NUMBER);
    });

    it('retrieves config for base object', ()=>{
        expect(getConfig(config).collectionName).toBe('abc');
    }); 
});



