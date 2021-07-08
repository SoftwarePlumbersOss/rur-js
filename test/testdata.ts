import { DataType } from '../src/datatype';
import { RecordsetConfig } from '../src/config';
import { Recordset } from '../src/state';

export const configQueues : RecordsetConfig = {
    firestoreCollection: 'queues',
    type: DataType.RECORDSET,
    value: {
        type: DataType.FIELDSET,
        fields: {
            queueName: { maxLength: 32 },
            items: { 
                type: DataType.RECORDSET, 
                value: {
                    type: DataType.REFERENCE,
                    recordset: 'requests'
                }
            }
        }
    },
    textSearchFields: [ "queueName" ]
};

export const configRequests: RecordsetConfig = {
    firestoreCollection: 'requests',
    type: DataType.RECORDSET,
    value: {
        type: DataType.FIELDSET,
        fields: {
            user: {
                type: DataType.REFERENCE,
                recordset: 'users'
            },
            song: {
                type: DataType.REFERENCE,
                recordset: 'songs'
            },
        }
    }
}

const requests : Recordset = [
    { 
        metadata: { key: 'a1'},
        value: {
            user: 'a1user',
            song: 'a1song'
        }
    },{
        metadata: { key: 'a2'},
        value: {
            user: 'a2user',
            song: 'a2song'
        }

    },{ 
        metadata: { key: 'b1'},
        value: {
            user: 'b1user',
            song: 'b1song'
        }
    },{
        metadata: { key: 'b2'},
        value: {
            user: 'b2user',
            song: 'b2song'
        }

    }
]

const users : Recordset = [
    {
        metadata: { key: 'a1user' },
        value: {
            firstName: 'jonathan',
            lastName: 'essex'
        }
    },{
        metadata: { key: 'a2user' },
        value: {
            firstName: 'commander',
            lastName: 'keene'
        }
    },{
        metadata: { key: 'b1user' },
        value: {
            firstName: 'simon',
            lastName: 'templar'
        }
    },{
        metadata: { key: 'b2user' },
        value: {
            firstName: 'testy',
            lastName: 'mctester'
        }
    }
]

const songs : Recordset = [
    {
        metadata: { key: 'a1song' },
        value: {
            title: 'song1',
            artist: 'artist1'
        }
    },{
        metadata: { key: 'a2song' },
        value: {
            title: 'song2',
            artist: 'artist2'
        }
    },{
        metadata: { key: 'b1song' },
        value: {
            title: 'song3',
            artist: 'artist3'
        }
    },{
        metadata: { key: 'b2song' },
        value: {
            title: 'song4',
            artist: 'artist4'
        }
    }
]

const queues : Recordset = [
    {
        metadata: { key: 'a' },
        value: {
            queueName: 'a',
            otherItems: [ 'one', 'three'],
            items: ['a1','a2']
        }
    },{
        metadata: { key: 'b' },
        value: {
            queueName: 'b',
            items: ['b1', 'b2']
        }
    }
]

export const state = {
    recordset: {
        queues: {
            records: queues,
        },
        users: {
            records: users,
        },
        songs: {
            records: songs,
        },
        requests: {
            records: requests,
        }
    }
}