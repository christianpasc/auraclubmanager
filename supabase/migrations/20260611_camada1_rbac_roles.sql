-- Migration: Camada 1 / Fase 0 — RBAC novos papéis
-- Adiciona os 5 papéis corretos para Camada 1:
-- owner, coordinator, coach, guardian, athlete

-- Garante que a coluna 'role' em tenant_users suporte os novos valores.
-- Não há CHECK constraint a remover — a coluna é TEXT livre.
-- Esta migration serve como documentação e aplica os defaults corretamente.

-- Atualiza linhas com role='manager' para 'coordinator' (equivalente mais próximo)
UPDATE public.tenant_users
SET role = 'coordinator'
WHERE role = 'manager';

-- Garante que os papéis legados 'admin' e 'member' continuem funcionando:
-- 'admin' → continua como está (equivale a coordinator com billing)
-- 'member' → continua como está (view-only)

-- Adiciona coluna 'permissions' se não existir (para RLS granular por papel)
-- (já existe em tenant_users — apenas documentando a estrutura esperada)

-- Comentário dos papéis Camada 1:
-- owner       : dono do tenant, acesso total
-- coordinator : gerencia operações do dia-a-dia, sem billing
-- coach       : treinos, atletas, jogos — sem financeiro
-- guardian    : responsável — vê apenas seus atletas e calendário
-- athlete     : atleta — vê apenas o próprio perfil e calendário
