import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingBag, Plus, Pencil, Trash2, Loader2, Package,
  ClipboardList, ToggleLeft, ToggleRight, ExternalLink,
} from 'lucide-react';
import {
  storeService, Product, Order,
  ORDER_STATUS_LABELS, ORDER_STATUS_CLASSES, PRODUCT_CATEGORIES,
} from '../services/storeService';
import { useTenant } from '../contexts/TenantContext';

type Tab = 'products' | 'orders';

const FMT = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`;

const Store: React.FC = () => {
  const navigate = useNavigate();
  const { currentTenant } = useTenant();

  const [tab, setTab] = useState<Tab>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    try { setProducts(await storeService.getProducts()); }
    finally { setLoadingProducts(false); }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try { setOrders(await storeService.getOrders()); }
    finally { setLoadingOrders(false); }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { if (tab === 'orders') loadOrders(); }, [tab, loadOrders]);

  const toggleActive = async (p: Product) => {
    await storeService.updateProduct(p.id!, { is_active: !p.is_active });
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !x.is_active } : x));
  };

  const deleteProduct = async (id: string) => {
    if (!window.confirm('Remover produto? Esta ação também remove as variantes.')) return;
    await storeService.deleteProduct(id);
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const updateStatus = async (orderId: string, status: Order['status']) => {
    await storeService.updateOrderStatus(orderId, status);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
  };

  const deleteOrder = async (id: string) => {
    if (!window.confirm('Remover pedido?')) return;
    await storeService.deleteOrder(id);
    setOrders(prev => prev.filter(o => o.id !== id));
  };

  const publicStoreUrl = currentTenant?.slug ? `${window.location.origin}/#/shop/${currentTenant.slug}` : null;

  const totalStock = (p: Product) =>
    p.variants?.length ? p.variants.reduce((s, v) => s + (v.stock ?? 0), 0) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Loja</h1>
          <p className="text-slate-500 text-sm mt-0.5">Gerencie produtos e pedidos do clube.</p>
        </div>
        <div className="flex items-center gap-2">
          {publicStoreUrl && (
            <a href={publicStoreUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
              <ExternalLink className="w-3.5 h-3.5" /> Visualizar loja
            </a>
          )}
          {tab === 'products' && (
            <button onClick={() => navigate('/store/products/new')}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              <Plus className="w-4 h-4" /> Novo Produto
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {(['products', 'orders'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t === 'products' ? <><Package className="w-4 h-4" /> Produtos</> : <><ClipboardList className="w-4 h-4" /> Pedidos</>}
          </button>
        ))}
      </div>

      {/* Products Tab */}
      {tab === 'products' && (
        loadingProducts ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <ShoppingBag className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">Nenhum produto cadastrado</p>
            <p className="text-sm mt-1">Clique em "Novo Produto" para começar.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map(p => {
              const stock = totalStock(p);
              return (
                <div key={p.id} className={`bg-white rounded-xl border ${p.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60'} overflow-hidden`}>
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-36 object-cover" />
                  ) : (
                    <div className="w-full h-36 bg-slate-100 flex items-center justify-center">
                      <Package className="w-10 h-10 text-slate-300" />
                    </div>
                  )}
                  <div className="p-4">
                    {p.category && <p className="text-xs text-slate-400 mb-0.5">{p.category}</p>}
                    <p className="font-semibold text-slate-800 truncate">{p.name}</p>
                    <p className="text-indigo-600 font-medium text-sm mt-1">{FMT(p.base_price)}</p>
                    {stock !== null && (
                      <p className={`text-xs mt-1 ${stock === 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                        {stock === 0 ? 'Sem estoque' : `${stock} em estoque`}
                        {p.variants && p.variants.length > 1 && ` · ${p.variants.length} variantes`}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                      <button onClick={() => toggleActive(p)}
                        title={p.is_active ? 'Desativar' : 'Ativar'}
                        className={`${p.is_active ? 'text-indigo-500' : 'text-slate-300'} hover:opacity-80`}>
                        {p.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                      <div className="flex gap-1">
                        <button onClick={() => navigate(`/store/products/${p.id}`)}
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-indigo-600">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteProduct(p.id!)}
                          className="p-1.5 rounded-md hover:bg-rose-50 text-slate-300 hover:text-rose-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Orders Tab */}
      {tab === 'orders' && (
        loadingOrders ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <ClipboardList className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">Nenhum pedido recebido</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Data</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Comprador</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Total</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <React.Fragment key={o.id}>
                    <tr
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 cursor-pointer"
                      onClick={() => setExpandedOrder(expandedOrder === o.id ? null : o.id!)}
                    >
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {o.created_at ? new Date(o.created_at).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{o.buyer_name}</p>
                        {o.buyer_email && <p className="text-xs text-slate-400 truncate max-w-[160px]">{o.buyer_email}</p>}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{FMT(o.total_amount ?? 0)}</td>
                      <td className="px-4 py-3">
                        <select
                          value={o.status || 'pending'}
                          onClick={e => e.stopPropagation()}
                          onChange={e => { e.stopPropagation(); updateStatus(o.id!, e.target.value as Order['status']); }}
                          className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${ORDER_STATUS_CLASSES[o.status || 'pending']}`}
                        >
                          {Object.entries(ORDER_STATUS_LABELS).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={e => { e.stopPropagation(); deleteOrder(o.id!); }}
                          className="p-1.5 rounded hover:bg-rose-50 text-slate-300 hover:text-rose-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                    {expandedOrder === o.id && (
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <td colSpan={5} className="px-6 py-4">
                          <div className="space-y-1.5">
                            {(o.items || []).map(item => (
                              <div key={item.id} className="flex items-center justify-between text-sm">
                                <span className="text-slate-700">
                                  {item.product_name}
                                  {item.variant_name && <span className="text-slate-400"> · {item.variant_name}</span>}
                                  <span className="text-slate-400 ml-2">× {item.quantity}</span>
                                </span>
                                <span className="text-slate-600 font-medium">{FMT(item.subtotal)}</span>
                              </div>
                            ))}
                            {o.notes && <p className="text-xs text-slate-400 mt-2 italic">Obs: {o.notes}</p>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
};

export default Store;
