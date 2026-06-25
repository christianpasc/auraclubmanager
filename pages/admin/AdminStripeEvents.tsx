import React from 'react';
import { Bell } from 'lucide-react';
import AdminComingSoon from '../../components/admin/AdminComingSoon';

const AdminStripeEvents: React.FC = () => (
    <AdminComingSoon
        icon={Bell}
        title="Notificações Stripe"
        description="Feed de eventos do Stripe (pagamentos, falhas, assinaturas) processados pela plataforma."
        phase="Chega na Fase 6 — depende de aplicar a migration da Fase 0 e reimplantar as edge functions."
    />
);

export default AdminStripeEvents;
