
import React, { useState } from 'react';
import { Icon } from '../../src/components/shared/Icon';

interface ConfidenceWordProps {
  word: any;
  scale: number;
  wordIndex: number;
  onCorrect: (idx: number, txt: string) => void;
}

export const ConfidenceWord: React.FC<ConfidenceWordProps> = ({ word, scale, wordIndex, onCorrect }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempText, setTempText] = useState(word.text);

    const getColors = (conf: number) => {
        if (conf >= 85) return { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.4)' };
        if (conf >= 60) return { bg: 'rgba(234, 179, 8, 0.25)', border: 'rgba(234, 179, 8, 0.5)' };
        return { bg: 'rgba(239, 68, 68, 0.25)', border: 'rgba(239, 68, 68, 0.5)' };
    };

    const colors = getColors(word.confidence);
    const { x0, y0, x1, y1 } = word.bbox;

    return (
        <>
            <div 
                style={{
                    position: 'absolute',
                    left: x0 * scale,
                    top: y0 * scale,
                    width: (x1 - x0) * scale,
                    height: (y1 - y0) * scale,
                    backgroundColor: colors.bg,
                    border: `1px solid ${colors.border}`,
                    cursor: 'pointer',
                    zIndex: isEditing ? 200 : 25
                }} 
                className="hover:bg-opacity-40 transition-colors"
                onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            />
            {isEditing && (
                <div 
                    className="absolute z-[300] bg-surface p-2 rounded-xl border border-brand animate-in zoom-in-95 shadow-2xl"
                    style={{ left: x0 * scale, top: (y1 * scale) + 5 }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className="flex gap-2 items-center">
                        <input 
                            autoFocus
                            className="bg-bg border border-border rounded px-2 py-1 text-xs text-white focus:border-brand outline-none min-w-[120px]"
                            value={tempText}
                            onChange={e => setTempText(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') { onCorrect(wordIndex, tempText); setIsEditing(false); }
                                if (e.key === 'Escape') setIsEditing(false);
                            }}
                        />
                        <button onClick={() => { onCorrect(wordIndex, tempText); setIsEditing(false); }} className="p-1 bg-brand text-bg rounded hover:brightness-110"><Check size={14}/></button>
                        <button onClick={() => setIsEditing(false)} className="p-1 text-text-sec hover:text-white"><X size={14}/></button>
                    </div>
                </div>
            )}
        </>
    );
};
