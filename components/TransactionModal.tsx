import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { financeService, Transaction, TRANSACTION_CATEGORIES } from '../services/financeService';
import { useLanguage } from '../contexts/LanguageContext';

interface TransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
    transactionId?: string | null;
}

const TransactionModal: React.FC<TransactionModalProps> = ({
    isOpen,
    onClose,
    onSaved,
    transactionId,
}) => {
    const { t, language } = useLanguage();
    const isEditing = Boolean(transactionId);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState<Partial<Transaction>>({
        type: 'income',
        description: '',
        category: '',
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        status: 'pending',
        notes: '',
    });

    const getText = (pt: string, en: string, es: string) => {
        return language === 'en-US' ? en : language === 'es-ES' ? es : pt;
    };

    useEffect(() => {
        if (isOpen) {
            if (transactionId) {
                loadTransaction(transactionId);
            } else {
                // Reset form for new transaction
                setFormData({
                    type: 'income',
                    description: '',
                    category: '',
                    date: new Date().toISOString().split('T')[0],
                    amount: 0,
                    status: 'pending',
                    notes: '',
                });
                setError(null);
            }
        }
    }, [isOpen, transactionId]);

    const loadTransaction = async (id: string) => {
        try {
            setLoading(true);
            setError(null);
            const data = await financeService.getById(id);
            setFormData({
                type: data.type,
                description: data.description,
                category: data.category,
                date: data.date,
                amount: data.amount,
                status: data.status,
                notes: data.notes || '',
            });
        } catch (err) {
            setError(getText('Erro ao carregar transação', 'Error loading transaction', 'Error al cargar transacción'));
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.description || !formData.category || !formData.amount) {
            setError(getText('Preencha todos os campos obrigatórios', 'Please fill all required fields', 'Complete todos los campos requeridos'));
            return;
        }

        try {
            setSaving(true);
            setError(null);

            const transactionData = {
                type: formData.type as 'income' | 'expense',
                description: formData.description!,
                category: formData.category!,
                date: formData.date!,
                amount: Number(formData.amount),
                status: formData.status as 'reconciled' | 'pending',
                notes: formData.notes || undefined,
            };

            if (isEditing && transactionId) {
                await financeService.update(transactionId, transactionData);
            } else {
                await financeService.create(transactionData);
            }

            onSaved();
            onClose();
        } catch (err: any) {
            const errorMessage = err?.message || getText('Erro desconhecido', 'Unknown error', 'Error desconocido');
            console.error('Error saving transaction:', err);
            setError(`${getText('Erro ao salvar transação', 'Error saving transaction', 'Error al guardar transacción')}: ${errorMessage}`);
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (field: keyof Transaction, value: string | number) => {
        setFormData(prev => ({ ...prev, [field]: value }));

        // Reset category when type changes
        if (field === 'type') {
            setFormData(prev => ({ ...prev, [field]: value, category: '' }));
        }
    };

    const categories = formData.type === 'income'
        ? TRANSACTION_CATEGORIES.income
        : TRANSACTION_CATEGORIES.expense;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800">
                        {isEditing
                            ? getText('Editar Transação', 'Edit Transaction', 'Editar Transacción')
                            : getText('Nova Transação', 'New Transaction', 'Nueva Transacción')
                        }
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        </div>
                    ) : (
                        <form id="transaction-form" onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-sm text-red-600">{error}</p>
                                </div>
                            )}

                            {/* Type Selection */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    {getText('Tipo de Transação', 'Transaction Type', 'Tipo de Transacción')} *
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => handleChange('type', 'income')}
                                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${formData.type === 'income'
                                            ? 'border-green-500 bg-green-50 text-green-700'
                                            : 'border-slate-200 hover:border-green-300'
                                            }`}
                                    >
                                        <ArrowUpCircle className="w-5 h-5" />
                                        <span className="font-semibold">
                                            {getText('Receita', 'Income', 'Ingreso')}
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleChange('type', 'expense')}
                                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${formData.type === 'expense'
                                            ? 'border-red-500 bg-red-50 text-red-700'
                                            : 'border-slate-200 hover:border-red-300'
                                            }`}
                                    >
                                        <ArrowDownCircle className="w-5 h-5" />
                                        <span className="font-semibold">
                                            {getText('Despesa', 'Expense', 'Gasto')}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                    {getText('Descrição', 'Description', 'Descripción')} *
                                </label>
                                <input
                                    type="text"
                                    value={formData.description || ''}
                                    onChange={(e) => handleChange('description', e.target.value)}
                                    placeholder={getText('Ex: Mensalidade Outubro', 'Ex: October Monthly Fee', 'Ej: Mensualidad Octubre')}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                />
                            </div>

                            {/* Category */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                    {t('athletes.category')} *
                                </label>
                                <select
                                    value={formData.category || ''}
                                    onChange={(e) => handleChange('category', e.target.value)}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none bg-white"
                                >
                                    <option value="">{getText('Selecione...', 'Select...', 'Seleccionar...')}</option>
                                    {categories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Date */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                        {getText('Data', 'Date', 'Fecha')} *
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.date || ''}
                                        onChange={(e) => handleChange('date', e.target.value)}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                    />
                                </div>

                                {/* Amount */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                        {getText('Valor', 'Amount', 'Valor')} *
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                            {language === 'en-US' ? '$' : language === 'es-ES' ? '€' : 'R$'}
                                        </span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={formData.amount || ''}
                                            onChange={(e) => handleChange('amount', parseFloat(e.target.value) || 0)}
                                            placeholder="0,00"
                                            className="w-full pl-12 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Status */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                    {t('common.status')}
                                </label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="status"
                                            value="pending"
                                            checked={formData.status === 'pending'}
                                            onChange={(e) => handleChange('status', e.target.value)}
                                            className="text-primary focus:ring-primary"
                                        />
                                        <span className="text-sm text-slate-600">
                                            {getText('Pendente', 'Pending', 'Pendiente')}
                                        </span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="status"
                                            value="reconciled"
                                            checked={formData.status === 'reconciled'}
                                            onChange={(e) => handleChange('status', e.target.value)}
                                            className="text-primary focus:ring-primary"
                                        />
                                        <span className="text-sm text-slate-600">
                                            {getText('Conciliado', 'Reconciled', 'Conciliado')}
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                    {getText('Observações', 'Notes', 'Notas')}
                                </label>
                                <textarea
                                    value={formData.notes || ''}
                                    onChange={(e) => handleChange('notes', e.target.value)}
                                    rows={2}
                                    placeholder={getText('Observações adicionais...', 'Additional notes...', 'Notas adicionales...')}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                                />
                            </div>
                        </form>
                    )}
                </div>

                {/* Footer */}
                {!loading && (
                    <div className="flex items-center justify-end gap-3 p-6 bg-slate-50 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="px-4 py-2.5 text-slate-700 font-semibold text-sm rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit"
                            form="transaction-form"
                            disabled={saving}
                            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-bold text-sm rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 shadow-lg shadow-primary/20"
                        >
                            {saving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            {t('common.save')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TransactionModal;
