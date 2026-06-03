import { useState, useEffect, useRef } from "react";
import { CheckCircle2, Search, ArrowRight, Loader2, AlertTriangle, ExternalLink, LogIn } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { formatVND, formatUSD, ensureUrlProtocol } from "../lib/formatters";
import { getWarehouseAddress, computeOrderVND, resolveContactDisplay } from "../lib/orderUtils";
import { useUser } from "../context/UserContext";

interface TimelineEvent {
  status: string;
  location: string;
  time: string;
  description: string;
  completed: boolean;
}

interface Order {
  id: string;
  orderCode: string;
  trackingId: string;
  status: string;
  date: string;
  warehouseAddress?: string;
  staffName?: string;
  origin?: string;
  destination?: string;
  weight: string;
  price: string;
  customerName?: string;
  contactType?: string;
  contactValue?: string;
  productLink?: string;
  uspsTracking?: string;
  priceUSD?: number;
  priceVND?: number;
  exchangeRate?: number;
  priceVNDFormatted?: string;
  timeline: TimelineEvent[];
}

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    shipping: "bg-blue-100 text-blue-800",
    delivered: "bg-green-100 text-green-800",
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${styles[status] || "bg-gray-100 text-gray-800"}`}>
      {status}
    </span>
  );
};

export default function Tracking() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [foundOrder, setFoundOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSuggestions([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = async (value: string) => {
    setQuery(value);
    setSelectedOrder(null);
    setFoundOrder(null);
    setError("");

    if (!value.trim()) {
      setSuggestions([]);
      return;
    }

    // If user typed a full order code (starts with MN-), skip suggestions and go straight to track
    if (value.startsWith("MN-")) {
      setSuggestions([]);
      return;
    }

    // Debounce search API call
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.get(`/api/orders/search?q=${encodeURIComponent(value.trim())}`);
        setSuggestions(data || []);
      } catch (err) {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const selectOrder = (order: Order) => {
    setSelectedOrder(order);
    setQuery(order.customerName);
    setSuggestions([]);
  };

  const handleTrack = async () => {
    if (!selectedOrder) {
      setError("Please select an order from the suggestions.");
      return;
    }

    setLoading(true);
    setError("");
    setFoundOrder(null);

    try {
      // Use the existing track API with the orderCode
      const data = await api.get(`/api/orders/track?code=${encodeURIComponent(selectedOrder.orderCode)}`);
      if (data.order) {
        setFoundOrder(data.order);
        setError("");
      } else {
        setFoundOrder(null);
        setError("Order not found. Please check the tracking code.");
      }
    } catch (err: any) {
      setFoundOrder(null);
      if (err.status === 401) {
        setError("Session expired. Please log in again.");
      } else if (err.message && err.message.includes("does not belong")) {
        setError(err.message);
      } else {
        setError(err.message || "Order not found. Please check the tracking code.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-6 pt-12 space-y-10 max-w-4xl mx-auto pb-24">
      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="font-headline text-3xl font-bold text-primary leading-tight">Follow Your Legacy</h2>
          <p className="text-on-surface-variant font-body text-sm leading-relaxed max-w-[80%]">
            Search by order code or customer name to view the journey of your curated parcel.
          </p>
        </div>
        <div className="relative group">
          <div className="absolute inset-0 bg-primary/5 blur-2xl rounded-full opacity-50 group-focus-within:opacity-100 transition-opacity"></div>
          <div className="relative flex items-center bg-surface-container-lowest rounded-full p-2 shadow-[0_20px_40px_rgba(93,74,65,0.06)] border border-outline-variant/10">
            <input
              className="w-full bg-transparent border-none focus:ring-0 px-6 py-3 font-headline text-lg tracking-widest text-primary placeholder:text-outline-variant/60"
              placeholder="Enter order code or customer name"
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTrack()}
            />
            <button
              onClick={handleTrack}
              disabled={loading}
              className="bg-primary text-on-primary px-8 py-3 rounded-full font-bold tracking-wide hover:bg-primary/90 transition-all active:scale-95 duration-200 flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Track"
              )}
            </button>
          </div>

          {/* Suggestion dropdown */}
          {suggestions.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-xl border border-outline-variant/10 overflow-hidden"
            >
              {searching ? (
                <div className="px-6 py-4 text-sm text-on-surface-variant flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching...
                </div>
              ) : (
                suggestions.map((order) => (
                  <div
                    key={order.id}
                    onClick={() => selectOrder(order)}
                    className="px-6 py-3 cursor-pointer hover:bg-primary/5 transition-colors flex items-center justify-between"
                  >
                    <span className="font-medium text-sm text-primary">
                      {order.customerName || "Unknown"}
                    </span>
                    <span className="text-xs text-on-surface-variant font-mono">
                      {order.orderCode}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {error && (
            <div className="mt-4">
              <div className={`flex items-start gap-3 p-4 rounded-2xl ${
                error.includes("log in") || error.includes("Please log in")
                  ? "bg-blue-50 border border-blue-200 text-blue-800"
                  : error.includes("does not belong") || error.includes("403")
                  ? "bg-amber-50 border border-amber-200 text-amber-800"
                  : "bg-red-50 border border-red-200 text-red-800"
              }`}>
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-sm">{error}</p>
                  {(error.includes("does not belong") || error.includes("log in")) && (
                    <div className="mt-2 flex gap-2">
                      {error.includes("does not belong") && (
                        <p className="text-xs opacity-80">
                          This tracking code is registered to a different email.
                        </p>
                      )}
                      {error.includes("log in") && !user && (
                        <Link
                          to="/login"
                          className="inline-flex items-center gap-1 text-sm font-bold hover:underline"
                        >
                          <LogIn className="w-4 h-4" />
                          Log in to track your order
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {foundOrder ? (
        <section className="bg-surface-container-low rounded-[20px] p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Header with Status */}
          <div className="flex justify-between items-end border-b border-outline-variant/20 pb-6">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Current Status</span>
              <h3 className="font-headline text-3xl font-bold text-primary capitalize">{foundOrder.status}</h3>
              <p className="text-xs text-on-surface-variant mt-1">
                Order ID: <span className="font-bold">{foundOrder.id}</span>
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Expected Delivery</span>
              <p className="font-bold text-on-surface text-lg">{foundOrder.date}</p>
            </div>
          </div>

          {/* Price Display - USD and VND */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10">
              <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">Price (USD)</p>
              <p className="font-headline text-2xl text-primary">
                {foundOrder.priceUSD ? formatUSD(foundOrder.priceUSD) : "-"}
              </p>
            </div>
            <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10">
              <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">Price (VND)</p>
              <p className="font-headline text-2xl text-primary">
                {(() => {
                  const vnd = computeOrderVND(foundOrder.priceUSD, foundOrder.exchangeRate, foundOrder.priceVND);
                  return vnd > 0 ? formatVND(vnd) : "-";
                })()}
              </p>
            </div>
          </div>

          {/* Product Link and USPS Tracking */}
          {(foundOrder.productLink || foundOrder.uspsTracking) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {foundOrder.productLink && (
                <a
                  href={ensureUrlProtocol(foundOrder.productLink)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-50 p-4 rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors"
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">Product Link</p>
                  <div className="flex items-center gap-2 text-blue-600">
                    <span className="truncate text-sm font-medium">{foundOrder.productLink}</span>
                    <ExternalLink className="w-4 h-4 flex-shrink-0" />
                  </div>
                </a>
              )}
              {foundOrder.uspsTracking && (
                <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">USPS Tracking</p>
                  <p className="font-medium text-sm font-mono">{foundOrder.uspsTracking}</p>
                </div>
              )}
            </div>
          )}

          {/* Customer Info */}
          {foundOrder.customerName && (
            <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10">
              <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">Customer</p>
              <p className="font-bold text-primary">{foundOrder.customerName}</p>
              <p className="text-sm text-on-surface-variant">
                {resolveContactDisplay(
                  foundOrder.contactType,
                  foundOrder.contactValue
                )}
              </p>
            </div>
          )}

          {/* Warehouse Address */}
          <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">Warehouse</p>
            <p className="font-bold text-primary">{getWarehouseAddress(foundOrder) || "N/A"}</p>
          </div>
          <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">Nhân viên</p>
            <p className="font-bold text-primary">{foundOrder.staffName || "N/A"}</p>
          </div>

          {/* Timeline */}
          {foundOrder.timeline && foundOrder.timeline.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-on-surface-variant uppercase tracking-widest">Shipment Timeline</h4>
              <div className="relative pl-8 space-y-8 pt-4">
                <div className="absolute left-[11px] top-6 bottom-6 w-[2px] bg-outline-variant/30"></div>

                {foundOrder.timeline.map((event, i) => (
                  <div key={i} className="relative flex flex-col gap-1">
                    <div
                      className={`absolute -left-[32px] top-1 w-6 h-6 rounded-full flex items-center justify-center z-10 shadow-lg ${
                        event.completed
                          ? "bg-primary text-on-primary shadow-primary/20"
                          : "bg-surface-container-high text-outline shadow-none"
                      }`}
                    >
                      {event.completed ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-current"></div>
                      )}
                    </div>
                    <h4 className={`font-bold ${event.completed ? "text-primary" : "text-outline"}`}>
                      {event.status}
                    </h4>
                    <p className="text-xs text-on-surface-variant italic">{event.location}</p>
                    <p className="text-[10px] font-medium text-outline">{event.time}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-4">
            <Link
              to={`/order-detail/${foundOrder.id}`}
              className="w-full bg-primary text-on-primary font-bold py-4 rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
            >
              View Full Details
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>
      ) : !loading && !error && (
        <section className="bg-surface-container-low rounded-[20px] p-12 text-center space-y-6">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <Search className="w-10 h-10 text-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="font-headline text-2xl text-primary">Track Your Shipment</h3>
            <p className="text-on-surface-variant max-w-xs mx-auto">
              Enter your order code or customer name above to see the real-time status of your shipment.
            </p>
          </div>
        </section>
      )}

      <section className="relative overflow-hidden bg-primary rounded-[20px] p-8 text-on-primary">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
        <div className="relative z-10 space-y-4">
          <h3 className="font-headline text-2xl font-bold leading-tight">Need Help?</h3>
          <p className="font-body text-sm opacity-90 leading-relaxed">
            If you believe this is an error, please contact our support team with your tracking code.
          </p>
          <Link
            to="/support"
            className="inline-block w-full bg-surface text-primary text-center font-bold py-4 rounded-xl hover:bg-secondary-container transition-colors"
          >
            Contact Support
          </Link>
        </div>
      </section>

      <section className="space-y-6">
        <h3 className="font-headline text-2xl font-bold text-primary">Common Inquiries</h3>
        <div className="space-y-4">
          <div className="bg-surface-container-high/30 rounded-xl p-5 flex justify-between items-start gap-4">
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-on-surface">Where is my package exactly?</h4>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Our real-time telemetry updates every 15 minutes while the vehicle is in motion.
              </p>
            </div>
            <svg className="w-5 h-5 text-outline-variant flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <div className="bg-surface-container-high/30 rounded-xl p-5 flex justify-between items-start gap-4">
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-on-surface">How long will delivery take?</h4>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Standard international journeys typically conclude within 3-5 business days.
              </p>
            </div>
            <svg className="w-5 h-5 text-outline-variant flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
        </div>
      </section>
    </div>
  );
}
