import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
  footer?: React.ReactNode;
}

export const BaseModal: React.FC<BaseModalProps> = ({
  isOpen, onClose, title, icon, children, maxWidth = 'max-w-md', footer
}) => {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200 print:hidden"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} flex flex-col animate-in zoom-in-95 duration-200`}
        style={{
          background: 'linear-gradient(160deg, #0e0e0e 0%, #0a0a0a 100%)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderTop: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '16px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.03)',
          maxHeight: '90vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-3">
            {icon && (
              <span style={{ color: 'var(--brand)' }}>{icon}</span>
            )}
            {title && (
              <h3
                className="font-bold text-base tracking-wide"
                style={{ color: 'rgba(255,255,255,0.9)' }}
              >
                {title}
              </h3>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'rgba(255,255,255,0.3)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className="px-6 py-4 flex justify-end gap-3 shrink-0"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
