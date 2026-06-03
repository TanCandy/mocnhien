import { Truck, Wallet, PlusCircle, Search, Receipt, Lightbulb, Headset, ArrowRight, Loader2, Package, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { api } from "../lib/api";
import { useEffect, useState, FormEvent, Fragment } from "react";
import { SuccessModal } from "../components/Toast";
import { formatCurrencyInput, parseUSD, ensureUrlProtocol } from "../lib/formatters";
import { calculateVND, isValidExchangeRate, parseExchangeRate, formatExchangeRate } from "../lib/exchangeRate";
import { computeOrderVND } from "../lib/orderUtils";
import PaymentQR from "../components/PaymentQR";

type OrderStatus = "pending" | "approved" | "shipping" | "delivered";

interface Order {
  id: string;
  orderCode: string;
  trackingId: string;
  status: OrderStatus;
  paymentStatus?: string;
  date: string;
  warehouseAddress?: string;
  staffName?: string;
  weight: string;
  price: string;
  category: string;
  createdAt: string;
  priceUSD?: number;
  priceVND?: number;
  exchangeRate?: number;
  productType?: string;
  productName?: string;
  customerName?: string;
  contactType?: string;
  contactValue?: string;
}

interface OrderFormData {
  productType: string;
  productName: string;
  productLink: string;
  warehouseAddress: string;
  staffName: string;
  priceUSD: string;
  exchangeRate: string;
  paidAmount: number;
}

const initialFormData: OrderFormData = {
  productType: "",
  productName: "",
  productLink: "",
  warehouseAddress: "",
  staffName: "",
  priceUSD: "",
  exchangeRate: "",
  paidAmount: 0,
};

const StatusBadge = ({ status }: { status: OrderStatus }) => {
  const styles = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-blue-100 text-blue-800",
    shipping: "bg-blue-100 text-blue-800",
    delivered: "bg-green-100 text-green-800",
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${styles[status]}`}>
      {status}
    </span>
  );
};

export default function Dashboard() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create Order Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState<OrderFormData>(initialFormData);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [successData, setSuccessData] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    async function fetchOrders() {
      try {
        const data = await api.get("/api/orders/my-orders");
        setOrders(data.orders || []);
      } catch (err: any) {
        setError(err.message || "Failed to load your orders");
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, []);

  const activeShipments = orders.filter(o => o.status === "shipping" || o.status === "pending" || o.status === "approved").length;
  const totalSpentVND = orders.reduce(
    (sum, o) => sum + computeOrderVND(o.priceUSD, o.exchangeRate, o.priceVND),
    0
  );

  function openCreateModal() {
    setFormData(initialFormData);
    setFormError("");
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    setShowCreateModal(false);
    setFormData(initialFormData);
    setFormError("");
  }

  async function handleCreateOrder(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);

    try {
      // Validate exchange rate
      const exchangeRateValue = parseExchangeRate(formData.exchangeRate);
      if (!isValidExchangeRate(exchangeRateValue)) {
        setFormError("Please enter a valid exchange rate (must be greater than 0)");
        setFormLoading(false);
        return;
      }

      if (!formData.warehouseAddress.trim()) {
        setFormError("Warehouse address is required");
        setFormLoading(false);
        return;
      }
      if (!formData.staffName.trim()) {
        setFormError("Nhân viên nhập đơn is required");
        setFormLoading(false);
        return;
      }

      console.log("CREATE ORDER DATA:", formData);

      const payload = {
        productType: formData.productType,
        productName: formData.productName,
        productLink: formData.productLink || undefined,
        warehouseAddress: formData.warehouseAddress.trim(),
        staffName: formData.staffName.trim(),
        priceUSD: formData.priceUSD || undefined,
        exchangeRate: exchangeRateValue,
        paidAmount: formData.paidAmount || 0,
      };

      await api.post("/api/orders", payload);

      setSuccessData({
        title: "Order Submitted!",
        message: "Order submitted, waiting for approval",
      });

      closeCreateModal();

      // Refresh orders list from my-orders endpoint
      const data = await api.get("/api/orders/my-orders");
      setOrders(data.orders || []);
    } catch (err: any) {
      setFormError(err.message || "Failed to create order");
    } finally {
      setFormLoading(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 pb-20">
      <section className="mb-12 flex flex-col md:flex-row justify-between items-end gap-6">
        <div className="max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-headline text-primary mb-2">
            Chào mừng trở lại, {user?.name || "User"}
          </h1>
          <p className="text-on-surface-variant font-body text-lg">Hành trình vận chuyển của bạn đang được chúng tôi chăm sóc tỉ mỉ từng bước một.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-primary text-on-primary px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95"
        >
          <PlusCircle className="w-5 h-5" />
          Create New Order
        </button>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <div className="bg-surface-container-lowest p-8 rounded-[20px] shadow-[0_20px_40px_rgba(93,74,65,0.06)] flex flex-col justify-between h-48 border-l-4 border-primary">
          <div className="flex justify-between items-start">
            <span className="text-on-surface-variant font-bold uppercase tracking-widest text-xs">Active Shipments</span>
            <Truck className="text-primary-container w-6 h-6" />
          </div>
          <div className="text-5xl font-headline text-primary">{loading ? <Loader2 className="w-10 h-10 animate-spin" /> : activeShipments}</div>
        </div>
        <div className="bg-surface-container-lowest p-8 rounded-[20px] shadow-[0_20px_40px_rgba(93,74,65,0.06)] flex flex-col justify-between h-48">
          <div className="flex justify-between items-start">
            <span className="text-on-surface-variant font-bold uppercase tracking-widest text-xs">Total Spent</span>
            <Wallet className="text-primary-container w-6 h-6" />
          </div>
          <div className="text-5xl font-headline text-primary">
            {loading ? (
              <Loader2 className="w-10 h-10 animate-spin" />
            ) : (
              new Intl.NumberFormat("vi-VN", {
                style: "currency",
                currency: "VND",
                maximumFractionDigits: 0,
              }).format(totalSpentVND)
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-headline text-primary">Recent Shipments</h2>
            <button className="text-primary font-bold text-sm hover:underline">View All History</button>
          </div>
          <div className="bg-surface-container-low rounded-[20px] overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="p-8 text-center text-red-600">{error}</div>
            ) : orders.length === 0 ? (
              <div className="py-16 text-center space-y-4">
                <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center mx-auto">
                  <Package className="w-8 h-8 text-outline" />
                </div>
                <p className="text-on-surface-variant">No orders yet. Create your first shipment!</p>
                <button
                  onClick={openCreateModal}
                  className="inline-block bg-primary text-on-primary px-6 py-2 rounded-full font-bold text-sm"
                >
                  Create Order
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="text-left bg-surface-container-high/50">
                      <th className="px-6 py-4 text-sm text-on-surface-variant font-bold">Order Code</th>
                      <th className="px-6 py-4 text-sm text-on-surface-variant font-bold">Status</th>
                      <th className="px-6 py-4 text-sm text-on-surface-variant font-bold">Product</th>
                      <th className="px-6 py-4 text-sm text-on-surface-variant font-bold">Nhân viên</th>
                      <th className="px-6 py-4 text-sm text-on-surface-variant font-bold">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {orders.slice(0, 5).map((order) => (
                      <tr
                        key={order.id}
                        className="hover:bg-surface-container-highest/30 transition-colors cursor-pointer"
                        onClick={() => navigate(`/tracking`)}
                      >
                        <td className="px-6 py-5 font-headline text-primary font-bold">{order.orderCode || order.trackingId || order.id}</td>
                        <td className="px-6 py-5">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="px-6 py-5 text-on-surface">{order.productName || order.productName || "-"}</td>
                        <td className="px-6 py-5 text-on-surface">{order.staffName || "-"}</td>
                        <td className="px-6 py-5 text-on-surface">{order.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Payment QR Section */}
          {orders.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xl font-headline text-primary mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm8-2h8v8h-8v-8zm2 2v4h4v-4h-4z"/>
                </svg>
                Thanh Toán Nhanh
              </h3>
              <div className="flex flex-col gap-4">
                {orders
                  .filter(order => order.status !== "delivered")
                  .map((order) => {
                    const computedVND = computeOrderVND(order.priceUSD, order.exchangeRate, order.priceVND);
                    return (
                      <Fragment key={order.id}>
                        <PaymentQR
                          orderCode={order.orderCode || order.trackingId || order.id}
                          status={order.status}
                          amount={computedVND}
                        />
                      </Fragment>
                    );
                  })}
              </div>
              {orders.filter(o => o.status !== "delivered").length === 0 && (
                <p className="text-sm text-on-surface-variant mt-3 text-center">
                  Không có đơn hàng nào cần thanh toán.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
            <Link to="/tracking" className="group flex items-center p-6 bg-surface-container-lowest rounded-[20px] shadow-[0_10px_20px_rgba(93,74,65,0.03)] hover:bg-primary transition-all duration-300">
              <div className="w-12 h-12 rounded-full bg-primary-container/20 group-hover:bg-on-primary/20 flex items-center justify-center mr-4 transition-colors">
                <Search className="text-primary group-hover:text-on-primary w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="font-headline text-lg text-on-surface group-hover:text-on-primary">Track New Package</h3>
                <p className="text-sm text-on-surface-variant group-hover:text-on-primary/80">Real-time status updates</p>
              </div>
            </Link>
            <button className="group flex items-center p-6 bg-surface-container-lowest rounded-[20px] shadow-[0_10px_20px_rgba(93,74,65,0.03)] hover:bg-primary transition-all duration-300">
              <div className="w-12 h-12 rounded-full bg-primary-container/20 group-hover:bg-on-primary/20 flex items-center justify-center mr-4 transition-colors">
                <Receipt className="text-primary group-hover:text-on-primary w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="font-headline text-lg text-on-surface group-hover:text-on-primary">View Invoices</h3>
                <p className="text-sm text-on-surface-variant group-hover:text-on-primary/80">Billing and payment history</p>
              </div>
            </button>
          </div>
        </div>

        <aside className="space-y-8">
          <div>
            <h2 className="text-2xl font-headline text-primary mb-6">Shipping Insights</h2>
            <div className="relative rounded-[20px] overflow-hidden group">
              <img
                className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-700"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDLKUi-OXdecoz0ntaQWutBgIFUpdJbG1SzV0LIG0P42EWbZinv7lQnY5ReJFUkbjt8oqmlwP2zTta4MqAWf7I7o5aGf2J7LwpNX-DoUyY69Rkln-IZxDq76zWCab_qUtJxiGsRyaqM1CmTn7NmbVgTVxef9ULCfFXnkkPbbBRRfFAu7o59wLxnIECfX7w5nHagmiRWF5OjTRauo1l0pMeyuMtlucp3Yf_1TarpdISdxOK50D9RoxqedLxk3SUTRr5A6uqV3KFffg"
                alt="Luxury packaging"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent flex items-end p-6">
                <p className="text-on-primary font-headline text-xl">Eco-Friendly Packaging Now Available</p>
              </div>
            </div>
          </div>
          <div className="bg-surface-container-high rounded-[20px] p-6 space-y-6">
            <div className="flex items-center gap-3 text-primary">
              <Lightbulb className="w-5 h-5 fill-current" />
              <h3 className="font-bold uppercase tracking-widest text-xs">Shipping Tips</h3>
            </div>
            <div className="space-y-4">
              {[
                { title: "Fragile Item Logistics", desc: "How to secure your delicate goods for international transit through varied climates." },
                { title: "Customs Documentation", desc: "Avoid delays by ensuring your declaration forms match commercial invoices exactly." },
                { title: "Holiday Deadlines", desc: "Check our updated calendar for 2024 peak season shipping cut-off dates." },
              ].map((tip, i) => (
                <div key={i} className="group">
                  <h4 className="font-headline text-primary text-lg mb-1 group-hover:translate-x-1 transition-transform cursor-pointer">{tip.title}</h4>
                  <p className="text-sm text-on-surface-variant">{tip.desc}</p>
                  {i < 2 && <div className="w-full h-px bg-outline-variant/30 mt-4"></div>}
                </div>
              ))}
            </div>
            <button className="w-full py-3 border border-primary text-primary rounded-full font-bold text-sm hover:bg-primary hover:text-on-primary transition-all">
              Read All Guides
            </button>
          </div>
          <div className="bg-primary text-on-primary rounded-[20px] p-8 relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="font-headline text-2xl mb-2">Cần hỗ trợ?</h3>
              <p className="text-on-primary/80 text-sm mb-4">Đội ngũ chuyên gia của chúng tôi luôn sẵn sàng 24/7 để giải đáp thắc mắc của bạn.</p>
              <div className="space-y-2">
                <a className="block font-medium text-sm" href="tel:0392811031">
                  TP.HCM - Hiếu: 0392 811 031
                </a>
                <a className="block font-medium text-sm" href="tel:0935196052">
                  TP.HCM - Quyên: 0935 196 052
                </a>
                <a className="block font-medium text-sm" href="tel:0918170661">
                  TP. Hà Nội - Thu Quyên: 0918 170 661
                </a>
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 opacity-10">
              <Headset className="w-[120px] h-[120px]" />
            </div>
          </div>
        </aside>
      </div>

      {/* Create Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeCreateModal} />
          <div className="relative bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={closeCreateModal}
              className="absolute top-4 right-4 p-2 hover:bg-surface-container-high rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-2xl font-headline text-primary mb-2">Create New Order</h2>
            <p className="text-sm text-on-surface-variant mb-6">Fill in the details below to submit your order request.</p>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-on-surface-variant mb-1">Product Type *</label>
                <select
                  required
                  className="w-full bg-surface-container-lowest rounded-full px-6 py-3"
                  value={formData.productType}
                  onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
                >
                  <option value="">Select product type</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Fashion">Fashion & Apparel</option>
                  <option value="Beauty">Beauty & Cosmetics</option>
                  <option value="Home">Home & Living</option>
                  <option value="Health">Health & Supplements</option>
                  <option value="Books">Books & Stationery</option>
                  <option value="Toys">Toys & Games</option>
                  <option value="Sports">Sports & Outdoors</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-on-surface-variant mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  className="w-full bg-surface-container-lowest rounded-full px-6 py-3"
                  placeholder="Enter product name"
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-on-surface-variant mb-1">Product Link (Optional)</label>
                <input
                  type="url"
                  className="w-full bg-surface-container-lowest rounded-full px-6 py-3"
                  placeholder="https://example.com/product"
                  value={formData.productLink}
                  onChange={(e) => setFormData({ ...formData, productLink: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-on-surface-variant mb-1">Warehouse Address *</label>
                <input
                  type="text"
                  required
                  className="w-full bg-surface-container-lowest rounded-full px-6 py-3"
                  placeholder="Enter warehouse address"
                  value={formData.warehouseAddress}
                  onChange={(e) => setFormData({ ...formData, warehouseAddress: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-on-surface-variant mb-1">Nhân viên nhập đơn *</label>
                <input
                  type="text"
                  required
                  className="w-full bg-surface-container-lowest rounded-full px-6 py-3"
                  placeholder="Nhập tên nhân viên"
                  value={formData.staffName}
                  onChange={(e) => setFormData({ ...formData, staffName: e.target.value })}
                />
              </div>

              {/* Price USD and Exchange Rate Section */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-1">Price USD</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-full bg-surface-container-lowest rounded-full pl-8 pr-4 py-3"
                      placeholder="0.00"
                      value={formData.priceUSD}
                      onChange={(e) => setFormData({ ...formData, priceUSD: formatCurrencyInput(e.target.value) })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-1">Exchange Rate (USD → VND) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="1"
                    className="w-full bg-surface-container-lowest rounded-full px-6 py-3"
                    placeholder="e.g. 25000"
                    value={formData.exchangeRate}
                    onChange={(e) => setFormData({ ...formData, exchangeRate: e.target.value })}
                  />
                </div>
              </div>

              {/* Live VND Preview */}
              {formData.priceUSD && parseUSD(formData.priceUSD) > 0 && formData.exchangeRate && (
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
                  <p className="text-sm text-on-surface-variant mb-1">Estimated VND Amount:</p>
                  <p className="text-2xl font-headline text-primary">
                    {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
                      calculateVND(formData.priceUSD, parseExchangeRate(formData.exchangeRate))
                    )}
                  </p>
                  <p className="text-xs text-outline mt-1">
                    {parseUSD(formData.priceUSD)} USD × {formatExchangeRate(parseExchangeRate(formData.exchangeRate))}
                  </p>
                </div>
              )}

              {formError && (
                <p className="text-sm text-red-600">{formError}</p>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="flex-1 py-3 border border-outline text-on-surface rounded-full font-bold hover:bg-surface-container-high transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 bg-primary text-on-primary py-3 rounded-full font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                >
                  {formLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Submit Order"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successData && (
        <SuccessModal
          title={successData.title}
          message={successData.message}
          onClose={() => setSuccessData(null)}
          autoRedirect="/dashboard"
          redirectDelay={3000}
        />
      )}
    </div>
  );
}
