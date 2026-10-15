import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calculator as CalcIcon, Package, Zap, Shield, ArrowRight, Info, CheckCircle2, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { formatVND, formatUSD } from "../lib/formatters";

interface QuoteBreakdown {
  baseUsd: number;
  handlingUsd: number;
  insuranceUsd: number;
  serviceUsd: number;
  totalUsd: number;
  exchangeRateVndPerUsd: number;
  totalVnd: number;
}

const CATEGORIES = [
  { id: "general", name: "Hàng thông thường", desc: "Quần áo, giày dép, đồ gia dụng, sách", rate: "0%" },
  { id: "cosmetic", name: "Mỹ phẩm & TPCN", desc: "Mỹ phẩm, son môi, thực phẩm chức năng", rate: "1.5%" },
  { id: "electronics", name: "Thiết bị điện tử", desc: "Điện thoại, laptop, đồng hồ thông minh", rate: "1.5%" },
  { id: "luxury", name: "Hàng hiệu & Giá trị cao", desc: "Túi xách cao cấp, trang sức, đồ cổ", rate: "2.5%" },
];

export default function Calculator() {
  const navigate = useNavigate();
  const [weightKg, setWeightKg] = useState<number>(1.5);
  const [rawWeight, setRawWeight] = useState<string>("1.5");
  const [serviceTier, setServiceTier] = useState<"standard" | "express">("standard");
  const [packageCategory, setPackageCategory] = useState<string>("general");
  const [loading, setLoading] = useState<boolean>(false);
  const [quote, setQuote] = useState<{ amount: number; breakdown: QuoteBreakdown } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchQuote = async () => {
      if (weightKg <= 0) {
        setQuote(null);
        return;
      }
      setLoading(true);
      try {
        const res = await api.post("/api/quotes", {
          weightKg: Math.max(0.1, weightKg),
          serviceTier,
          packageCategory,
        });
        if (!cancelled && res?.breakdown) {
          setQuote(res);
        }
      } catch {
        // Fallback calculation client-side if API is slow or offline
        if (!cancelled) {
          const w = Math.max(0.1, Math.min(2000, weightKg));
          const baseUsd = 9.5 * w;
          const handlingUsd = 3 + 1.2 * Math.min(w, 10);
          const tierMult = serviceTier === "express" ? 1.25 : 1.0;
          const serviceUsd = (baseUsd + handlingUsd) * (tierMult - 1);
          const insRate = packageCategory === "luxury" ? 0.025 : packageCategory === "cosmetic" || packageCategory === "electronics" ? 0.015 : 0;
          const insuranceUsd = baseUsd * insRate;
          const totalUsd = baseUsd + handlingUsd + serviceUsd + insuranceUsd;
          const rate = 25600;
          const totalVnd = Math.round(totalUsd * rate);
          setQuote({
            amount: totalVnd,
            breakdown: {
              baseUsd,
              handlingUsd,
              insuranceUsd,
              serviceUsd,
              totalUsd,
              exchangeRateVndPerUsd: rate,
              totalVnd,
            },
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const timer = setTimeout(fetchQuote, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [weightKg, serviceTier, packageCategory]);

  return (
    <div className="min-h-screen bg-surface py-12 md:py-20 px-4 md:px-8">
      <div className="max-w-5xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
            <CalcIcon className="w-4 h-4" />
            Bảng tính cước vận chuyển
          </div>
          <h1 className="text-3xl md:text-5xl font-headline font-bold text-primary">
            Ước tính chi phí vận chuyển
          </h1>
          <p className="text-on-surface-variant text-base md:text-lg">
            Nhập trọng lượng và phân loại hàng hóa để xem chi phí vận chuyển từ Mỹ về Việt Nam minh bạch và chính xác nhất.
          </p>
        </div>

        {/* Calculator Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Inputs Section (7 cols) */}
          <div className="lg:col-span-7 bg-white dark:bg-stone-900 border border-outline-variant/30 rounded-3xl p-6 md:p-8 shadow-sm space-y-8">
            {/* Weight Input */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  Trọng lượng kiện hàng (kg)
                </label>
                <span className="text-2xl font-headline font-bold text-primary">
                  {weightKg} kg
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="30"
                step="0.1"
                value={weightKg}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0.1;
                  setWeightKg(val);
                  setRawWeight(String(val));
                }}
                className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-[#5D4C3A]"
              />
              <div className="flex justify-between text-xs text-on-surface-variant font-medium">
                <span>0.1 kg</span>
                <span>10 kg</span>
                <span>20 kg</span>
                <span>30 kg+</span>
              </div>
              <div className="pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-on-surface-variant">Hoặc nhập chính xác:</span>
                  <input
                    type="number"
                    min="0.01"
                    max="500"
                    step="0.1"
                    value={rawWeight}
                    onChange={(e) => {
                      const text = e.target.value;
                      setRawWeight(text);
                      const parsed = parseFloat(text);
                      if (!isNaN(parsed) && parsed > 0) {
                        setWeightKg(Math.min(500, parsed));
                      }
                    }}
                    onBlur={() => {
                      if (!rawWeight || parseFloat(rawWeight) <= 0 || isNaN(parseFloat(rawWeight))) {
                        setRawWeight("0.1");
                        setWeightKg(0.1);
                      }
                    }}
                    className="w-24 px-3 py-1.5 border border-outline-variant rounded-xl text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <span className="text-sm font-semibold text-on-surface-variant">kg</span>
                </div>
              </div>
            </div>

            {/* Service Tier Selection */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-on-surface flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Gói dịch vụ vận chuyển
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setServiceTier("standard")}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    serviceTier === "standard"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                      : "border-outline-variant/30 hover:border-primary/40 bg-surface-container-low"
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-primary text-base">Tiêu chuẩn</span>
                    {serviceTier === "standard" && <CheckCircle2 className="w-4 h-4 text-primary" />}
                  </div>
                  <p className="text-xs text-on-surface-variant font-medium">7 - 10 ngày làm việc</p>
                  <p className="text-xs text-emerald-600 font-bold mt-2">Giá tiết kiệm nhất</p>
                </button>

                <button
                  type="button"
                  onClick={() => setServiceTier("express")}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    serviceTier === "express"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                      : "border-outline-variant/30 hover:border-primary/40 bg-surface-container-low"
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-primary text-base">Hỏa tốc (Express)</span>
                    {serviceTier === "express" && <CheckCircle2 className="w-4 h-4 text-primary" />}
                  </div>
                  <p className="text-xs text-on-surface-variant font-medium">3 - 5 ngày làm việc</p>
                  <p className="text-xs text-amber-700 font-bold mt-2">+25% phụ phí dịch vụ</p>
                </button>
              </div>
            </div>

            {/* Category Selection */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-on-surface flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Phân loại mặt hàng (Bảo hiểm & Phụ thu)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setPackageCategory(cat.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      packageCategory === cat.id
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-outline-variant/30 hover:border-primary/30 bg-surface-container-low"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-on-surface">{cat.name}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-stone-200 text-stone-700">
                        {cat.rate} phí BH
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1 line-clamp-1">{cat.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quote Result Summary (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#5D4C3A] text-white rounded-3xl p-6 md:p-8 shadow-xl space-y-6 relative overflow-hidden">
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <span className="text-sm uppercase tracking-wider font-semibold opacity-80">
                  Tổng cước dự tính
                </span>
                {loading && <Loader2 className="w-5 h-5 animate-spin opacity-80" />}
              </div>

              {/* Total VND */}
              <div className="space-y-1">
                <div className="text-3xl md:text-4xl font-headline font-extrabold text-amber-200">
                  {quote ? formatVND(quote.amount) : "0 đ"}
                </div>
                <p className="text-sm opacity-80 font-medium">
                  Tương đương {quote ? formatUSD(quote.breakdown.totalUsd) : "$0.00"}
                </p>
              </div>

              {/* Cost Breakdown */}
              {quote && (
                <div className="space-y-3 pt-4 border-t border-white/10 text-sm">
                  <div className="flex justify-between opacity-80">
                    <span>Cước cơ bản ({weightKg} kg):</span>
                    <span>{formatUSD(quote.breakdown.baseUsd)}</span>
                  </div>
                  <div className="flex justify-between opacity-80">
                    <span>Phí xử lý & đóng gói:</span>
                    <span>{formatUSD(quote.breakdown.handlingUsd)}</span>
                  </div>
                  {quote.breakdown.serviceUsd > 0 && (
                    <div className="flex justify-between text-amber-200">
                      <span>Phụ phí hỏa tốc (Express):</span>
                      <span>+{formatUSD(quote.breakdown.serviceUsd)}</span>
                    </div>
                  )}
                  {quote.breakdown.insuranceUsd > 0 && (
                    <div className="flex justify-between opacity-80">
                      <span>Bảo hiểm mặt hàng:</span>
                      <span>+{formatUSD(quote.breakdown.insuranceUsd)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs opacity-60 pt-2 border-t border-white/5">
                    <span>Tỷ giá áp dụng:</span>
                    <span>{quote.breakdown.exchangeRateVndPerUsd.toLocaleString("vi-VN")} đ/USD</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => navigate("/dashboard")}
                  className="w-full py-4 bg-amber-200 hover:bg-amber-100 text-[#5D4C3A] rounded-full font-bold text-base shadow-lg transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95"
                >
                  Tạo đơn hàng ngay
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/support")}
                  className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-full font-semibold text-sm transition-all text-center"
                >
                  Cần hỗ trợ tư vấn trực tiếp
                </button>
              </div>
            </div>

            {/* Policy Notes */}
            <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-5 space-y-3 text-xs text-on-surface-variant">
              <div className="flex items-center gap-2 font-bold text-primary text-sm">
                <Info className="w-4 h-4" />
                Lưu ý khi tính cước
              </div>
              <ul className="list-disc list-inside space-y-1.5 leading-relaxed">
                <li>Bảng tính cước mang tính tham khảo dựa trên cân nặng thực tế.</li>
                <li>Hàng cồng kềnh sẽ tính theo công thức thể tích: <span className="font-semibold text-primary">(Dài × Rộng × Cao cm) / 5000</span>.</li>
                <li>Đã bao gồm thủ tục thông quan và bao thuế về kho Việt Nam.</li>
                <li>Cam kết bồi thường 100% giá trị hàng hóa nếu xảy ra thất lạc do quá trình vận chuyển.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
