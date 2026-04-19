import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";
import { Loader2, PlusCircle, Pencil, X, Package, ExternalLink, CheckCircle, RefreshCw } from "lucide-react";
import { SuccessModal } from "../components/Toast";
import { formatCurrencyInput, formatVND, formatUSD, parseUSD, ensureUrlProtocol } from "../lib/formatters";

interface Order {
  _id?: string;
  id: string;
  trackingId: string;
  tracking_code: string;
  orderCode?: string;
  product_name: string;
  productName?: string;
  productType?: string;
  address: string;
  addressFrom?: string;
  addressTo?: string;
  total_price: number;
  order_date: string;
  sold_by: string;
  status: string;
  paymentStatus?: string;
  paymentPercent?: number;
  paidAmount?: number;
  userId?: string;
  origin?: string;
  destination?: string;
  date: string;
  createdAt: string;
  customerName?: string;
  customerEmail?: string;
  productLink?: string;
  uspsTracking?: string;
  priceUSD?: number;
  priceVND?: number;
  priceVNDFormatted?: string;
  exchangeRate?: number;
  totalUSD?: number;
  totalVND?: number;
}

interface OrderFormData {
  tracking_code: string;
  product_name: string;
  productName: string;
  productType: string;
  address: string;
  addressFrom: string;
  addressTo: string;
  total_price: string;
  order_date: string;
  sold_by: string;
  status: string;
  paymentStatus: string;
  paymentPercent: string;
  paidAmount: string;
  user_id: string;
  customerName: string;
  customerEmail: string;
  productLink: string;
  uspsTracking: string;
  priceUSD: string;
  exchangeRate: string;
  totalVND: string;
}

const initialFormData: OrderFormData = {
  tracking_code: "",
  product_name: "",
  productName: "",
  productType: "",
  address: "",
  addressFrom: "",
  addressTo: "",
  total_price: "",
  order_date: new Date().toISOString().split("T")[0],
  sold_by: "",
  status: "pending",
  paymentStatus: "pending",
  paymentPercent: "0",
  paidAmount: "",
  user_id: "",
  customerName: "",
  customerEmail: "",
  productLink: "",
  uspsTracking: "",
  priceUSD: "",
  exchangeRate: "",
  totalVND: "",
};

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-blue-100 text-blue-800",
    shipping: "bg-blue-100 text-blue-800",
    delivered: "bg-green-100 text-green-800",
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${styles[status] || "bg-gray-100 text-gray-800"}`}>
      {status}
    </span>
  );
};

const PaymentStatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    pending: "bg-gray-100 text-gray-600",
    paid: "bg-green-100 text-green-800",
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || "bg-gray-100 text-gray-800"}`}>
      {status}
    </span>
  );
};

// Component to display VND price with proper state handling
const VNDCell = ({ priceUSD, priceVND, onRecalculate }: { priceUSD?: number; priceVND?: number; onRecalculate?: () => void }) => {
  // If we have a valid VND number, display it
  if (typeof priceVND === "number" && priceVND > 0) {
    return (
      <span className="text-primary font-medium">
        {new Intl.NumberFormat("vi-VN").format(priceVND)} đ
      </span>
    );
  }

  // If we have USD but no VND, show recalculate button
  if (priceUSD && priceUSD > 0) {
    return (
      <button
        onClick={onRecalculate}
        className="text-amber-600 italic hover:text-amber-800 flex items-center gap-1"
        title="Click to calculate VND"
      >
        <RefreshCw className="w-3 h-3" />
        Update VND
      </button>
    );
  }

  // No price at all
  return <span className="text-gray-400">-</span>;
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [formData, setFormData] = useState<OrderFormData>(initialFormData);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [successData, setSuccessData] = useState<{ title: string; message: string } | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [fetchingRate, setFetchingRate] = useState(false);

  // Preview VND price
  const previewPriceVND = () => {
    const usd = parseUSD(formData.priceUSD);
    return exchangeRate ? usd * exchangeRate : 0;
  };

  // Fetch exchange rate directly from open.er-api.com
  async function fetchExchangeRate() {
    setFetchingRate(true);
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      const data = await res.json();
      if (data.rates && data.rates.VND) {
        setExchangeRate(data.rates.VND);
      }
    } catch (err) {
      console.warn("Failed to fetch exchange rate:", err);
      // Fallback to backend API
      try {
        const apiData = await api.get("/api/orders/exchange-rate");
        if (apiData.rate) {
          setExchangeRate(apiData.rate);
        }
      } catch (apiErr) {
        console.warn("Backend exchange rate also failed:", apiErr);
      }
    } finally {
      setFetchingRate(false);
    }
  }

  async function loadOrders() {
    try {
      const data = await api.get("/api/orders");
      setOrders(data.orders || []);
    } catch (err: any) {
      setError(err.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
    fetchExchangeRate();

    // Auto refresh exchange rate every 5 minutes
    const interval = setInterval(fetchExchangeRate, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  function openCreateModal() {
    setEditingOrder(null);
    setFormData(initialFormData);
    setFormError("");
    setShowModal(true);
  }

  function openEditModal(order: Order) {
    setEditingOrder(order);
    setFormData({
      tracking_code: order.tracking_code || order.trackingId || "",
      product_name: order.product_name || order.productName || "",
      productName: order.productName || order.product_name || "",
      productType: order.productType || "",
      address: order.address || order.addressFrom || order.destination || "",
      addressFrom: order.addressFrom || order.origin || "",
      addressTo: order.addressTo || order.destination || "",
      total_price: order.total_price?.toString() || "",
      order_date: order.order_date ? new Date(order.order_date).toISOString().split("T")[0] : "",
      sold_by: order.sold_by || "",
      status: order.status,
      paymentStatus: order.paymentStatus || "pending",
      paymentPercent: order.paymentPercent?.toString() || "0",
      paidAmount: order.paidAmount?.toString() || "",
      user_id: order.userId || "",
      customerName: order.customerName || "",
      customerEmail: order.customerEmail || "",
      productLink: order.productLink || "",
      uspsTracking: order.uspsTracking || "",
      priceUSD: order.priceUSD?.toString() || order.totalUSD?.toString() || "",
      exchangeRate: order.exchangeRate?.toString() || exchangeRate.toString(),
      totalVND: order.priceVND?.toString() || order.totalVND?.toString() || "",
    });
    setFormError("");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingOrder(null);
    setFormData(initialFormData);
    setFormError("");
  }

  function handlePriceUSDChange(value: string) {
    const formatted = formatCurrencyInput(value);
    setFormData({ ...formData, priceUSD: formatted });
  }

  async function handleApprove(orderId: string) {
    try {
      const response = await api.put(`/api/orders/${orderId}/approve`);
      // Immediately update the orders state
      if (response.order) {
        setOrders(prev => prev.map(order =>
          order._id === response.order._id || order.id === response.order.id
            ? response.order
            : order
        ));
      }
      setSuccessData({
        title: "Order Approved!",
        message: "Order has been approved successfully.",
      });
    } catch (err: any) {
      setError(err.message || "Failed to approve order");
    }
  }

  async function handleRecalculate(orderId: string) {
    try {
      const response = await api.post(`/api/orders/${orderId}/recalculate`);
      // Immediately update the orders state
      if (response.order) {
        setOrders(prev => prev.map(order =>
          order._id === response.order._id || order.id === response.order.id
            ? response.order
            : order
        ));
      }
      setSuccessData({
        title: "VND Recalculated!",
        message: "Exchange rate has been updated.",
      });
    } catch (err: any) {
      setError(err.message || "Failed to recalculate VND");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);

    try {
      // Build payload with all required fields
      const payload: any = {
        // Order identification
        tracking_code: formData.tracking_code || undefined,
        order_date: formData.order_date || undefined,

        // Product info
        productName: formData.productName || formData.product_name,
        product_name: formData.product_name,
        productType: formData.productType,
        productLink: formData.productLink || undefined,

        // Addresses
        addressFrom: formData.addressFrom,
        addressTo: formData.addressTo,
        address: formData.address || formData.addressTo || formData.addressFrom,

        // Customer info
        customerName: formData.customerName,
        customerEmail: formData.customerEmail,

        // Pricing
        priceUSD: formData.priceUSD,
        total_price: formData.total_price ? parseFloat(formData.total_price) : 0,
        exchangeRate: formData.exchangeRate ? parseFloat(formData.exchangeRate) : undefined,
        totalVND: formData.totalVND ? parseFloat(formData.totalVND) : undefined,

        // Status (admin only)
        sold_by: formData.sold_by || undefined,
        status: formData.status,
        paymentStatus: formData.paymentStatus,
        paymentPercent: formData.paymentPercent ? Number(formData.paymentPercent) : 0,
        uspsTracking: formData.uspsTracking || undefined,
      };

      // Log payload for debugging
      console.log("ORDER PAYLOAD:", payload);

      if (editingOrder) {
        const response = await api.put(`/api/orders/${editingOrder._id || editingOrder.id}`, payload);
        // Immediately update the orders state with the returned order
        if (response.order) {
          setOrders(prev => prev.map(order =>
            order._id === response.order._id || order.id === response.order.id
              ? response.order
              : order
          ));
        }
        setSuccessData({
          title: "Order Updated!",
          message: "The order has been updated successfully.",
        });
      } else {
        // For new orders, use admin create endpoint
        const response = await api.post("/api/orders/admin", payload);
        if (response.order) {
          setOrders(prev => [response.order, ...prev]);
        }
        setSuccessData({
          title: "Order Confirmed!",
          message: "Your order was placed successfully.",
        });
      }
      closeModal();
      loadOrders();
    } catch (err: any) {
      setFormError(err.message || "Failed to save order");
    } finally {
      setFormLoading(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-8 pb-20 space-y-8">
      <div className="flex justify-between items-center pt-10">
        <h1 className="text-4xl font-headline text-primary">Manage Orders</h1>
        <div className="flex items-center gap-4">
          <div className="text-sm text-on-surface-variant">
            <span className="font-medium">Exchange Rate:</span> {exchangeRate ? exchangeRate.toLocaleString() : "Loading..."} VND/USD
            <button
              onClick={fetchExchangeRate}
              className="ml-2 p-1 hover:bg-surface-container-high rounded-full transition-colors"
              title="Refresh rate"
            >
              <RefreshCw className={`w-4 h-4 ${fetchingRate ? "animate-spin" : ""}`} />
            </button>
          </div>
          <button
            onClick={openCreateModal}
            className="bg-primary text-on-primary px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg"
          >
            <PlusCircle className="w-5 h-5" />
            Create Order
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-2xl text-center">
          {error}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-surface-container-low rounded-[20px] p-16 text-center space-y-4">
          <div className="w-20 h-20 bg-surface-container-high rounded-full flex items-center justify-center mx-auto">
            <Package className="w-10 h-10 text-outline" />
          </div>
          <h3 className="text-2xl font-headline text-primary">No Orders Yet</h3>
          <p className="text-on-surface-variant">Create your first order to get started.</p>
          <button
            onClick={openCreateModal}
            className="bg-primary text-on-primary px-8 py-3 rounded-full font-bold inline-flex items-center gap-2"
          >
            <PlusCircle className="w-5 h-5" />
            Create Order
          </button>
        </div>
      ) : (
        <div className="bg-surface-container-low rounded-[20px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left bg-surface-container-high/50">
                  <th className="px-4 py-3 text-sm text-on-surface-variant font-bold">Order Code</th>
                  <th className="px-4 py-3 text-sm text-on-surface-variant font-bold">Product</th>
                  <th className="px-4 py-3 text-sm text-on-surface-variant font-bold">Customer</th>
                  <th className="px-4 py-3 text-sm text-on-surface-variant font-bold">Price USD</th>
                  <th className="px-4 py-3 text-sm text-on-surface-variant font-bold">Price VND</th>
                  <th className="px-4 py-3 text-sm text-on-surface-variant font-bold">Status</th>
                  <th className="px-4 py-3 text-sm text-on-surface-variant font-bold">Payment</th>
                  <th className="px-4 py-3 text-sm text-on-surface-variant font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {orders.map((order) => (
                  <tr key={order._id || order.id} className="hover:bg-surface-container-high/30 transition-colors">
                    <td className="px-4 py-3 font-headline text-primary font-bold text-sm">{order.orderCode || order.tracking_code || order.trackingId}</td>
                    <td className="px-4 py-3 text-sm max-w-[150px] truncate">
                      <div>
                        <p className="truncate font-medium">{order.product_name || order.productName || "-"}</p>
                        {order.productLink && (
                          <a
                            href={ensureUrlProtocol(order.productLink)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="w-3 h-3" />
                            Link
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="max-w-[150px]">
                        <p className="truncate font-medium">{order.customerName || "-"}</p>
                        <p className="text-xs text-outline truncate">{order.customerEmail || ""}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {order.priceUSD ? `$${order.priceUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-primary">
                      <VNDCell
                        priceUSD={order.priceUSD}
                        priceVND={order.priceVND}
                        onRecalculate={() => handleRecalculate(order._id || order.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3">
                      <PaymentStatusBadge status={order.paymentStatus || "pending"} />
                      {order.paymentPercent !== undefined && order.paymentPercent > 0 && (
                        <div className="text-xs text-outline mt-1">
                          {order.paymentPercent < 100 ? (
                            <span className="text-amber-600">{order.paymentPercent}% paid</span>
                          ) : (
                            <span className="text-green-600">Full paid</span>
                          )}
                        </div>
                      )}
                      {order.paidAmount !== undefined && order.paidAmount > 0 && (
                        <div className="text-xs text-outline">
                          {formatVND(order.paidAmount)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {order.status === "pending" && (
                          <button
                            onClick={() => handleApprove(order._id || order.id)}
                            className="p-2 hover:bg-green-100 rounded-full transition-colors"
                            title="Approve order"
                          >
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(order)}
                          className="p-2 hover:bg-primary/10 rounded-full transition-colors"
                          title="Edit order"
                        >
                          <Pencil className="w-4 h-4 text-primary" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 p-2 hover:bg-surface-container-high rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-2xl font-headline text-primary mb-6">
              {editingOrder ? "Edit Order" : "Create New Order"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-on-surface-variant mb-1">
                  Order Code {editingOrder ? "(leave empty to keep)" : "(auto-generated if empty)"}
                </label>
                <input
                  type="text"
                  className="w-full bg-surface-container-lowest rounded-full px-6 py-3"
                  placeholder={editingOrder ? "Leave empty to keep current" : "e.g., ORD-ABC123-XY (optional)"}
                  value={formData.tracking_code}
                  onChange={(e) => setFormData({ ...formData, tracking_code: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-surface-container-lowest rounded-full px-4 py-3"
                    placeholder="Product name"
                    value={formData.product_name}
                    onChange={(e) => setFormData({ ...formData, product_name: e.target.value, productName: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-1">Product Type *</label>
                  <select
                    required
                    className="w-full bg-surface-container-lowest rounded-full px-4 py-3"
                    value={formData.productType}
                    onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
                  >
                    <option value="">Select type</option>
                    <option value="shoes">Shoes</option>
                    <option value="electronics">Electronics</option>
                    <option value="fashion">Fashion</option>
                    <option value="beauty">Beauty</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-on-surface-variant mb-1">Product Link</label>
                <input
                  type="url"
                  className="w-full bg-surface-container-lowest rounded-full px-6 py-3"
                  placeholder="https://example.com/product"
                  value={formData.productLink}
                  onChange={(e) => setFormData({ ...formData, productLink: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-1">Address From *</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-surface-container-lowest rounded-full px-4 py-3"
                    placeholder="Origin address"
                    value={formData.addressFrom}
                    onChange={(e) => setFormData({ ...formData, addressFrom: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-1">Address To *</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-surface-container-lowest rounded-full px-4 py-3"
                    placeholder="Destination address"
                    value={formData.addressTo}
                    onChange={(e) => setFormData({ ...formData, addressTo: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-on-surface-variant mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  className="w-full bg-surface-container-lowest rounded-full px-6 py-3"
                  placeholder="Customer full name"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-on-surface-variant mb-1">Customer Email *</label>
                <input
                  type="email"
                  required
                  className="w-full bg-surface-container-lowest rounded-full px-6 py-3"
                  placeholder="customer@email.com"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                />
              </div>

              {/* Price USD with Live VND Preview */}
              <div>
                <label className="block text-sm font-bold text-on-surface-variant mb-1">Price USD</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full bg-surface-container-lowest rounded-full pl-8 pr-4 py-3"
                    placeholder="1,000"
                    value={formData.priceUSD}
                    onChange={(e) => handlePriceUSDChange(e.target.value)}
                  />
                </div>
                {formData.priceUSD && parseUSD(formData.priceUSD) > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <p className="text-sm text-primary font-medium">
                      VND: {formatVND(previewPriceVND())}
                    </p>
                    <span className="text-xs text-outline">(@ {exchangeRate ? exchangeRate.toLocaleString() : "..."} VND)</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-on-surface-variant mb-1">USPS Tracking Number</label>
                <input
                  type="text"
                  className="w-full bg-surface-container-lowest rounded-full px-6 py-3"
                  placeholder="e.g., 9400111899223"
                  value={formData.uspsTracking}
                  onChange={(e) => setFormData({ ...formData, uspsTracking: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-1">Order Date</label>
                  <input
                    type="date"
                    className="w-full bg-surface-container-lowest rounded-full px-6 py-3"
                    value={formData.order_date}
                    onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-1">Status</label>
                  <select
                    className="w-full bg-surface-container-lowest rounded-full px-6 py-3"
                    value={formData.status}
                    onChange={(e) => {
                      const newStatus = e.target.value;
                      // Auto-set payment to 100% when delivered
                      if (newStatus === "delivered") {
                        setFormData({
                          ...formData,
                          status: newStatus,
                          paymentPercent: "100",
                          paymentStatus: "paid",
                        });
                      } else {
                        setFormData({ ...formData, status: newStatus });
                      }
                    }}
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="shipping">Shipping</option>
                    <option value="delivered">Delivered</option>
                  </select>
                </div>
              </div>

              {/* Conditional Payment Percentage Input - Only for Pending orders */}
              {formData.status === "pending" && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-bold text-amber-800">Payment Percentage</label>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      Number(formData.paymentPercent) >= 100
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800"
                    }`}>
                      {Number(formData.paymentPercent) >= 100 ? "Paid" : "Partial"}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      className="flex-1 h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                      value={formData.paymentPercent}
                      onChange={(e) => {
                        const percent = e.target.value;
                        setFormData({
                          ...formData,
                          paymentPercent: percent,
                          paymentStatus: Number(percent) >= 100 ? "paid" : "pending",
                        });
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="w-20 bg-white rounded-full px-3 py-2 text-center font-bold border border-amber-300"
                        value={formData.paymentPercent}
                        onChange={(e) => {
                          const percent = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                          setFormData({
                            ...formData,
                            paymentPercent: percent.toString(),
                            paymentStatus: percent >= 100 ? "paid" : "pending",
                          });
                        }}
                      />
                      <span className="text-amber-800 font-bold">%</span>
                    </div>
                  </div>
                  {formData.totalVND && Number(formData.totalVND) > 0 && (
                    <p className="text-xs text-amber-700">
                      Estimated paid: {formatVND(Number(formData.totalVND) * Number(formData.paymentPercent) / 100)}
                    </p>
                  )}
                </div>
              )}

              {/* Payment Status - Auto-managed based on status and percentage */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-1">
                    Payment Status
                    {formData.status === "pending" && (
                      <span className="text-xs text-amber-600 ml-1">(auto)</span>
                    )}
                  </label>
                  <select
                    className={`w-full bg-surface-container-lowest rounded-full px-6 py-3 ${
                      formData.status === "pending" ? "opacity-60" : ""
                    }`}
                    value={formData.paymentStatus}
                    disabled={formData.status === "pending"}
                    onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-1">Sold By</label>
                  <input
                    type="text"
                    className="w-full bg-surface-container-lowest rounded-full px-6 py-3"
                    placeholder="Seller name"
                    value={formData.sold_by}
                    onChange={(e) => setFormData({ ...formData, sold_by: e.target.value })}
                  />
                </div>
              </div>

              {formError && (
                <p className="text-sm text-red-600">{formError}</p>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
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
                  ) : editingOrder ? (
                    "Update Order"
                  ) : (
                    "Create Order"
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
          autoRedirect="/admin/orders"
          redirectDelay={3000}
        />
      )}
    </div>
  );
}
