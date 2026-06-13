import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, Loader2, Package } from 'lucide-react';
import { storeService, Product, ProductVariant, PRODUCT_CATEGORIES } from '../services/storeService';
import { useLanguage } from '../contexts/LanguageContext';

interface VariantRow {
  localId: string;
  name: string;
  size: string;
  color: string;
  sku: string;
  stock: number;
  price_override: string;
}

let varCounter = 0;
const newLocalId = () => `v-${++varCounter}`;

const emptyVariant = (): VariantRow => ({
  localId: newLocalId(),
  name: '', size: '', color: '', sku: '', stock: 0, price_override: '',
});

const ProductForm: React.FC = () => {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [variants, setVariants] = useState<VariantRow[]>([]);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing || !id) return;
    storeService.getProducts().then(products => {
      const p = products.find(p => p.id === id);
      if (!p) return;
      setName(p.name);
      setCategory(p.category || '');
      setDescription(p.description || '');
      setBasePrice(String(p.base_price));
      setImageUrl(p.image_url || '');
      setIsActive(p.is_active ?? true);
      setVariants((p.variants || []).map(v => ({
        localId: newLocalId(),
        name: v.name,
        size: v.size || '',
        color: v.color || '',
        sku: v.sku || '',
        stock: v.stock ?? 0,
        price_override: v.price_override != null ? String(v.price_override) : '',
      })));
      setLoading(false);
    });
  }, [id, isEditing]);

  const updateVariant = (localId: string, field: keyof VariantRow, value: string | number) => {
    setVariants(prev => prev.map(v => v.localId === localId ? { ...v, [field]: value } : v));
  };

  const removeVariant = (localId: string) => {
    setVariants(prev => prev.filter(v => v.localId !== localId));
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Nome é obrigatório.'); return; }
    const price = parseFloat(basePrice);
    if (isNaN(price) || price < 0) { setError('Preço base inválido.'); return; }

    setSaving(true); setError(null);
    try {
      const productData = {
        name: name.trim(),
        category: category || null,
        description: description.trim() || null,
        base_price: price,
        image_url: imageUrl.trim() || null,
        is_active: isActive,
      };

      let productId = id;
      if (isEditing && id) {
        await storeService.updateProduct(id, productData);
      } else {
        const created = await storeService.createProduct(productData);
        productId = created.id;
      }

      if (productId) {
        await storeService.saveVariants(
          productId,
          variants.map(v => ({
            name: v.name || 'Padrão',
            size: v.size || null,
            color: v.color || null,
            sku: v.sku || null,
            stock: Number(v.stock) || 0,
            price_override: v.price_override ? parseFloat(v.price_override) : null,
          }))
        );
      }

      navigate('/store');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/store')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-slate-800">
          {isEditing ? t('store.product.editTitle') : t('store.product.newTitle')}
        </h1>
      </div>

      {/* Basic Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="font-semibold text-slate-700 flex items-center gap-2">
          <Package className="w-4 h-4" /> {t('store.product.info')}
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.name')} <span className="text-rose-500">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do produto"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.category')}</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="">{t('store.noCategory')}</option>
              {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('store.basePrice')} <span className="text-rose-500">*</span></label>
            <input type="number" min="0" step="0.01" value={basePrice} onChange={e => setBasePrice(e.target.value)}
              placeholder="0,00" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.description')}</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              placeholder="Descrição do produto..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('store.imageUrl')}</label>
            <input value={imageUrl} onChange={e => setImageUrl(e.target.value)}
              placeholder="https://..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2 flex items-center gap-3">
            <button onClick={() => setIsActive(a => !a)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-indigo-600' : 'bg-slate-200'}`}>
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className="text-sm text-slate-600">{isActive ? t('store.visible') : t('store.hidden')}</span>
          </div>
        </div>
      </div>

      {/* Variants */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">{t('store.product.variants')}</h2>
          <button onClick={() => setVariants(prev => [...prev, emptyVariant()])}
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800">
            <Plus className="w-3.5 h-3.5" /> {t('store.product.addVariant')}
          </button>
        </div>
        <p className="text-xs text-slate-400">
          {t('store.product.variantsHint')}
        </p>

        {variants.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg">
            {t('store.product.noVariants')}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-[1fr_80px_80px_80px_90px_32px] gap-2 text-xs font-medium text-slate-500 px-1">
              <span>{t('store.product.variantName')}</span><span>{t('store.product.size')}</span><span>{t('store.product.color')}</span><span>{t('common.stock')}</span><span>{t('store.product.price')}</span><span />
            </div>
            {variants.map(v => (
              <div key={v.localId} className="grid grid-cols-[1fr_80px_80px_80px_90px_32px] gap-2 items-center">
                <input value={v.name} onChange={e => updateVariant(v.localId, 'name', e.target.value)}
                  placeholder="ex: Azul G" className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
                <input value={v.size} onChange={e => updateVariant(v.localId, 'size', e.target.value)}
                  placeholder="P/M/G..." className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
                <input value={v.color} onChange={e => updateVariant(v.localId, 'color', e.target.value)}
                  placeholder="cor" className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
                <input type="number" min="0" value={v.stock} onChange={e => updateVariant(v.localId, 'stock', e.target.value)}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
                <input type="number" min="0" step="0.01" value={v.price_override}
                  onChange={e => updateVariant(v.localId, 'price_override', e.target.value)}
                  placeholder="base" className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
                <button onClick={() => removeVariant(v.localId)} className="p-1 text-slate-300 hover:text-rose-500 rounded">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error + Save */}
      {error && <p className="text-rose-600 text-sm bg-rose-50 rounded-lg px-4 py-2">{error}</p>}
      <div className="flex justify-end gap-3">
        <button onClick={() => navigate('/store')} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">{t('common.cancel')}</button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t('store.product.save')}
        </button>
      </div>
    </div>
  );
};

export default ProductForm;
