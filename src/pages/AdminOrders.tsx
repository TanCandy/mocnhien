import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";
import { Loader2, PlusCircle, Pencil, X, Package, ExternalLink, CheckCircle, RefreshCw, Trash2 } from "lucide-react";
import { SuccessModal } from "../components/Toast";
import { formatCurrencyInput, formatVND, formatUSD, parseUSD, ensureUrlProtocol } from "../lib/formatters";
import { calculateVND, parseExchangeRate, formatExchangeRate } from "../lib/exchangeRate";
import { getWarehouseAddress, computeOrderVND, getMongoOrderId, resolveContactDisplay } from "../lib/orderUtils";

// ─── Contact helpers ─────────────────────────────────────────────────────────

export type ContactType = "email" | "phone" | "none";

/** Parse contact fields from API response */
function parseOrderContact(order: {
  contactType?: string;
  contactValue?: string;
}): { contactType: ContactType; contactValue: string } {
  const ct = order.contactType;
  const cv = order.contactValue || "";
  if (ct === "phone") return { contactType: "phone", contactValue: cv };
  if (ct === "none" || cv === "NO_CONTACT") return { contactType: "none", contactValue: "NO_CONTACT" };
  if (ct === "email") return { contactType: "email", contactValue: cv };
  return { contactType: "email", contactValue: "" };
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function isValidPhone(v: string): boolean {
  // Accept any string with at least 6 digits (handles international formats like +84, 0912, etc.)
  const digits = v.replace(/[^\d]/g, "");
  return digits.length >= 6;
}

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
  warehouseAddress?: string;
  staffName?: string;
  total_price: number;
  order_date: string;
  sold_by: string;
  status: string;
  paymentStatus?: string;
  paymentPercent?: number;
  paidAmount?: number;
  totalVND?: number;
  userId?: string;
  origin?: string;
  destination?: string;
  date: string;
  createdAt: string;
  customerName?: string;
  contactType?: ContactType;
  contactValue?: string;
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
  orderCode: string;
  tracking_code: string;
  product_name: string;
  productName: string;
  productType: string;
  address: string;
  warehouseAddress: string;
  staffName: string;
  total_price: string;
  order_date: string;
  sold_by: string;
  status: string;
  paymentStatus: string;
  paymentPercent: string;
  paidAmount: string;
  user_id: string;
  customerName: string;
  contactType: ContactType;
  contactValue: string;
  productLink: string;
  uspsTracking: string;
  priceUSD: string;
  exchangeRate: string;
  totalVND: string;
}

const initialFormData: OrderFormData = {
  orderCode: "",
  tracking_code: "",
  product_name: "",
  productName: "",
  productType: "",
  address: "",
  warehouseAddress: "",
  staffName: "",
  total_price: "",
  order_date: new Date().toISOString().split("T")[0],
  sold_by: "",
  status: "pending",
  paymentStatus: "pending",
  paymentPercent: "0",
  paidAmount: "",
  user_id: "",
  customerName: "",
  contactType: "email" as ContactType,
  contactValue: "",
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

// Component to display VND price - always compute from USD
const VNDCell = ({ priceUSD, priceVND, exchangeRate }: { priceUSD?: number; priceVND?: number; exchangeRate?: number }) => {
  const computedVND = computeOrderVND(priceUSD, exchangeRate, priceVND);
  
  return (
    <span className="text-primary font-medium">
      {new Intl.NumberFormat("vi-VN").format(computedVND)} đ
    </span>
  );
};

// ─── Payment Section ──────────────────────────────────────────────────────────

interface PaymentSectionProps {
  totalVND: string;
  paymentPercent: string;
  paidAmount: string;
  status: string;
  onChange: (updates: { paymentPercent: string; paidAmount: string; paymentStatus: string }) => void;
}

function formatVNDInput(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n));
}

function parseVND(v: string): number {
  return Number(String(v).replace(/[^\d]/g, "")) || 0;
}

const PaymentSection = ({ totalVND, paymentPercent, paidAmount, status, onChange }: PaymentSectionProps) => {
  const total = parseVND(totalVND);
  const pct = Math.min(100, Math.max(0, Number(paymentPercent) || 0));
  const paid = parseVND(paidAmount);
  const remaining = total - paid;

  if (status !== "pending") {
    return null;
  }

  const handlePercentChange = (newPct: number) => {
    const clampedPct = Math.min(100, Math.max(0, newPct));
    const newPaid = total > 0 ? Math.round((clampedPct / 100) * total) : 0;
    onChange({
      paymentPercent: clampedPct.toString(),
      paidAmount: newPaid.toString(),
      paymentStatus: clampedPct >= 100 ? "paid" : "pending",
    });
  };

  const handlePaidAmountChange = (newPaidStr: string) => {
    const raw = parseVND(newPaidStr);
    const clamped = Math.min(total, Math.max(0, raw));
    const newPct = total > 0 ? Math.round((clamped / total) * 100) : 0;
    onChange({
      paymentPercent: newPct.toString(),
      paidAmount: clamped.toString(),
      paymentStatus: newPct >= 100 ? "paid" : "pending",
    });
  };

  const isPaid = pct >= 100;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold text-amber-800">Payment</label>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
          isPaid ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
        }`}>
          {isPaid ? "Paid" : `${pct}% Paid`}
        </span>
      </div>

      {/* Paid Amount VND */}
      <div>
        <label className="block text-xs font-medium text-amber-700 mb-1">Paid Amount (VND)</label>
        <div className="relative">
          <input
            type="number"
            inputMode="numeric"
            min="0"
            max={total || undefined}
            className="w-full bg-white rounded-xl px-4 py-2.5 pr-14 font-bold text-amber-900 border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
            value={paid > 0 ? paid : ""}
            placeholder="0"
            onChange={(e) => handlePaidAmountChange(e.target.value)}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-500">VND</span>
        </div>
      </div>

      {/* Percentage slider + input */}
      <div>
        <div className="flex items-center justify-between text-xs text-amber-700 mb-1">
          <span>Percentage</span>
          <span className="font-bold">{pct}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          className="w-full h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
          value={pct}
          onChange={(e) => handlePercentChange(Number(e.target.value))}
        />
      </div>

      {/* Percentage numeric input */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-amber-700 font-medium">%</span>
        <input
          type="number"
          min="0"
          max="100"
          className="w-20 bg-white rounded-xl px-3 py-2 text-center font-bold text-amber-900 border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
          value={pct}
          onChange={(e) => handlePercentChange(Number(e.target.value) || 0)}
        />
      </div>

      {/* Summary */}
      {total > 0 && (
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="bg-white rounded-xl px-3 py-2 border border-amber-200">
            <p className="text-[10px] text-amber-500 font-medium uppercase tracking-wider">Paid</p>
            <p className="text-sm font-bold text-amber-900">{formatVNDInput(paid)} đ</p>
          </div>
          <div className="bg-white rounded-xl px-3 py-2 border border-amber-200">
            <p className="text-[10px] text-amber-500 font-medium uppercase tracking-wider">Remaining</p>
            <p className={`text-sm font-bold ${remaining <= 0 ? "text-green-600" : "text-red-600"}`}>
              {remaining <= 0 ? "—" : `${formatVNDInput(remaining)} đ`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
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

  // Preview VND price based on user-entered exchange rate
  const previewPriceVND = () => {
    const usd = parseUSD(formData.priceUSD);
    const rate = parseExchangeRate(formData.exchangeRate);
    if (!rate || rate <= 0) return 0;
    return calculateVND(usd, rate);
  };

  async function loadOrders() {
    try {
      const data = await api.get(`/api/orders?_=${Date.now()}`);
      setOrders(data.orders || []);
    } catch (err: any) {
      setError(err.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
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
      orderCode: order.orderCode || "",
      tracking_code: order.tracking_code || order.trackingId || "",
      product_name: order.product_name || order.productName || "",
      productName: order.productName || order.product_name || "",
      productType: order.productType || "",
      address: getWarehouseAddress(order),
      warehouseAddress: getWarehouseAddress(order),
      staffName: order.staffName ?? "",
      total_price: order.total_price?.toString() || "",
      order_date: order.order_date ? new Date(order.order_date).toISOString().split("T")[0] : "",
      sold_by: order.sold_by || "",
      status: order.status,
      paymentStatus: order.paymentStatus || "pending",
      paymentPercent: order.paymentPercent?.toString() || "0",
      paidAmount: order.paidAmount?.toString() || "",
      user_id: order.userId || "",
      customerName: order.customerName || "",
      ...parseOrderContact(order),
      productLink: order.productLink || "",
      uspsTracking: order.uspsTracking || "",
      priceUSD: order.priceUSD?.toString() || order.totalUSD?.toString() || "",
      exchangeRate: order.exchangeRate?.toString() || "",
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
        setOrders((prev) =>
          prev.map((order) =>
            String(order._id) === String(response.order._id) ? response.order : order
          )
        );
        await loadOrders();
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
        setOrders((prev) =>
          prev.map((order) =>
            String(order._id) === String(response.order._id) ? response.order : order
          )
        );
        await loadOrders();
      }
      setSuccessData({
        title: "VND Recalculated!",
        message: "Exchange rate has been updated.",
      });
    } catch (err: any) {
      setError(err.message || "Failed to recalculate VND");
    }
  }

  async function handleDelete(orderId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this order? This action cannot be undone."
    );
    if (!confirmed) return;

    try {
      await api.delete(`/api/orders/${orderId}`);
      setOrders((prev) => prev.filter((order) => String(order._id) !== orderId));
      setSuccessData({
        title: "Order Deleted",
        message: "The order has been removed from the database and Google Sheets.",
      });
    } catch (err: any) {
      setError(err.message || "Failed to delete order");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);

    try {
      if (!formData.warehouseAddress.trim()) {
        setFormError("Warehouse address is required");
        setFormLoading(false);
        return;
      }

      // staffName required only when creating a new order (legacy orders may not have it yet)
      if (!editingOrder && !formData.staffName.trim()) {
        setFormError("Nhân viên nhập đơn is required");
        setFormLoading(false);
        return;
      }

      const rate = parseExchangeRate(formData.exchangeRate);
      if (!editingOrder && (!rate || rate <= 0)) {
        setFormError("Exchange rate must be greater than 0");
        setFormLoading(false);
        return;
      }
      if (editingOrder && formData.exchangeRate && (!rate || rate <= 0)) {
        setFormError("Exchange rate must be greater than 0");
        setFormLoading(false);
        return;
      }

      // Contact validation
      if (formData.contactType === "email") {
        if (!formData.contactValue.trim() || !isValidEmail(formData.contactValue)) {
          setFormError("Please enter a valid email address.");
          setFormLoading(false);
          return;
        }
      } else if (formData.contactType === "phone") {
        if (!formData.contactValue.trim() || !isValidPhone(formData.contactValue)) {
          setFormError("Please enter a valid phone number (digits only, allow +84).");
          setFormLoading(false);
          return;
        }
      }

      // Build payload with all required fields
      const payload: any = {
        // Order identification
        orderCode: formData.orderCode || undefined,
        tracking_code: formData.tracking_code || undefined,
        order_date: formData.order_date || undefined,

        // Product info
        productName: formData.productName || formData.product_name,
        product_name: formData.product_name,
        productType: formData.productType,
        productLink: formData.productLink || undefined,

        warehouseAddress: formData.warehouseAddress.trim(),
        staffName: formData.staffName.trim(),
        address: formData.warehouseAddress.trim(),

        // Customer info
        customerName: formData.customerName,
        contactType: formData.contactType,
        contactValue:
          formData.contactType === "none" ? "NO_CONTACT" : formData.contactValue.trim(),

        // Pricing
        priceUSD: formData.priceUSD,
        total_price: formData.total_price ? parseFloat(formData.total_price) : 0,
        exchangeRate: formData.exchangeRate ? parseFloat(formData.exchangeRate) : undefined,
        // Always send totalVND so the backend can trust it for remainingAmount calculation
        totalVND: formData.totalVND ? parseFloat(formData.totalVND) : 0,

        // Status (admin only)
        sold_by: formData.sold_by || undefined,
        status: formData.status,
        paymentStatus: formData.paymentStatus,
        paymentPercent: formData.paymentPercent ? Number(formData.paymentPercent) : 0,
        // Always send paidAmount (including 0) so backend knows the user saw/edited it
        paidAmount: Number(formData.paidAmount) || 0,
        // Backend will recalculate remainingAmount from totalVND - paidAmount
        uspsTracking: formData.uspsTracking || undefined,
      };

      if (editingOrder) {
        const orderId = getMongoOrderId(editingOrder);
        console.log("[AdminOrders] PUT /api/orders/" + orderId, payload);

        const response = await api.put(`/api/orders/${orderId}`, payload);

        if (!response?.order) {
          throw new Error("Update failed: server did not return the updated order.");
        }

        console.log("[AdminOrders] Update response:", {
          _id: response.order._id,
          staffName: response.order.staffName,
          warehouseAddress: response.order.warehouseAddress,
          exchangeRate: response.order.exchangeRate,
          contactType: response.order.contactType,
          contactValue: response.order.contactValue,
        });

        setOrders((prev) =>
          prev.map((order) =>
            String(order._id) === String(response.order._id) ? response.order : order
          )
        );

        await loadOrders();

        setSuccessData({
          title: "Order Updated!",
          message: "The order has been updated successfully.",
        });
      } else {
        console.log("[AdminOrders] POST /api/orders/admin", payload);
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
      if (!editingOrder) {
        await loadOrders();
      }
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
        <button
          onClick={openCreateModal}
          className="bg-primary text-on-primary px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg"
        >
          <PlusCircle className="w-5 h-5" />
          Create Order
        </button>
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
                  <th className="px-4 py-3 text-sm text-on-surface-variant font-bold">Warehouse Address</th>
                  <th className="px-4 py-3 text-sm text-on-surface-variant font-bold">Nhân viên</th>
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
                    <td className="px-4 py-3 text-sm max-w-[180px] truncate">{getWarehouseAddress(order) || "-"}</td>
                    <td className="px-4 py-3 text-sm max-w-[130px] truncate">{order.staffName || "-"}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="max-w-[150px]">
                        <p className="truncate font-medium">{order.customerName || "-"}</p>
                        <p className="text-xs text-outline truncate">
                          {resolveContactDisplay(
                            order.contactType,
                            order.contactValue
                          )}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {order.priceUSD ? `$${order.priceUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-primary">
                      <VNDCell
                        priceUSD={order.priceUSD}
                        priceVND={order.priceVND}
                        exchangeRate={order.exchangeRate}
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
                            onClick={() => handleApprove(getMongoOrderId(order))}
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
                        <button
                          onClick={() => handleDelete(getMongoOrderId(order))}
                          className="p-2 hover:bg-red-50 rounded-full transition-colors"
                          title="Delete order"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
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
                <label className="block text-sm font-bold text-on-surface-variant mb-1">
                  Nhân viên nhập đơn{!editingOrder ? " *" : ""}
                </label>
                <input
                  type="text"
                  required={!editingOrder}
                  className="w-full bg-surface-container-lowest rounded-full px-6 py-3"
                  placeholder="Nhập tên nhân viên"
                  value={formData.staffName}
                  onChange={(e) => setFormData({ ...formData, staffName: e.target.value })}
                />
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

              {/* Customer Contact */}
              <div>
                <label className="block text-sm font-bold text-on-surface-variant mb-1">Customer Contact *</label>
                <div className="flex gap-2">
                  <select
                    className="bg-surface-container-lowest rounded-full px-4 py-3 text-sm font-medium"
                    value={formData.contactType}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        contactType: e.target.value as ContactType,
                        contactValue:
                          e.target.value === "none" ? "NO_CONTACT" : "",
                      }))
                    }
                  >
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="none">No Contact</option>
                  </select>
                  <input
                    type={formData.contactType === "email" ? "email" : "tel"}
                    disabled={formData.contactType === "none"}
                    className="flex-1 bg-surface-container-lowest rounded-full px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder={
                      formData.contactType === "email"
                        ? "customer@email.com"
                        : formData.contactType === "phone"
                        ? "0987654321"
                        : "No Contact"
                    }
                    value={formData.contactValue}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, contactValue: e.target.value }))
                    }
                  />
                </div>
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
                      onChange={(e) => handlePriceUSDChange(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-1">Exchange Rate (USD → VND)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="w-full bg-surface-container-lowest rounded-full px-6 py-3"
                    placeholder="e.g. 25000"
                    value={formData.exchangeRate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, exchangeRate: e.target.value }))}
                  />
                </div>
              </div>

              {/* Live VND Preview */}
              {formData.priceUSD && parseUSD(formData.priceUSD) > 0 && formData.exchangeRate && (
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
                  <p className="text-sm text-on-surface-variant mb-1">Estimated VND Amount:</p>
                  <p className="text-2xl font-headline text-primary">
                    {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
                      previewPriceVND()
                    )}
                  </p>
                  <p className="text-xs text-outline mt-1">
                    {parseUSD(formData.priceUSD)} USD × {formatExchangeRate(parseExchangeRate(formData.exchangeRate))}
                  </p>
                </div>
              )}

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
                      if (newStatus === "delivered") {
                        const total = parseVND(formData.totalVND);
                        setFormData({
                          ...formData,
                          status: newStatus,
                          paymentPercent: "100",
                          paidAmount: total.toString(),
                          paymentStatus: "paid",
                        });
                      } else {
                        setFormData((prev) => ({ ...prev, status: newStatus }));
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

              {/* Payment Section — bidirectional % ↔ VND sync */}
              <PaymentSection
                totalVND={formData.totalVND}
                paymentPercent={formData.paymentPercent}
                paidAmount={formData.paidAmount}
                status={formData.status}
                onChange={(updates) => setFormData((prev) => ({ ...prev, ...updates }))}
              />

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
                    onChange={(e) => setFormData({ ...prev, paymentStatus: e.target.value })}
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
                    onChange={(e) => setFormData((prev) => ({ ...prev, sold_by: e.target.value }))}
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
