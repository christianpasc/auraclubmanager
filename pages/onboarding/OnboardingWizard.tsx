import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../contexts/TenantContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { tenantService, Tenant } from '../../services/tenantService';
import { paletteService, ColorPalette } from '../../services/paletteService';
import { seasonService } from '../../services/seasonService';
import { ageCategoryService } from '../../services/ageCategoryService';
import { schoolPlanService } from '../../services/schoolPlanService';
import { athleteService } from '../../services/athleteService';
import {
    ONBOARDING_STEPS, readOnboardingState, saveOnboardingState, OnboardingStepId,
} from '../../services/onboardingService';
import {
    suggestedAgeCategories, suggestedSeasonYear, ageCategoryName,
} from '../../constants/onboardingDefaults';
import { currencyForCountry } from '../../constants/countries';
import { isMinorFromBirthDate } from '../../lib/age';
import WizardShell from '../../components/onboarding/WizardShell';
import HowAuraWorks from '../../components/onboarding/HowAuraWorks';
import StepOrganization, { OrganizationValues } from './steps/StepOrganization';
import StepPreferences, { PreferencesValues } from './steps/StepPreferences';
import StepIdentity, { IdentityValues } from './steps/StepIdentity';
import StepStructure, { StructureValues } from './steps/StepStructure';
import StepPlan, { PlanValues } from './steps/StepPlan';
import StepAthlete, { AthleteValues } from './steps/StepAthlete';

const TOTAL = ONBOARDING_STEPS.length;

const OnboardingWizard: React.FC = () => {
    const { currentTenant, createTenant, refreshTenants } = useTenant();
    const { t, language, setLanguage, setCurrency } = useLanguage();

    // The freshest tenant we know about. createTenant/update return the row directly,
    // which lands here before the context finishes reloading.
    const [tenant, setTenant] = useState<Tenant | null>(currentTenant);
    const activeTenant = tenant || currentTenant;

    const [stepIndex, setStepIndex] = useState(() => readOnboardingState(currentTenant).current_step);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [palettes, setPalettes] = useState<ColorPalette[]>([]);
    const resumedRef = React.useRef(false);

    const seasonYear = useMemo(() => suggestedSeasonYear(), []);
    const suggestions = useMemo(() => suggestedAgeCategories(seasonYear), [seasonYear]);

    const [org, setOrg] = useState<OrganizationValues>({
        organizationType: 'school',
        name: '',
        country: 'Brazil',
        commsLanguage: language,
    });
    const [prefs, setPrefs] = useState<PreferencesValues>({
        uiLanguage: language,
        currency: 'BRL',
    });
    const [identity, setIdentity] = useState<IdentityValues>({
        logoFile: null, logoPreview: null, paletteId: null,
    });
    const [structure, setStructure] = useState<StructureValues>({
        seasonName: String(seasonYear),
        seasonYear,
        selectedAges: suggestions.map(s => s.age),
    });
    const [plan, setPlan] = useState<PlanValues>({ name: '', amount: '', interval: 'monthly' });
    const [athlete, setAthlete] = useState<AthleteValues>({
        fullName: '', birthDate: '', guardianName: '', guardianPhone: '', guardianConsent: false,
    });

    useEffect(() => {
        paletteService.getActive().then(setPalettes).catch(err => console.error('Error loading palettes:', err));
    }, []);

    // Resuming: prefill from whatever the tenant already has.
    useEffect(() => {
        if (!currentTenant) return;
        setTenant(prev => prev || currentTenant);
        const settings = (currentTenant.settings as any) || {};
        setOrg(prev => ({
            ...prev,
            organizationType: currentTenant.organization_type || prev.organizationType,
            name: currentTenant.name || prev.name,
            country: settings.country || prev.country,
            commsLanguage: settings.language || prev.commsLanguage,
        }));
        setPrefs(prev => ({
            ...prev,
            currency: settings.currency || currentTenant.stripe_connect_currency || prev.currency,
        }));
        setIdentity(prev => ({
            ...prev,
            logoPreview: prev.logoPreview || currentTenant.logo_url || null,
            paletteId: prev.paletteId || currentTenant.palette_id || null,
        }));
        // Resume where the user left off, but only the first time this tenant
        // resolves -- never yank them backwards mid-wizard.
        if (!resumedRef.current) {
            resumedRef.current = true;
            setStepIndex(readOnboardingState(currentTenant).current_step);
        }
    }, [currentTenant?.id]);

    const persistStep = async (nextIndex: number, skipped?: OnboardingStepId, freshTenant?: Tenant) => {
        // freshTenant matters on step 1: the tenant was created moments ago, so the
        // `tenant` state captured by this closure is still null.
        const target = freshTenant || tenant || currentTenant;
        if (!target?.id) return;
        const state = readOnboardingState(target);
        const updated = await saveOnboardingState(target, {
            current_step: nextIndex,
            skipped_steps: skipped && !state.skipped_steps.includes(skipped)
                ? [...state.skipped_steps, skipped]
                : state.skipped_steps,
        });
        setTenant(updated);
    };

    const advance = async (skipped?: OnboardingStepId, freshTenant?: Tenant) => {
        const next = Math.min(stepIndex + 1, TOTAL - 1);
        await persistStep(next, skipped, freshTenant);
        setStepIndex(next);
    };

    const run = async (fn: () => Promise<void>) => {
        setLoading(true);
        setError(null);
        try {
            await fn();
        } catch (err: any) {
            console.error('Onboarding step failed:', err);
            setError(err?.message || t('onboarding.genericError'));
        } finally {
            setLoading(false);
        }
    };

    // ---- Step commits -----------------------------------------------------

    const commitOrganization = () => run(async () => {
        // Creating the organization makes currentTenant resolve for the first time,
        // which would otherwise trip the resume effect above and snap the user back
        // to this step using a copy of the row read before the step was persisted.
        resumedRef.current = true;

        const settingsPatch = {
            country: org.country,
            language: org.commsLanguage,
        };

        let updated: Tenant;
        if (activeTenant?.id) {
            updated = await tenantService.update(activeTenant.id, {
                name: org.name.trim(),
                organization_type: org.organizationType,
                settings: { ...(activeTenant.settings as any), ...settingsPatch },
            });
        } else {
            const created = await createTenant(org.name.trim(), org.organizationType);
            updated = await tenantService.update(created.id!, {
                settings: { ...(created.settings as any), ...settingsPatch },
            });
        }
        setTenant(updated);

        // Pre-fill the next step's currency from the country, unless a currency
        // was already chosen (on this tenant or earlier in this session).
        const stored = (updated.settings as any)?.currency;
        setPrefs(prev => ({ ...prev, currency: stored || currencyForCountry(org.country) }));

        await advance(undefined, updated);
    });

    const commitPreferences = () => run(async () => {
        if (!activeTenant?.id) throw new Error('No tenant');

        // The interface language belongs to the person (profiles.language); the
        // currency belongs to the club, so the whole team sees the same figures.
        if (prefs.uiLanguage !== language) await setLanguage(prefs.uiLanguage);
        setCurrency(prefs.currency);

        const updated = await tenantService.update(activeTenant.id, {
            // Connect payouts use the same currency the club works in.
            stripe_connect_currency: prefs.currency,
            settings: { ...(activeTenant.settings as any), currency: prefs.currency },
        });
        setTenant(updated);
        await advance(undefined, updated);
    });

    const commitIdentity = () => run(async () => {
        if (!activeTenant?.id) throw new Error('No tenant');
        let logoUrl = activeTenant.logo_url;

        if (identity.logoFile) {
            // Same bucket and path convention as Settings > Club.
            const ext = identity.logoFile.name.split('.').pop();
            const filePath = `logos/${activeTenant.id}-logo-${Date.now()}.${ext}`;
            const { error: uploadError } = await supabase.storage
                .from('tenants')
                .upload(filePath, identity.logoFile, { upsert: true });
            if (uploadError) throw uploadError;
            logoUrl = supabase.storage.from('tenants').getPublicUrl(filePath).data.publicUrl;
        }

        const selectedPalette = palettes.find(p => p.id === identity.paletteId);
        const updated = await tenantService.update(activeTenant.id, {
            logo_url: logoUrl || undefined,
            palette_id: identity.paletteId,
            primary_color: selectedPalette?.colors.primary || activeTenant.primary_color,
        });
        setTenant(updated);
        await advance();
    });

    const commitStructure = () => run(async () => {
        const prefix = t('onboarding.structure.categoryPrefix');

        // Re-entering the step (Back then Continue, or a refresh) must not duplicate rows.
        const [existingSeasons, existingCategories] = await Promise.all([
            seasonService.list(),
            ageCategoryService.list(),
        ]);

        if (structure.seasonName.trim() && existingSeasons.length === 0) {
            await seasonService.create({
                name: structure.seasonName.trim(),
                year: structure.seasonYear,
                start_date: null,
                end_date: null,
                is_current: true,
            });
        }

        const takenNames = new Set(existingCategories.map(c => c.name));
        const toCreate = suggestions
            .filter(s => structure.selectedAges.includes(s.age))
            .filter(s => !takenNames.has(ageCategoryName(prefix, s.age)));

        for (const s of toCreate) {
            await ageCategoryService.create({
                name: ageCategoryName(prefix, s.age),
                min_birth_year: s.minBirthYear,
                max_birth_year: s.maxBirthYear,
                sort_order: s.sortOrder,
            });
        }

        await advance();
    });

    const commitPlan = () => run(async () => {
        const amount = parseFloat(plan.amount.replace(',', '.'));
        if (!plan.name.trim() || !isFinite(amount) || amount <= 0) {
            throw new Error(t('onboarding.plan.invalid'));
        }
        const existing = await schoolPlanService.getAll();
        if (existing.length === 0) {
            await schoolPlanService.create({
                name: plan.name.trim(),
                interval: plan.interval,
                amount,
                currency: prefs.currency.toLowerCase(),
                is_active: true,
            });
        }
        await advance();
    });

    const commitAthlete = () => run(async () => {
        if (!athlete.fullName.trim()) throw new Error(t('onboarding.athlete.nameRequired'));
        if (isMinorFromBirthDate(athlete.birthDate) && !athlete.guardianConsent) {
            throw new Error(t('onboarding.athlete.consentRequired'));
        }

        await athleteService.create({
            full_name: athlete.fullName.trim(),
            birth_date: athlete.birthDate || undefined,
            guardian_name: athlete.guardianName.trim() || undefined,
            guardian_phone: athlete.guardianPhone.trim() || undefined,
            guardian_consent_given: athlete.guardianConsent,
            status: 'active',
        } as any);

        await advance();
    });

    const finish = () => run(async () => {
        const target = tenant || currentTenant;
        if (target?.id) {
            await saveOnboardingState(target, {
                current_step: TOTAL - 1,
                completed_at: new Date().toISOString(),
            });
        }
        // Re-reads the tenant so OnboardingGate sees completed_at and hands over to the app.
        await refreshTenants();
    });

    const back = async () => {
        const previous = Math.max(stepIndex - 1, 0);
        setStepIndex(previous);
        await persistStep(previous);
    };

    // ---- Render -----------------------------------------------------------

    const stepId = ONBOARDING_STEPS[stepIndex];
    const shellProps = {
        stepIndex,
        totalSteps: TOTAL,
        loading,
        error,
        onBack: stepIndex > 0 ? back : undefined,
        title: t(`onboarding.${stepId}.title`),
        subtitle: t(`onboarding.${stepId}.subtitle`),
    };

    switch (stepId) {
        case 'organization':
            return (
                <WizardShell
                    {...shellProps}
                    onNext={commitOrganization}
                    nextDisabled={!org.name.trim()}
                >
                    <StepOrganization values={org} onChange={p => setOrg(v => ({ ...v, ...p }))} />
                </WizardShell>
            );

        case 'preferences':
            return (
                <WizardShell {...shellProps} onNext={commitPreferences}>
                    <StepPreferences values={prefs} onChange={p => setPrefs(v => ({ ...v, ...p }))} />
                </WizardShell>
            );

        case 'identity':
            return (
                <WizardShell {...shellProps} onNext={commitIdentity} onSkip={() => run(() => advance('identity'))}>
                    <StepIdentity
                        values={identity}
                        onChange={p => setIdentity(v => ({ ...v, ...p }))}
                        palettes={palettes}
                    />
                </WizardShell>
            );

        case 'structure':
            return (
                <WizardShell {...shellProps} onNext={commitStructure} onSkip={() => run(() => advance('structure'))}>
                    <StepStructure
                        values={structure}
                        onChange={p => setStructure(v => ({ ...v, ...p }))}
                        suggestions={suggestions}
                    />
                </WizardShell>
            );

        case 'plan':
            return (
                <WizardShell {...shellProps} onNext={commitPlan} onSkip={() => run(() => advance('plan'))}>
                    <StepPlan values={plan} onChange={p => setPlan(v => ({ ...v, ...p }))} currency={prefs.currency} />
                </WizardShell>
            );

        case 'athlete':
            return (
                <WizardShell {...shellProps} onNext={commitAthlete} onSkip={() => run(() => advance('athlete'))}>
                    <StepAthlete values={athlete} onChange={p => setAthlete(v => ({ ...v, ...p }))} />
                </WizardShell>
            );

        case 'how-it-works':
        default:
            return (
                <WizardShell {...shellProps} onNext={finish} nextLabel={t('onboarding.finish')}>
                    <HowAuraWorks />
                </WizardShell>
            );
    }
};

export default OnboardingWizard;
