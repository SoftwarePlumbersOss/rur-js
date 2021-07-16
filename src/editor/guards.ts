import { FieldArrayEditor, RecordsetEditor } from './base';

export class Guards {

    static isRecordsetEditor(editor : any) : editor is RecordsetEditor {
        return editor instanceof RecordsetEditor;
    }

    static isFieldArrayEditor(editor : any) : editor is FieldArrayEditor {
        return editor instanceof FieldArrayEditor;
    }

}
