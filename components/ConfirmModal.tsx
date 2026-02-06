
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    loading?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    isDestructive = false,
    loading = false,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        {isDestructive && (
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                            </div>
                        )}
                        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <p className="text-slate-600">{message}</p>

                    {isDestructive && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg">
                            <p className="text-sm text-red-700 font-medium">
                                ⚠️ Esta ação é irreversível e não pode ser desfeita.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 bg-slate-50 border-t border-slate-100">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2.5 text-slate-700 font-semibold text-sm rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className={`px-4 py-2.5 font-bold text-sm rounded-lg transition-colors disabled:opacity-50 ${isDestructive
                                ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20'
                                : 'bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/20'
                            }`}
                    >
                        {loading ? 'Processando...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
