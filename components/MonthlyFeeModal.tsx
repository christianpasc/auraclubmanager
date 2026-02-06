import React, { useState, useEffect } from 'react';
import { X, Loader2, ChevronDown } from 'lucide-react';
import { monthlyFeeService, MonthlyFee, FEE_STATUSES } from '../services/monthlyFeeService';
import { enrollmentService, EnrollmentWithAthlete, paymentMethods } from '../services/enrollmentService';
import { useLanguage } from '../contexts/LanguageContext';

interface MonthlyFeeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
    feeId?: string | null;
}

const MonthlyFeeModal: React.FC<MonthlyFeeModalProps> = ({ isOpen, onClose, onSaved, feeId }) => {
    const { language } = useLanguage();
    const isEditing = !!feeId;

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [enrollments, setEnrollments] = useState<EnrollmentWithAthlete[]>([]);

    const [formData, setFormData] = useState<Partial<MonthlyFee>>({
        status: 'pending',
        installment_number: 1,
    });

    const getText = (pt: string, en: string, es: string) => {
        return language === 'en-US' ? en : language === 'es-ES' ? es : pt;
    };

    useEffect(() => {
        if (isOpen) {
            loadEnrollments();
            if (feeId) {
                loadFee(feeId);
            } else {
                setFormData({
                    status: 'pending',
                    installment_number: 1,
                    due_date: new Date().toISOString().split('T')[0],
                });
            }
        }
    }, [isOpen, feeId]);

    const loadEnrollments = async () => {
        try {
            const data = await enrollmentService.getAll();
            // Show active and pending enrollments
            setEnrollments(data.filter(e => e.status === 'active' || e.status === 'pending'));
        } catch (err) {
            console.error('Error loading enrollments:', err);
        }
    };

    const loadFee = async (id: string) => {
        setLoading(true);
        try {
            const data = await monthlyFeeService.getById(id);
            setFormData(data);
        } catch (err) {
            setError(getText('Erro ao carregar mensalidade', 'Error loading fee', 'Error al cargar mensualidad'));
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleEnrollmentChange = (enrollmentId: string) => {
        const enrollment = enrollments.find(e => e.id === enrollmentId);
        if (enrollment) {
            setFormData(prev => ({
                ...prev,
                enrollment_id: enrollmentId,
                athlete_id: enrollment.athlete_id,
                amount: enrollment.monthly_fee || 0,
            }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.athlete_id || !formData.due_date || !formData.amount) {
            setError(getText(
                'Preencha todos os campos obrigatórios',
                'Fill in all required fields',
                'Complete todos los campos obligatorios'
            ));
            return;
        }

        setSaving(true);
        setError(null);

        try {
            if (isEditing && feeId) {
                await monthlyFeeService.update(feeId, formData);
            } else {
                await monthlyFeeService.create(formData as MonthlyFee);
            }
            onSaved();
            onClose();
        } catch (err) {
            setError(getText('Erro ao salvar mensalidade', 'Error saving fee', 'Error al guardar mensualidad'));
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800">
                        {isEditing
                            ? getText('Editar Mensalidade', 'Edit Monthly Fee', 'Editar Mensualidad')
                            : getText('Nova Mensalidade', 'New Monthly Fee', 'Nueva Mensualidad')
                        }
                    </h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {loading ? (
                    <div className="p-8 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-600">{error}</p>
                            </div>
                        )}

                        {/* Enrollment Select */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                {getText('Matrícula/Atleta', 'Enrollment/Athlete', 'Matrícula/Atleta')} *
                            </label>
                            {isEditing && formData.athlete ? (
                                // Show read-only athlete info when editing
                                <div className="px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-700">
                                    {formData.athlete.full_name} {formData.athlete.category ? `- ${formData.athlete.category}` : ''}
                                </div>
                            ) : (
                                <div className="relative">
                                    <select
                                        value={formData.enrollment_id || ''}
                                        onChange={(e) => handleEnrollmentChange(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none pr-10"
                                    >
                                        <option value="">{getText('Selecione...', 'Select...', 'Seleccione...')}</option>
                                        {enrollments.map(e => (
                                            <option key={e.id} value={e.id}>
                                                {e.athlete?.full_name} - {e.athlete?.category}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Amount */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    {getText('Valor', 'Amount', 'Monto')} *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.amount || ''}
                                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                    placeholder="150.00"
                                />
                            </div>

                            {/* Due Date */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    {getText('Vencimento', 'Due Date', 'Vencimiento')} *
                                </label>
                                <input
                                    type="date"
                                    value={formData.due_date || ''}
                                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Status */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    {getText('Status', 'Status', 'Estado')}
                                </label>
                                <div className="relative">
                                    <select
                                        value={formData.status || 'pending'}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value as MonthlyFee['status'] })}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none pr-10"
                                    >
                                        {FEE_STATUSES.map(s => (
                                            <option key={s.value} value={s.value}>{s.label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Payment Method */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    {getText('Forma de Pagamento', 'Payment Method', 'Método de Pago')}
                                </label>
                                <div className="relative">
                                    <select
                                        value={formData.payment_method || ''}
                                        onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none pr-10"
                                    >
                                        <option value="">{getText('Selecione...', 'Select...', 'Seleccione...')}</option>
                                        {paymentMethods.map(m => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                {getText('Descrição', 'Description', 'Descripción')}
                            </label>
                            <input
                                type="text"
                                value={formData.description || ''}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                placeholder={getText('Ex: Mensalidade Avulsa', 'Ex: Extra Fee', 'Ej: Mensualidad Extra')}
                            />
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                {getText('Observações', 'Notes', 'Observaciones')}
                            </label>
                            <textarea
                                value={formData.notes || ''}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                rows={2}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors"
                            >
                                {getText('Cancelar', 'Cancel', 'Cancelar')}
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex-1 px-4 py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                {getText('Salvar', 'Save', 'Guardar')}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default MonthlyFeeModal;
