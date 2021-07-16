export type KeyPart = string | number;

export type Key = KeyPart[];

export const Guards = {

    isKeyPart(value : any) : value is KeyPart { 
        const t = typeof value;
        return t === 'string' || t === 'number'
    }
}