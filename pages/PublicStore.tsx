import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ShoppingBag, Plus, Minus, X, Loader2, CheckCircle2, Package } from 'lucide-react';
import { clubSiteService } from '../services/clubSiteService';
import { storeService, Product, ProductVariant } from '../services/storeService';

interface CartItem {
  product: Product;
  variant: ProductVariant | null;
  quantity: number;
  unitPrice: number;
}

const FMT = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`;

const PublicStore: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [clubName, setClubName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [qty, setQty] = useState(1);

  const [showCheckout, setShowCheckout] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return; }
    (async () => {
      const result = await clubSiteService.getBySlug(slug);
      if (!result) { setNotFound(true); setLoading(false); return; }
      const { site, tenant } = result;
      setTenantId(tenant.id);
      setClubName(tenant.name);
      setLogoUrl(tenant.logo_url || site.logo_url || null);
      setPrimaryColor(tenant.primary_color || site.primary_color || '#6366f1');
      const prods = await storeService.getProductsPublic(tenant.id);
      setProducts(prods);
      setLoading(false);
    })();
  }, [slug]);

  const effectivePrice = (p: Product, v: ProductVariant | null) =>
    v?.price_override != null ? v.price_override : p.base_price;

  const openProduct = (p: Product) => {
    setSelectedProduct(p);
    setSelectedVariant(p.variants?.length ? p.variants[0] : null);
    setQty(1);
  };

  const addToCart = () => {
    if (!selectedProduct) return;
    const price = effectivePrice(selectedProduct, selectedVariant);
    setCart(prev => {
      const key = selectedProduct.id! + (selectedVariant?.id || '');
      const existing = prev.find(i => i.product.id === selectedProduct.id && i.variant?.id === selectedVariant?.id);
      if (existing) {
        return prev.map(i => i.product.id === selectedProduct.id && i.variant?.id === selectedVariant?.id
          ? { ...i, quantity: i.quantity + qty }
          : i);
      }
      return [...prev, { product: selectedProduct, variant: selectedVariant, quantity: qty, unitPrice: price }];
    });
    setSelectedProduct(null);
  };

  const removeFromCart = (idx: number) => setCart(prev => prev.filter((_, i) => i !== idx));
  const changeQty = (idx: number, delta: number) =>
    setCart(prev => prev.map((item, i) => i === idx ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));

  const cartTotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const placeOrder = async () => {
    if (!tenantId || !buyerName.trim()) { setOrderError('Nome é obrigatório.'); return; }
    setPlacing(true); setOrderError(null);
    const result = await storeService.placeOrder(
      tenantId,
      buyerName.trim(),
      buyerEmail.trim(),
      buyerPhone.trim(),
      notes.trim(),
      cart.map(i => ({
        product_id: i.product.id!,
        variant_id: i.variant?.id,
        product_name: i.product.name,
        variant_name: i.variant?.name,
        unit_price: i.unitPrice,
        quantity: i.quantity,
      }))
    );
    if (result.error) {
      setOrderError(result.error);
    } else {
      setOrderId(result.order_id || null);
      setCart([]);
    }
    setPlacing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center text-slate-400">
          <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Loja não encontrada</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl
              ? <img src={logoUrl} alt={clubName} className="h-8 w-8 rounded-full object-cover" />
              : <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ backgroundColor: primaryColor }}>{clubName[0]}</div>}
            <div>
              <p className="font-semibold text-slate-800 leading-none">{clubName}</p>
              <p className="text-xs text-slate-400">Loja oficial</p>
            </div>
          </div>
          {cartCount > 0 && (
            <button onClick={() => { setShowCheckout(true); setOrderId(null); setOrderError(null); }}
              className="relative flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-xl"
              style={{ backgroundColor: primaryColor }}>
              <ShoppingBag className="w-4 h-4" />
              Ver carrinho
              <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {cartCount}
              </span>
            </button>
          )}
        </div>
      </header>

      {/* Products */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {products.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum produto disponível no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map(p => (
              <button key={p.id} onClick={() => openProduct(p)}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden text-left hover:shadow-md transition-shadow group">
                {p.image_url
                  ? <img src={p.image_url} alt={p.name} className="w-full h-40 object-cover group-hover:opacity-90 transition-opacity" />
                  : <div className="w-full h-40 bg-slate-100 flex items-center justify-center">
                      <Package className="w-10 h-10 text-slate-300" />
                    </div>}
                <div className="p-3">
                  {p.category && <p className="text-xs text-slate-400 mb-0.5">{p.category}</p>}
                  <p className="font-medium text-slate-800 text-sm leading-tight">{p.name}</p>
                  <p className="mt-1 font-semibold text-sm" style={{ color: primaryColor }}>{FMT(p.base_price)}</p>
                  {p.variants && p.variants.length > 0 && (
                    <p className="text-xs text-slate-400 mt-0.5">{p.variants.length} variantes</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Product modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            {selectedProduct.image_url && (
              <img src={selectedProduct.image_url} alt={selectedProduct.name} className="w-full h-48 object-cover rounded-t-2xl" />
            )}
            <div className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">{selectedProduct.name}</h2>
                {selectedProduct.description && <p className="text-sm text-slate-500 mt-1">{selectedProduct.description}</p>}
                <p className="text-xl font-bold mt-2" style={{ color: primaryColor }}>
                  {FMT(effectivePrice(selectedProduct, selectedVariant))}
                </p>
              </div>

              {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Variante</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedProduct.variants.map(v => (
                      <button key={v.id} onClick={() => setSelectedVariant(v)}
                        className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${selectedVariant?.id === v.id
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}>
                        {v.name}
                        {v.stock === 0 && <span className="text-xs text-rose-400 ml-1">(esgotado)</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <p className="text-xs font-medium text-slate-600">Quantidade</p>
                <div className="flex items-center gap-2 border border-slate-200 rounded-lg">
                  <button onClick={() => setQty(q => Math.max(1, q - 1))} className="p-2 hover:bg-slate-50"><Minus className="w-3.5 h-3.5 text-slate-500" /></button>
                  <span className="w-8 text-center text-sm font-medium">{qty}</span>
                  <button onClick={() => setQty(q => q + 1)} className="p-2 hover:bg-slate-50"><Plus className="w-3.5 h-3.5 text-slate-500" /></button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setSelectedProduct(null)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50">
                  Cancelar
                </button>
                <button onClick={addToCart}
                  disabled={selectedProduct.variants?.length ? selectedVariant?.stock === 0 : false}
                  className="flex-1 py-2.5 text-white text-sm font-semibold rounded-xl disabled:opacity-40"
                  style={{ backgroundColor: primaryColor }}>
                  Adicionar ao carrinho
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checkout modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">Finalizar pedido</h2>
              <button onClick={() => setShowCheckout(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            {orderId ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-800 mb-2">Pedido realizado!</h3>
                <p className="text-slate-500 text-sm">Pedido #{orderId.slice(0, 8).toUpperCase()}</p>
                <p className="text-slate-400 text-sm mt-2">Entraremos em contato em breve.</p>
                <button onClick={() => setShowCheckout(false)}
                  className="mt-6 px-6 py-2.5 text-white text-sm font-medium rounded-xl"
                  style={{ backgroundColor: primaryColor }}>
                  Continuar comprando
                </button>
              </div>
            ) : (
              <div className="p-6 space-y-5">
                {/* Cart summary */}
                <div className="space-y-2">
                  {cart.map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex items-center gap-1 border border-slate-200 rounded-md">
                          <button onClick={() => changeQty(i, -1)} className="p-1"><Minus className="w-3 h-3 text-slate-400" /></button>
                          <span className="w-5 text-center text-xs">{item.quantity}</span>
                          <button onClick={() => changeQty(i, 1)} className="p-1"><Plus className="w-3 h-3 text-slate-400" /></button>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-slate-700 truncate">{item.product.name}</p>
                          {item.variant && <p className="text-xs text-slate-400">{item.variant.name}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-medium">{FMT(item.unitPrice * item.quantity)}</span>
                        <button onClick={() => removeFromCart(i)} className="text-slate-300 hover:text-rose-400">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-slate-100 font-semibold text-slate-800">
                    <span>Total</span>
                    <span>{FMT(cartTotal)}</span>
                  </div>
                </div>

                {/* Buyer form */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Nome <span className="text-rose-500">*</span></label>
                    <input value={buyerName} onChange={e => setBuyerName(e.target.value)}
                      placeholder="Seu nome" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                      <input type="email" value={buyerEmail} onChange={e => setBuyerEmail(e.target.value)}
                        placeholder="email@exemplo.com" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Telefone</label>
                      <input value={buyerPhone} onChange={e => setBuyerPhone(e.target.value)}
                        placeholder="11999999999" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Observações</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                      placeholder="Informações adicionais..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" />
                  </div>
                </div>

                {orderError && <p className="text-rose-600 text-xs bg-rose-50 rounded-lg px-3 py-2">{orderError}</p>}

                <button onClick={placeOrder} disabled={placing || cart.length === 0}
                  className="w-full flex items-center justify-center gap-2 py-3 text-white font-semibold rounded-xl disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}>
                  {placing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
                  Confirmar pedido · {FMT(cartTotal)}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicStore;
