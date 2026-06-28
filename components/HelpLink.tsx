import React, { useEffect, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { helpCenterService } from '../services/helpCenterService';

interface HelpLinkProps {
    featureKey?: string;
    routeKey?: string;
    className?: string;
}

// Resolves the help article for the current page and renders a small icon
// that opens it in a new tab — fails silently (renders nothing) if no
// matching article exists, so it never breaks a page that isn't documented yet.
const HelpLink: React.FC<HelpLinkProps> = ({ featureKey, routeKey, className }) => {
    const [slug, setSlug] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        setSlug(null);
        (async () => {
            try {
                let article = routeKey ? await helpCenterService.getArticleByRouteKey(routeKey) : null;
                if (!article && featureKey) article = await helpCenterService.getArticleByFeatureKey(featureKey);
                if (active) setSlug(article?.slug ?? null);
            } catch {
                if (active) setSlug(null);
            }
        })();
        return () => { active = false; };
    }, [featureKey, routeKey]);

    if (!slug) return null;

    return (
        <a
            href={`#/help/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Central de Ajuda"
            className={className ?? 'p-1.5 text-slate-400 hover:text-primary transition-colors'}
        >
            <HelpCircle className="w-4 h-4" />
        </a>
    );
};

export default HelpLink;
