import { State, Guards, Filter as View } from '../state';
import { Config } from '../config';
import { PackedCriteria, Filter, expand, apply } from '../criteria';
import { Sort, apply as applySort } from '../sort'

export class ViewEditor {

    private expandedCriteria? : Filter;
    private config? : Config;
    private state : View;
    private allRecords : { [ key: string ] : State };

    constructor(config : Config | undefined, state: View, allRecords: { [ key: string ] : State }) {
        this.state = state;
        this.config = config;
        this.allRecords = allRecords;
        this.expandedCriteria = state.criteria && expand(state.criteria);
    }

    private filterRow(record: State) : boolean {
        if (this.expandedCriteria !== undefined) {
            if (Guards.isRichField(record)) {
                return apply(record.value, this.expandedCriteria, this.config?.value);
            } else {
                return apply(record, this.expandedCriteria, this.config?.value);
            }
        } else {
            return true;
        }
    }

    private compareRows(a: State, b: State) : number {
        if (this.state.sort) {
            let fieldA =  Guards.isRichField(a) ? a.value : a;
            let fieldB = Guards.isRichField(b) ? b.value : b;
            return applySort(fieldA, fieldB, this.state.sort, this.config?.value);
        } else {
            return 0;
        }
    }

    updateRow(key: string, value: State /* record must already be merged with any existing data*/) : ViewEditor {
        if (!this.state.criteria || this.filterRow(value)) {
            let keys = this.state.keys;
            let index = keys.indexOf(key);
            if (index >= 0) {
                if (this.state.sort) {
                    /** Argh, the position of the row in the sort may have changed. So find the new position */
                    let insertIndex = keys.findIndex(key => this.compareRows(this.allRecords[key], value) > 0);
                    const delta = insertIndex < index ? 1 : -1; // This determines which way records shift in the order
                    keys = keys.map((k, i) => {
                        if (i === insertIndex) return key; // insert the record at its new positon
                        if (i < insertIndex && i < index || i > insertIndex && i > index) return k; // copy unaffected records
                        return keys[i + delta] // shift any records we need to shift
                    });
                } else {
                    // No sort, so just update the record
                    keys = keys.map((k, i) => i === index ? key : k);
                }
            } else {
                throw new RangeError('index out of range');
            }
            this.state = { ...this.state, keys };
        } else {
            // Do nothing, there is a criteria and the row does not match it
        }
        return this;
    }

    insertRow(key: string, value: State /* record must already be merged with any existing data*/) : ViewEditor {
        if (!this.state.criteria || this.filterRow(value)) {
            let keys = this.state.keys;
            if (this.state.sort) {
                let index = keys.findIndex(key => this.compareRows(this.allRecords[key], value) > 0);
                this.state = { ...this.state, keys: [ ...keys.slice(0, index), key, ...keys.slice(index) ] };
            } else {
                this.state = { ...this.state, keys: [ ...keys, key ]}
            }
        } else {
            // Do nothing, there is a criteria and the row does not match it
        }
        return this;
    }    

    setRow(key: string, value: State /* record must already be merged with any existing data*/) : ViewEditor {
        if (!this.state.criteria || this.filterRow(value)) {
            let keys = this.state.keys;
            if (keys.indexOf(key) >= 0) {
                this.updateRow(key, value);
            } else {
                this.insertRow(key, value);
            }
        } else {
            // Do nothing, there is a criteria and the row does not match it
        }
        return this;
    }       

    removeRow(key: string) : ViewEditor {
        let index = this.state.keys.indexOf(key);
        if (index >= 0)
            this.state = { ...this.state, keys: [ ...this.state.keys.slice(0, index), ...this.state.keys.slice(index + 1) ] };
        return this;
    } 

    sort(sort: Sort) : ViewEditor {
        this.state = { ...this.state, sort };
        this.state = { ...this.state,  keys: this.state.keys.sort((a,b) => this.compareRows(this.allRecords[a],this.allRecords[b])) } 
        return this;
    }

    search(criteria: PackedCriteria) : ViewEditor {
        this.expandedCriteria = expand(criteria);
        this.state = { ...this.state, criteria, keys: this.state.keys.filter(key => this.filterRow(this.allRecords[key])) };
        return this;
    }

    setData(records : { [key: string] : State}) {
        this.allRecords = records;
        let keys = Object.keys(records);
        if (this.expandedCriteria) keys = keys.filter(key => this.filterRow(records[key]));
        if (this.state.sort) keys = keys.sort((a,b)=>this.compareRows(records[a],records[b]));
        this.state = { ...this.state, keys };
    }

    getState() : View {
        return this.state;
    }
}

