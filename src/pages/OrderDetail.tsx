import { useCallback, useEffect, useState } from "react";
import { Truck, History, Package, Wallet, Headset, ArrowLeft, MapPin, Weight, Tag, Loader2, AlertTriangle, QrCode } from "lucide-react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { formatVND, formatUSD } from "../lib/formatters";
import { getWarehouseAddress } from "../lib/orderUtils";
import PaymentQR from "../components/PaymentQR";

interface TimelineEvent {
  status: string;
  location: string;
  time: string;
  description: string;
  completed: boolean;
}

interface OrderData {
  id: string;
  status: string;
  date: string;
  warehouseAddress?: string;
  staffName?: string;
  weight?: string;
  category?: string;
  productName?: string;
  productType?: string;
  priceUSD?: number;
  priceVND?: number;
  exchangeRate?: number;
  paidAmount?: number;
  remainingAmount?: number;
  paymentStatus?: string;
  uspsTracking?: string;
  timeline: TimelineEvent[];
}

const capitalise = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showQR, setShowQR] = useState(false);

  const loadOrder = useCallback(() => {
    if (!id) return;
    api
      .get(`/api/orders/track?code=${encodeURIComponent(id)}`)
      .then((data) => {
        if (data.order) setOrder(data.order);
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setOrder(null);
    api
      .get(`/api/orders/track?code=${encodeURIComponent(id || "")}`)
      .then((data) => {
        if (cancelled) return;
        if (data.order) setOrder(data.order);
        else setError("Order not found.");
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError(err.status === 404 ? "Order not found." : err.message || "Failed to load order.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-8 pb-20 flex items-center justify-center gap-3 py-32 text-on-surface-variant" role="status">
        <Loader2 className="w-6 h-6 animate-spin" />
        Loading order…
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-xl mx-auto px-8 pb-20 py-24 text-center space-y-6">
        <AlertTriangle className="w-12 h-12 text-error mx-auto" />
        <h1 className="text-3xl font-headline text-on-surface">Order unavailable</h1>
        <p className="text-on-surface-variant" role="alert">{error || "Order not found."}</p>
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-primary font-bold hover:underline">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const warehouse = getWarehouseAddress(order) || "—";
  const hasPrice = (order.priceUSD || 0) > 0;
  const timeline = order.timeline || [];

  return (
    <div className="max-w-7xl mx-auto px-8 pb-20">
      <header className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <Link to="/dashboard" className="text-primary font-bold tracking-widest uppercase text-sm mb-4 flex items-center gap-2 hover:underline">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <p className="text-primary font-bold tracking-widest uppercase text-sm mb-2">Shipment Tracking</p>
          <h1 className="text-5xl font-headline text-on-surface">{order.id}</h1>
          <div className="mt-4 flex items-center gap-3">
            <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold ${
              order.status === "delivered" ? "bg-green-100 text-green-800" : "bg-primary-container text-on-primary-container"
            }`}>
              <Truck className="mr-2 w-4 h-4 fill-current" />
              {capitalise(order.status)}
            </span>
            <span className="text-on-surface-variant text-sm font-medium">Ordered: {order.date}</span>
          </div>
        </div>
      </header>

      <section className="mb-16 bg-surface-container-low rounded-[20px] p-8 md:p-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-outline">
              <MapPin className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Warehouse Address</span>
            </div>
            <p className="font-headline font-bold text-primary text-lg">{warehouse}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-outline">
              <Weight className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Weight</span>
            </div>
            <p className="font-headline font-bold text-primary text-lg">{order.weight || "—"}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-outline">
              <Tag className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Category</span>
            </div>
            <p className="font-headline font-bold text-primary text-lg capitalize">{order.category || "general"}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section>
            <h2 className="text-3xl font-headline text-on-surface mb-8 flex items-center">
              <History className="mr-3 text-primary w-8 h-8" />
              Detailed Tracking History
            </h2>
            <div className="relative before:absolute before:left-6 before:top-4 before:bottom-4 before:w-px before:bg-outline-variant">
              {timeline.map((event, i) => (
                <div key={i} className="relative pl-16 pb-10">
                  <div className={`absolute rounded-full border-4 border-surface ${
                    event.completed ? "left-4 top-1 w-4 h-4 bg-primary ring-4 ring-primary-container/20" : "left-5 top-1 w-2 h-2 bg-outline"
                  }`}></div>
                  <div className="flex flex-col md:flex-row md:justify-between items-start gap-2">
                    <div>
                      <h3 className={`font-bold text-lg ${event.completed ? "text-on-surface" : "text-on-surface-variant"}`}>{event.status}</h3>
                      <p className="text-on-surface-variant">{event.location}</p>
                      <p className="text-sm text-on-surface-variant/70 mt-1">{event.description}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-headline font-bold ${event.completed ? "text-primary" : "text-on-surface-variant"}`}>{event.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <div className="bg-surface-container-lowest rounded-[20px] p-8 shadow-[0_20px_40px_rgba(93,74,65,0.06)] border border-outline-variant/10">
            <h3 className="text-2xl font-headline text-on-surface mb-6">Package Overview</h3>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center flex-shrink-0">
                  <Package className="text-on-secondary-container w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Contents</p>
                  <p className="text-on-surface font-medium">{order.productName || "—"}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Nhân viên</p>
                <p className="text-on-surface font-medium">{order.staffName || "N/A"}</p>
              </div>
              {order.uspsTracking && (
                <div>
                  <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">USPS Tracking</p>
                  <p className="text-on-surface font-medium break-all">{order.uspsTracking}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Weight</p>
                  <p className="text-on-surface font-medium">{order.weight || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Status</p>
                  <p className="text-on-surface font-medium capitalize">{order.status}</p>
                </div>
              </div>
              <div className="pt-6 border-t border-outline-variant/20">
                <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider mb-2">Declared Value</p>
                <p className="text-2xl font-headline text-primary">{hasPrice ? formatUSD(order.priceUSD) : "—"}</p>
              </div>
            </div>
          </div>

          <div className="bg-primary text-on-primary rounded-[20px] p-8 shadow-xl">
            <h3 className="text-2xl font-headline mb-6">Billing Summary</h3>
            <div className="space-y-4">
              <div className="flex justify-between text-sm opacity-80">
                <span>Price (USD)</span>
                <span>{hasPrice ? formatUSD(order.priceUSD) : "—"}</span>
              </div>
              <div className="flex justify-between text-sm opacity-80">
                <span>Exchange rate</span>
                <span>{order.exchangeRate ? `${order.exchangeRate.toLocaleString("vi-VN")} đ` : "—"}</span>
              </div>
              <div className="flex justify-between text-sm opacity-80">
                <span>Paid</span>
                <span>{formatVND(order.paidAmount || 0)}</span>
              </div>
              <div className="flex justify-between text-sm opacity-80">
                <span>Remaining</span>
                <span>{formatVND(order.remainingAmount || 0)}</span>
              </div>
              <div className="pt-4 border-t border-on-primary/20 flex justify-between items-end">
                <span className="font-bold">Total</span>
                <span className="text-3xl font-headline">{formatVND(order.priceVND || 0)}</span>
              </div>
              <div className="pt-4 flex items-center gap-2 text-xs opacity-70">
                <Wallet className="w-4 h-4" />
                <span className="capitalize">Payment status: {order.paymentStatus || "pending"}</span>
              </div>
            </div>
          </div>

          {order.remainingAmount && order.remainingAmount > 0 ? (
            <div>
              <button
                type="button"
                onClick={() => setShowQR((prev) => !prev)}
                className="w-full py-3 px-4 rounded-[20px] bg-secondary-container text-on-secondary-container font-bold text-sm shadow hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <QrCode className="w-4 h-4" />
                {showQR ? "Ẩn mã VietQR" : "Thanh toán ngay (VietQR)"}
              </button>
            </div>
          ) : null}

          {showQR && (
            <div className="bg-surface-container-lowest rounded-[20px] p-6 shadow-md border border-outline-variant/10">
              <PaymentQR orderId={order.id} onPaid={loadOrder} />
            </div>
          )}

          <div className="bg-primary-container/20 text-on-primary-container rounded-[20px] p-6 flex items-center gap-4">
            <Headset className="w-10 h-10" />
            <div>
              <p className="font-bold">Need Assistance?</p>
              <p className="text-sm opacity-80">Our courier experts are available 24/7 for {order.id}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
