import { Config } from './config';
import { Key, KeyPart } from './types';

export enum ErrorCode {
    REFERENCE_BOUNDARY = "rur/REFERENCE_BOUNDARY",
    STATE_VALIDATION = "rur/STATE_VALIDATION",
    STATE_MANDATORY = "rur/STATE_MANDATORY",
    KEY_REQUIRED = "rur/KEY_REQUIRED",
    KEY_NOT_FOUND = "rur/KEY_NOT_FOUND",
}


// Exceptions may be included in redux state so are plain JS objects
export interface Exception {
    code : ErrorCode;
    message: string;
}

class RURError extends Error implements Exception {

    code : ErrorCode;

    constructor(code: ErrorCode, message: string) {
        super(message);
        this.code = code;
    }
}

/** Exception used to flag a reference boundary condition
 * 
 * A recordset may hold a reference to date held in another recordset. For example, a user reference may
 * have a 'groupId' field which is actually a reference to group information held in another recordset.
 * 
 * An accessor may be used to access data across these data sets. For example:
 * 
 * * `users.get(state, 'jonathan', groupId, groupName)` will access the 'groupName' associated with the 
 *   group of which the user 'jonathan' is a member
 * * `groups.get(state, 'admin', users).keys()` will get the keys of all the users which are members of
 *   the admin group.
 * 
 * Low level search operations throw a 'ReferenceBoundary' exception when a retrieval operation crosses
 * from one recordset into another.
 * 
 */
export class ReferenceBoundary extends RURError {
    config : Config
    key: Key
    fromRecord?: KeyPart

    /** Create a new ReferenceBoundary error
     * 
     * @param config Configuration related to the field where we encountered the reference boundary
     * @param fromRecord The key of the record in which we encountered the reference boundary
     * @param key The key we were attempting to access (rooted from the reference boundary)
     */
    constructor(config : Config, fromRecord?: KeyPart, ...key : Key) {
        super(ErrorCode.REFERENCE_BOUNDARY, `reference boundary for accessor ${config?.recordset}, ${key.join('.')}`)
        this.config = config;
        this.key = key;
        this.fromRecord = fromRecord;
    }  
}
