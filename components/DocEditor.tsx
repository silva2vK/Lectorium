
import React from 'react';
import { DocEditorProvider } from '../context/DocEditorContext';
import { DocEditorLayout } from './doc/DocEditorLayout';

interface Props {
  fileId: string;
  fileName: string;
  fileBlob?: Blob;
  accessToken: string;
  onToggleMenu: () => void;
  onAuthError?: () => void;
  onBack?: () => void;
  fileParents?: string[];
}

export const DocEditor: React.FC<Props> = (props) => {
  return (
    <DocEditorProvider {...props}>
       <DocEditorLayout />
    </DocEditorProvider>
  );
};
