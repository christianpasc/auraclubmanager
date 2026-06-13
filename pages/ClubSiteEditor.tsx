import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clubSiteService, ClubSite, Post, Page } from '../services/clubSiteService';
import { useTenant } from '../contexts/TenantContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Globe, Eye, Settings2, Image, Phone, Mail, Instagram, Facebook, Youtube, Twitter,
  Save, Loader2, Check, Plus, Trash2, Edit2, X, ExternalLink, Newspaper, Layout,
  ToggleLeft, ToggleRight, Trophy, Calendar,
} from 'lucide-react';

type EditorTab = 'general' | 'pages' | 'posts' | 'appearance';

const ClubSiteEditor: React.FC = () => {
  const { t } = useLanguage();
  const { currentTenant } = useTenant();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<EditorTab>('general');
  const [site, setSite] = useState<ClubSite | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // General fields
  const [aboutText, setAboutText] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [youtube, setYoutube] = useState('');
  const [twitter, setTwitter] = useState('');
  const [showCompetitions, setShowCompetitions] = useState(true);
  const [showGames, setShowGames] = useState(true);
  const [showStandings, setShowStandings] = useState(true);
  const [isPublished, setIsPublished] = useState(false);

  // Appearance
  const [theme, setTheme] = useState<'modern' | 'classic' | 'bold'>('modern');
  const [primaryColor, setPrimaryColor] = useState('#1a56db');
  const [secondaryColor, setSecondaryColor] = useState('#1e3a8a');

  // Posts
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [editingPost, setEditingPost] = useState<Partial<Post> | null>(null);

  // Pages
  const [pages, setPages] = useState<Page[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [editingPage, setEditingPage] = useState<Partial<Page> | null>(null);

  useEffect(() => {
    loadSite();
  }, []);

  const loadSite = async () => {
    try {
      const s = await clubSiteService.getOrCreate();
      setSite(s);
      setAboutText(s.about_text || '');
      setContactEmail(s.contact_email || '');
      setContactPhone(s.contact_phone || '');
      setHeroImageUrl(s.hero_image_url || '');
      setInstagram(s.social_links.instagram || '');
      setFacebook(s.social_links.facebook || '');
      setYoutube(s.social_links.youtube || '');
      setTwitter(s.social_links.twitter || '');
      setShowCompetitions(s.show_competitions);
      setShowGames(s.show_games);
      setShowStandings(s.show_standings);
      setIsPublished(s.is_published);
      setTheme(s.theme);
      setPrimaryColor(s.primary_color);
      setSecondaryColor(s.secondary_color);
    } catch (e) {
      setError(t('errors.loadSite'));
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async () => {
    if (!site) return;
    setPostsLoading(true);
    try {
      const p = await clubSiteService.getPosts(site.id);
      setPosts(p);
    } finally {
      setPostsLoading(false);
    }
  };

  const loadPages = async () => {
    if (!site) return;
    setPagesLoading(true);
    try {
      const p = await clubSiteService.getPages(site.id);
      setPages(p);
    } finally {
      setPagesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'posts') loadPosts();
    if (activeTab === 'pages') loadPages();
  }, [activeTab, site]);

  const handleSaveGeneral = async () => {
    if (!site) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await clubSiteService.update(site.id, {
        about_text: aboutText || null,
        contact_email: contactEmail || null,
        contact_phone: contactPhone || null,
        hero_image_url: heroImageUrl || null,
        social_links: { instagram, facebook, youtube, twitter },
        show_competitions: showCompetitions,
        show_games: showGames,
        show_standings: showStandings,
        is_published: isPublished,
      });
      setSite(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError(t('errors.save'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAppearance = async () => {
    if (!site) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await clubSiteService.update(site.id, { theme, primary_color: primaryColor, secondary_color: secondaryColor });
      setSite(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError(t('errors.save'));
    } finally {
      setSaving(false);
    }
  };

  const handleSavePost = async () => {
    if (!site || !editingPost) return;
    setSaving(true);
    try {
      await clubSiteService.upsertPost({ ...editingPost, club_site_id: site.id } as any);
      setEditingPost(null);
      loadPosts();
    } catch {
      setError(t('errors.save'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePost = async (id: string) => {
    await clubSiteService.deletePost(id);
    loadPosts();
  };

  const handleSavePage = async () => {
    if (!site || !editingPage) return;
    setSaving(true);
    try {
      if (editingPage.id) {
        await clubSiteService.updatePage(editingPage.id, editingPage);
      } else {
        await clubSiteService.createPage(site.id, editingPage);
      }
      setEditingPage(null);
      loadPages();
    } catch {
      setError(t('errors.save'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePage = async (id: string) => {
    await clubSiteService.deletePage(id);
    loadPages();
  };

  const slug = currentTenant?.slug;
  const publicUrl = slug ? `#/site/${slug}` : null;

  const tabs: { id: EditorTab; icon: React.FC<any>; label: string }[] = [
    { id: 'general', icon: Settings2, label: t('clubSite.tab.general') },
    { id: 'appearance', icon: Image, label: t('clubSite.tab.appearance') },
    { id: 'pages', icon: Layout, label: t('clubSite.tab.pages') },
    { id: 'posts', icon: Newspaper, label: t('clubSite.tab.posts') },
  ];

  const SaveBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <button
      onClick={onClick}
      disabled={saving}
      className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark transition-colors disabled:opacity-50"
    >
      {saved ? <Check className="w-4 h-4" /> : saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
      {saving ? t('common.saving') : saved ? t('common.saved') : t('common.save')}
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">{t('clubSite.title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('clubSite.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Published toggle */}
          <button
            onClick={async () => {
              if (!site) return;
              const next = !isPublished;
              setIsPublished(next);
              const updated = await clubSiteService.update(site.id, { is_published: next });
              setSite(updated);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              isPublished ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {isPublished ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            {isPublished ? t('clubSite.published') : t('clubSite.draft')}
          </button>
          {publicUrl && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors"
            >
              <Eye className="w-4 h-4" /> {t('clubSite.view')}
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all relative whitespace-nowrap ${
              activeTab === tab.id ? 'text-primary' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-t-full" />}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">

        {/* ── General Tab ── */}
        {activeTab === 'general' && (
          <div className="space-y-8">
            <div>
              <h3 className="text-base font-bold text-slate-800 mb-4">{t('clubSite.info.title')}</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t('clubSite.field.about')}</label>
                  <textarea
                    value={aboutText}
                    onChange={e => setAboutText(e.target.value)}
                    rows={4}
                    placeholder="Descreva brevemente o seu clube ou escola..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t('clubSite.field.heroImage')}</label>
                  <input
                    type="url"
                    value={heroImageUrl}
                    onChange={e => setHeroImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-6">
              <h3 className="text-base font-bold text-slate-800 mb-4">{t('clubSite.section.contact')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1 block">
                    <Mail className="w-3.5 h-3.5" /> Email
                  </label>
                  <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1 block">
                    <Phone className="w-3.5 h-3.5" /> Telefone
                  </label>
                  <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none" />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-6">
              <h3 className="text-base font-bold text-slate-800 mb-4">{t('clubSite.section.social')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { icon: Instagram, label: 'Instagram', value: instagram, set: setInstagram },
                  { icon: Facebook, label: 'Facebook', value: facebook, set: setFacebook },
                  { icon: Youtube, label: 'YouTube', value: youtube, set: setYoutube },
                  { icon: Twitter, label: 'Twitter/X', value: twitter, set: setTwitter },
                ].map(s => (
                  <div key={s.label}>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1 block">
                      <s.icon className="w-3.5 h-3.5" /> {s.label}
                    </label>
                    <input type="url" value={s.value} onChange={e => s.set(e.target.value)} placeholder="https://..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none" />
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-6">
              <h3 className="text-base font-bold text-slate-800 mb-4">{t('clubSite.section.publicSections')}</h3>
              <div className="space-y-3">
                {[
                  { label: t('clubSite.show.competitions'), icon: Trophy, value: showCompetitions, set: setShowCompetitions },
                  { label: t('clubSite.show.games'), icon: Calendar, value: showGames, set: setShowGames },
                  { label: t('clubSite.show.standings'), icon: Trophy, value: showStandings, set: setShowStandings },
                ].map(item => (
                  <label key={item.label} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer">
                    <div className="flex items-center gap-2">
                      <item.icon className="w-4 h-4 text-slate-500" />
                      <span className="text-sm font-medium text-slate-700">{item.label}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => item.set(!item.value)}
                      className={`w-11 h-6 rounded-full relative transition-colors ${item.value ? 'bg-primary' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${item.value ? 'right-1' : 'left-1'}`} />
                    </button>
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end">
              <SaveBtn onClick={handleSaveGeneral} />
            </div>
          </div>
        )}

        {/* ── Appearance Tab ── */}
        {activeTab === 'appearance' && (
          <div className="space-y-8">
            <div>
              <h3 className="text-base font-bold text-slate-800 mb-4">{t('clubSite.appearance.theme')}</h3>
              <div className="grid grid-cols-3 gap-4">
                {(['modern', 'classic', 'bold'] as const).map(th => (
                  <button
                    key={th}
                    onClick={() => setTheme(th)}
                    className={`p-4 rounded-xl border-2 text-sm font-bold capitalize transition-colors ${
                      theme === th ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {th === 'modern' ? t('clubSite.theme.modern') : th === 'classic' ? t('clubSite.theme.classic') : t('clubSite.theme.bold')}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-6">
              <h3 className="text-base font-bold text-slate-800 mb-4">{t('clubSite.appearance.colors')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">{t('clubSite.color.primary')}</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                      className="w-12 h-10 rounded-lg border border-slate-200 cursor-pointer" />
                    <input type="text" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                      className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary/20 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">{t('clubSite.color.secondary')}</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)}
                      className="w-12 h-10 rounded-lg border border-slate-200 cursor-pointer" />
                    <input type="text" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)}
                      className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary/20 outline-none" />
                  </div>
                </div>
              </div>
              {/* Preview */}
              <div className="mt-6 p-4 rounded-xl text-white text-center text-sm font-bold"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
                {t('clubSite.colorPreview')}
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end">
              <SaveBtn onClick={handleSaveAppearance} />
            </div>
          </div>
        )}

        {/* ── Pages Tab ── */}
        {activeTab === 'pages' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">{t('clubSite.pages.title')}</h3>
              <button
                onClick={() => setEditingPage({ title: '', slug: '', is_homepage: false, is_published: true, sort_order: pages.length })}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark transition-colors"
              >
                <Plus className="w-4 h-4" /> {t('clubSite.newPage')}
              </button>
            </div>

            {editingPage && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-700">{editingPage.id ? t('clubSite.editPage') : t('clubSite.newPage')}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t('common.title')}</label>
                    <input value={editingPage.title || ''} onChange={e => setEditingPage(p => ({ ...p!, title: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none bg-white" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t('clubSite.slug')}</label>
                    <input value={editingPage.slug || ''} onChange={e => setEditingPage(p => ({ ...p!, slug: e.target.value.toLowerCase().replace(/\s/g, '-') }))}
                      placeholder="ex: sobre" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary/20 outline-none bg-white" />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!editingPage.is_homepage} onChange={e => setEditingPage(p => ({ ...p!, is_homepage: e.target.checked }))} className="rounded" />
                  <span className="text-sm text-slate-700">{t('clubSite.homePage')}</span>
                </label>
                <div className="flex gap-2 pt-2">
                  <button onClick={handleSavePage} disabled={saving || !editingPage.title || !editingPage.slug}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold disabled:opacity-50">
                    <Save className="w-3.5 h-3.5" /> {t('common.save')}
                  </button>
                  <button onClick={() => setEditingPage(null)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold">
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}

            {pagesLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : pages.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Layout className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                <p className="text-sm">{t('clubSite.pages.empty')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pages.map(page => (
                  <div key={page.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <div>
                      <p className="font-semibold text-slate-800">{page.title}</p>
                      <p className="text-xs text-slate-400 font-mono">/{page.slug}{page.is_homepage ? ' · home' : ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${page.is_published ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {page.is_published ? t('clubSite.published') : t('clubSite.draft')}
                      </span>
                      <button onClick={() => setEditingPage(page)} className="p-1.5 text-slate-400 hover:text-primary rounded-lg hover:bg-white transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeletePage(page.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-white transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Posts Tab ── */}
        {activeTab === 'posts' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">{t('clubSite.tab.posts')}</h3>
              <button
                onClick={() => setEditingPost({ title: '', slug: '', content: '', excerpt: '', is_published: false })}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark transition-colors"
              >
                <Plus className="w-4 h-4" /> {t('clubSite.newPost')}
              </button>
            </div>

            {editingPost !== null && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-700">{editingPost.id ? t('clubSite.editPost') : t('clubSite.newPost')}</h4>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t('common.title')} *</label>
                  <input value={editingPost.title || ''} onChange={e => {
                    const title = e.target.value;
                    const slug = title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                    setEditingPost(p => ({ ...p!, title, slug }));
                  }} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none bg-white" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t('clubSite.excerpt')}</label>
                  <input value={editingPost.excerpt || ''} onChange={e => setEditingPost(p => ({ ...p!, excerpt: e.target.value }))}
                    placeholder="Breve resumo da notícia..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none bg-white" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t('common.content')}</label>
                  <textarea value={editingPost.content || ''} onChange={e => setEditingPost(p => ({ ...p!, content: e.target.value }))}
                    rows={5} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none bg-white resize-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t('clubSite.coverImage')}</label>
                  <input type="url" value={editingPost.cover_image_url || ''} onChange={e => setEditingPost(p => ({ ...p!, cover_image_url: e.target.value }))}
                    placeholder="https://..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary/20 outline-none bg-white" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!editingPost.is_published}
                    onChange={e => setEditingPost(p => ({ ...p!, is_published: e.target.checked, published_at: e.target.checked ? new Date().toISOString() : null }))}
                    className="rounded" />
                  <span className="text-sm text-slate-700">{t('clubSite.publishNow')}</span>
                </label>
                <div className="flex gap-2 pt-2">
                  <button onClick={handleSavePost} disabled={saving || !editingPost.title}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold disabled:opacity-50">
                    <Save className="w-3.5 h-3.5" /> {t('common.save')}
                  </button>
                  <button onClick={() => setEditingPost(null)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold">
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}

            {postsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : posts.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Newspaper className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                <p className="text-sm">{t('clubSite.posts.empty')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {posts.map(post => (
                  <div key={post.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-3">
                      {post.cover_image_url && (
                        <img src={post.cover_image_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                      )}
                      <div>
                        <p className="font-semibold text-slate-800">{post.title}</p>
                        <p className="text-xs text-slate-400">{post.published_at ? new Date(post.published_at).toLocaleDateString('pt-BR') : t('clubSite.notPublished')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${post.is_published ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {post.is_published ? t('clubSite.published') : t('clubSite.draft')}
                      </span>
                      <button onClick={() => setEditingPost(post)} className="p-1.5 text-slate-400 hover:text-primary rounded-lg hover:bg-white transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeletePost(post.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-white transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Link preview */}
      {publicUrl && (
        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <Globe className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-500 uppercase">{t('clubSite.publicUrl')}</p>
            <p className="text-sm font-mono text-slate-700 truncate">{window.location.origin}/{publicUrl}</p>
          </div>
          <a href={publicUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" /> Abrir
          </a>
        </div>
      )}
    </div>
  );
};

export default ClubSiteEditor;
