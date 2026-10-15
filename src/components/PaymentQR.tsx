import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, X, Maximize2, Loader2, RefreshCw } from "lucide-react";
import { api } from "../lib/api";

type PaymentState = "due" | "partial" | "paid" | "no_price";

interface PaymentInfo {
  orderId: string;
  orderCode: string;
  state: PaymentState;
  status: string;
  totalVND: number;
  paidAmount: number;
  remainingAmount: number;
  paymentPercent: number;
  transferContent: string;
  bank: { bin: string; bankName: string; accountNumber: string; accountName: string };
  qr: { payload: string; amount: number; dataUrl: string } | null;
  autoConfirm: boolean;
}

interface PaymentQRProps {
  /** Mongo _id or order code */
  orderId: string;
  /** Called once when the server reports the order as fully paid. */
  onPaid?: () => void;
}

const POLL_MS = 15000;

const formatVND = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", minimumFractionDigits: 0 }).format(value);

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Sao chép ${label}`}
      className={`flex-shrink-0 inline-flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all duration-200 ${
        copied
          ? "bg-green-600 text-white shadow-md"
          : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400"
      }`}
    >
      {copied ? <Check className="w-3 h-3 md:w-4 md:h-4" /> : <Copy className="w-3 h-3 md:w-4 md:h-4" />}
      <span className="hidden sm:inline">{copied ? "Đã sao chép" : "Sao chép"}</span>
    </button>
  );
}

export default function PaymentQR({ orderId, onPaid }: PaymentQRProps) {
  const [info, setInfo] = useState<PaymentInfo | null>(null);
  const [error, setError] = useState("");
  const [showLightbox, setShowLightbox] = useState(false);

  const load = useCallback(async () => {
    try {
      const data: PaymentInfo = await api.get(`/api/payments/orders/${encodeURIComponent(orderId)}`);
      setInfo(data);
      setError("");
    } catch (err: any) {
      setError(err.message || "Không tải được thông tin thanh toán");
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  // While money is still owed, poll so the card flips to "paid" as soon as
  // the bank webhook credits the transfer.
  const awaiting = info ? info.state !== "paid" && info.autoConfirm : false;
  useEffect(() => {
    if (!awaiting) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [awaiting, load]);

  const onPaidRef = useRef(onPaid);
  useEffect(() => {
    onPaidRef.current = onPaid;
  }, [onPaid]);

  const hasNotifiedPaid = useRef(false);
  const isPaid = info?.state === "paid";
  useEffect(() => {
    if (isPaid && !hasNotifiedPaid.current) {
      hasNotifiedPaid.current = true;
      onPaidRef.current?.();
    }
  }, [isPaid]);

  const header = isPaid ? "Đã Thanh Toán" : "Thanh Toán Qua Ngân Hàng";

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300 overflow-hidden max-w-full">
        <div className={`px-4 md:px-6 py-3 md:py-4 ${isPaid ? "bg-gradient-to-r from-green-500 to-green-600" : "bg-gradient-to-r from-yellow-400 to-yellow-500"}`}>
          <h3 className="font-headline text-white text-base md:text-lg font-bold flex items-center justify-center gap-2">
            <span className="text-center">{header}</span>
            {info?.orderCode && <span className="font-mono text-sm opacity-90">· {info.orderCode}</span>}
          </h3>
        </div>

        {!info && !error && (
          <div className="flex items-center justify-center py-12 text-gray-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Đang tải thông tin thanh toán…
          </div>
        )}

        {!info && error && (
          <div className="flex flex-col items-center justify-center py-10 px-6 gap-3">
            <p className="text-sm text-red-600 text-center">{error}</p>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4" /> Thử lại
            </button>
          </div>
        )}

        {info && isPaid && (
          <div className="flex flex-col items-center justify-center py-10 px-6">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-gray-700 font-medium text-center mb-1">Đơn hàng đã được thanh toán đủ.</p>
            {info.totalVND > 0 && (
              <p className="text-gray-500 text-sm text-center">Tổng: {formatVND(info.totalVND)}</p>
            )}
          </div>
        )}

        {info && !isPaid && (
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 p-4 md:p-8">
            {info.qr && (
              <div className="flex flex-col items-center space-y-3 w-full md:w-auto">
                <p className="text-xs md:text-sm font-medium text-gray-500">Quét mã bằng app ngân hàng</p>
                <button
                  type="button"
                  className="relative w-[200px] h-[200px] md:w-[260px] md:h-[260px] bg-white rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer group border border-gray-200"
                  onClick={() => setShowLightbox(true)}
                  aria-label="Phóng to mã QR"
                >
                  <img src={info.qr.dataUrl} alt={`VietQR ${info.orderCode}`} className="w-full h-full object-contain p-3" />
                  <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center rounded-2xl">
                    <div className="w-10 h-10 rounded-full bg-white/95 flex items-center justify-center shadow-lg">
                      <Maximize2 className="w-5 h-5 text-gray-700" />
                    </div>
                  </div>
                </button>
                <p className="text-xs text-gray-400 text-center max-w-[260px]">
                  {info.qr.amount > 0
                    ? "Mã QR đã điền sẵn số tiền và nội dung."
                    : "Mã QR đã điền sẵn nội dung — nhập số tiền theo báo giá."}
                </p>
              </div>
            )}

            <div className="w-full md:max-w-md space-y-3">
              {info.state === "no_price" ? (
                <div className="w-full bg-amber-50 rounded-xl p-3 md:p-4 border border-amber-200 text-sm text-amber-800">
                  Đơn hàng chưa có giá. Vui lòng chờ nhân viên báo giá hoặc chuyển khoản theo số tiền đã thống nhất.
                </div>
              ) : (
                <div className="w-full bg-blue-50 rounded-xl p-3 md:p-4 border border-blue-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-blue-600 font-medium">
                      {info.state === "partial" ? "Số tiền còn lại" : "Số tiền cần thanh toán"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg md:text-xl text-blue-700">{formatVND(info.remainingAmount)}</span>
                      <CopyButton text={String(info.remainingAmount)} label="số tiền" />
                    </div>
                  </div>
                  {info.state === "partial" && (
                    <>
                      <div className="h-2 rounded-full bg-blue-100 overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${info.paymentPercent}%` }} />
                      </div>
                      <p className="text-xs text-blue-700">
                        Đã nhận {formatVND(info.paidAmount)} / {formatVND(info.totalVND)} ({info.paymentPercent}%)
                      </p>
                    </>
                  )}
                </div>
              )}

              <div className="w-full bg-gray-50 rounded-xl p-3 md:p-4 border border-gray-200">
                <p className="text-xs text-gray-500 font-normal mb-1">Nội dung chuyển khoản (bắt buộc)</p>
                <div className="flex items-center justify-between gap-2 md:gap-3">
                  <span className="font-mono text-base md:text-lg font-semibold text-gray-900 tracking-wide break-all">
                    {info.transferContent}
                  </span>
                  <CopyButton text={info.transferContent} label="nội dung" />
                </div>
              </div>

              <div className="w-full space-y-2">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500 font-normal">Ngân hàng</span>
                  <span className="text-sm font-medium text-gray-900 text-right">{info.bank.bankName}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500 font-normal">Tên tài khoản</span>
                  <span className="text-sm font-medium text-gray-900 text-right">{info.bank.accountName}</span>
                </div>
                <div className="flex items-center justify-between gap-2 py-2">
                  <span className="text-xs text-gray-500 font-normal">Số tài khoản</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-medium text-gray-900 text-right">{info.bank.accountNumber}</span>
                    <CopyButton text={info.bank.accountNumber} label="số tài khoản" />
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                {info.autoConfirm
                  ? "Hệ thống tự động xác nhận sau khi nhận được tiền (thường trong vòng 1 phút). Có thể chuyển nhiều lần."
                  : "Nhân viên sẽ xác nhận thanh toán sau khi kiểm tra tài khoản."}
              </p>
            </div>
          </div>
        )}
      </div>

      {showLightbox && info?.qr && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 md:p-4"
          onClick={() => setShowLightbox(false)}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowLightbox(false);
            }}
            className="absolute top-2 md:top-4 right-2 md:right-4 w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="Đóng"
          >
            <X className="w-4 h-4 md:w-6 md:h-6 text-white" />
          </button>
          <div className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <img src={info.qr.dataUrl} alt={`VietQR ${info.orderCode} (phóng to)`} className="w-full h-auto rounded-lg shadow-2xl bg-white p-4" />
            <p className="text-white text-center mt-4 text-xs md:text-sm opacity-80">
              {info.bank.bankName} - {info.bank.accountName} - {info.bank.accountNumber}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
