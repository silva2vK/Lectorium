
import React, { useEffect, useState } from 'react';
import { Icon } from '../src/components/shared/Icon';
import { DriveFile } from '../types';
import { unpackLectoriumFile, LectoriumPackage } from '../services/lectService';
import { downloadDriveFile } from '../services/driveService';
import { DocEditor } from './DocEditor';
import { PdfViewer } from './PdfViewer';

interface Props {
  file: DriveFile;
  accessToken: string;
  uid: string;
  onBack: () => void;
  onToggleMenu: () => void;
  onAuthError: () => void;
  onToggleNavigation?: () => void; // Adicionado para passar ao PdfViewer
}

export const LectAdapter: React.FC<Props> = ({ file, accessToken, uid, onBack, onToggleMenu, onAuthError, onToggleNavigation }) => {
  const [pkg, setPkg] = useState<LectoriumPackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        let blob = file.blob;
        if (!blob && accessToken && !file.id.startsWith('local-')) {
           blob = await downloadDriveFile(accessToken, file.id);
        }
        
        if (!blob) throw new Error("Arquivo não disponível ou vazio.");

        const unpacked = await unpackLectoriumFile(blob);
        if (active) setPkg(unpacked);
      } catch (e: any) {
        console.error("Lect load error", e);
        if (active) setError(e.message || "Erro ao abrir arquivo Lectorium.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [file, accessToken]);

  if (loading) {
      return (
          <div className="flex flex-col h-full items-center justify-center bg-bg">
              <Loader2 className="animate-spin text-brand mb-4" size={40} />
              <p className="text-text-sec">Abrindo container Lectorium...</p>
          </div>
      );
  }

  if (error || !pkg) {
      return (
          <div className="flex flex-col h-full items-center justify-center bg-bg text-text p-6 text-center">
              <AlertTriangle className="text-red-500 mb-4" size={40} />
              <h3 className="text-xl font-bold mb-2">Erro ao abrir arquivo</h3>
              <p className="text-text-sec mb-6">{error}</p>
              <button onClick={onBack} className="bg-surface border border-border px-4 py-2 rounded-lg hover:bg-white/5 transition-colors">Voltar</button>
          </div>
      );
  }

  // 1. Documento de Texto (Editor)
  if (pkg.manifest.type === 'document') {
      const jsonBlob = new Blob([JSON.stringify(pkg.data)], { type: 'application/json' });
      return (
        <DocEditor 
            fileId={file.id}
            fileName={file.name}
            fileBlob={jsonBlob}
            accessToken={accessToken}
            onToggleMenu={onToggleMenu}
            onAuthError={onAuthError}
            onBack={onBack}
        />
      );
  }

  // 2. PDF Wrapper (Leitor com Anotações Externas)
  if (pkg.manifest.type === 'pdf_wrapper') {
      const sourceBlob = pkg.sourceBlob;
      if (!sourceBlob) {
          setError("O PDF original não foi encontrado dentro do pacote.");
          return null;
      }

      // Dados extraídos do JSON
      const { annotations, pageOffset, semanticData } = pkg.data || {};

      return (
          <PdfViewer
            fileId={file.id}
            fileName={file.name.replace('.lect', '.pdf')} // Mostra nome amigável
            fileBlob={sourceBlob} // O PDF real
            accessToken={accessToken}
            uid={uid}
            onBack={onBack}
            onAuthError={onAuthError}
            onToggleNavigation={onToggleNavigation}
            // Injeta dados recuperados do pacote
            initialAnnotations={annotations}
            initialPageOffset={pageOffset}
            initialSemanticData={semanticData}
          />
      );
  }

  return (
      <div className="flex flex-col h-full items-center justify-center bg-bg text-text">
          <p>Tipo de arquivo desconhecido no pacote: <strong>{pkg.manifest.type}</strong></p>
          <button onClick={onBack} className="mt-4 bg-surface border border-border px-4 py-2 rounded-lg hover:bg-white/5 transition-colors">Voltar</button>
      </div>
  );
};
