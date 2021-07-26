import { DataType } from '../src/datatype';
import { DataSourceConfig } from '../src/config';
import { IRecordset } from '../src/state';
import { DateTime } from 'luxon';

export const configQueues : DataSourceConfig = {
    name: 'queues',
    collection: {
        driverName: 'dexie',
        collectionName: 'queues'
    },
    type: DataType.RECORDSET,
    value: {
        type: DataType.FIELDSET,
        fields: {
            queueName: { maxLength: 32 },
            items: { 
                type: DataType.ARRAY, 
                value: {
                    type: DataType.REFERENCE,
                    recordset: 'requests'
                }
            }
        }
    },
    textSearchFields: [ "queueName" ]
};

export const configRequests: DataSourceConfig = {
    name: 'requests',
    collection: {
        driverName: 'dexie',
        collectionName: 'requests'
    },
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
            atTime: {
                type: DataType.DATETIME
            }
        }
    }
}

export const requests : IRecordset = { 
    metadata: {},
    records: {
        'a1' : { 
            metadata: {},
            value: {
                user: 'a1user',
                song: 'a1song',
                atTime: DateTime.fromISO('2015-02-12T:09:33:12.032')
            }
        },
        'a2': {
            metadata: { },
            value: {
                user: 'a2user',
                song: 'a2song',
                atTime: DateTime.fromISO('2015-02-12T:09:34:12.032')
            }

        },
        'b1' : { 
            metadata: { },
            value: {
                user: 'b1user',
                song: 'b1song',
                atTime: DateTime.fromISO('2015-02-12T:09:35:12.032')
            }
        },
        'b2': {
            metadata: { },
            value: {
                user: 'b2user',
                song: 'b2song',
                atTime: DateTime.fromISO('2015-02-12T:09:36:12.032')
            }

        }
    }
}

const users : IRecordset = {
    metadata: {},
    records: {
        'a1user' : {
            metadata: {  },
            value: {
                firstName: 'jonathan',
                lastName: 'essex'
            }
        },
        'a2user' : {
            metadata: {  },
            value: {
                firstName: 'commander',
                lastName: 'keene'
            }
        },
        'b1user' : {
            metadata: {  },
            value: {
                firstName: 'simon',
                lastName: 'templar'
            }
        },
        'b2user': {
            metadata: {  },
            value: {
                firstName: 'testy',
                lastName: 'mctester'
            }
        }
    }
}

export const songs : IRecordset = {
    metadata: {},
    records: {
        a1song: {
            metadata: {  },
            value: {
                title: 'song1',
                artist: 'artist1'
            }
        },
        a2song: {
            metadata: {  },
            value: {
                title: 'song2',
                artist: 'artist2'
            }
        },
        b1song: {
            metadata: {  },
            value: {
                title: 'song3',
                artist: 'artist3'
            }
        },
        b2song: {
            metadata: {  },
            value: {
                title: 'song4',
                artist: 'artist4'
            }
        }
    }
}

export const queues : IRecordset = {
    metadata: { },
    records: {
        'a': {
            metadata: { metaOne: 1 },
            value: {
                queueName: 'a',
                otherItems: [ 'one', 'three'],
                items: ['a1','a2']
            }
        },
        'b': {
            metadata: { metaOne: 2 },
            value: {
                queueName: 'b',
                items: ['b1', 'b2']
            }
        }
    }
}

export const state = {
    data: {
        queues,
        users,
        songs,
        requests
    },
    navigator: {

    }
}