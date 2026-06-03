import { useState } from "react";
import { Check, Copy, X, Maximize2 } from "lucide-react";

interface PaymentQRProps {
  orderCode: string;
  amount?: number;
  status?: string;
  qrImagePath?: string;
}

export default function PaymentQR({ orderCode, amount, status, qrImagePath = "/QR/vietqr-msb.jpg" }: PaymentQRProps) {
  const [copied, setCopied] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);

  // Hide payment info when order is delivered
  const isDelivered = status === "delivered";

  // Bank information
  const bankName = "Maritime Bank (MSB)";
  const accountName = "LE THI DIEU";
  const accountNumber = "80002725995";
  const paymentContent = `CK ${orderCode}`;

  // Format amount to VND
  const formatVND = (value?: number) => {
    if (!value) return null;
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300 overflow-hidden max-w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 px-4 md:px-6 py-3 md:py-4">
          <h3 className="font-headline text-white text-base md:text-lg font-bold flex items-center justify-center gap-2">
            <svg className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm8-2h8v8h-8v-8zm2 2v4h4v-4h-4z"/>
            </svg>
            <span className="text-center">{isDelivered ? "Đơn Hàng Đã Giao" : "Thanh Toán Qua Ngân Hàng"}</span>
          </h3>
        </div>

        {/* Main Content - QR + Bank Info */}
        {isDelivered ? (
          /* Delivered State - Show confirmation */
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-700 font-medium text-center mb-2">Đơn hàng đã được giao thành công!</p>
            <p className="text-gray-500 text-sm text-center">Cảm ơn bạn đã sử dụng dịch vụ</p>
          </div>
        ) : (
          /* Payment State - Show QR and transfer info */
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 p-4 md:p-8">
            {/* QR Code Section - CENTERED */}
            <div className="flex flex-col items-center space-y-3 w-full md:w-auto">
              <p className="text-xs md:text-sm font-medium text-gray-500">Quét mã để thanh toán</p>
              <div
                className="relative w-[200px] h-[200px] md:w-[280px] md:h-[280px] bg-white rounded-2xl overflow-visible shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer group border border-gray-200"
                onClick={() => setShowLightbox(true)}
              >
                <img
                  src={qrImagePath}
                  alt="QR Code - Maritime Bank"
                  className="w-full h-full object-contain p-3 md:p-4 transition-transform duration-300 group-hover:scale-[1.02]"
                  loading="lazy"
                />
                {/* Hover overlay with zoom icon */}
                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center rounded-2xl">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/95 flex items-center justify-center shadow-lg">
                    <Maximize2 className="w-5 h-5 md:w-6 md:h-6 text-gray-700" />
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400 text-center">Click để phóng to</p>
            </div>

            {/* Bank Info Section */}
            <div className="w-full md:max-w-md space-y-3">
              {/* Amount Display */}
              {amount && (
                <div className="w-full bg-blue-50 rounded-xl p-3 md:p-4 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-blue-600 font-medium">Số tiền cần thanh toán</span>
                    <span className="font-bold text-lg md:text-xl text-blue-700">
                      {formatVND(amount)}
                    </span>
                  </div>
                </div>
              )}

              {/* Payment Content */}
              <div className="w-full bg-gray-50 rounded-xl p-3 md:p-4 border border-gray-200">
                <div className="flex flex-col space-y-2 md:space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 font-normal mb-1">Nội dung chuyển khoản</p>
                    <div className="flex items-center justify-between gap-2 md:gap-3">
                      <div className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
                        {paymentContent.split(" ").map((part, index) => (
                          <span
                            key={index}
                            className="font-mono text-base md:text-lg font-semibold text-gray-900 tracking-wide whitespace-nowrap"
                          >
                            {part}
                          </span>
                        ))}
                      </div>
                      <button
                      onClick={() => handleCopy(paymentContent)}
                      className={`flex-shrink-0 inline-flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all duration-200 ${
                        copied
                          ? "bg-green-600 text-white shadow-md"
                          : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                      }`}
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 md:w-4 md:h-4" />
                          <span className="hidden sm:inline">Đã sao chép</span>
                          <span className="sm:hidden">Xong</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 md:w-4 md:h-4" />
                          <span className="hidden sm:inline">Sao chép</span>
                          <span className="sm:hidden">Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bank Details */}
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-xs text-gray-500 font-normal">Ngân hàng</span>
                <span className="text-sm font-medium text-gray-900 text-right">{bankName}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-xs text-gray-500 font-normal">Tên tài khoản</span>
                <span className="text-sm font-medium text-gray-900 text-right">{accountName}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-gray-500 font-normal">Số tài khoản</span>
                <span className="text-sm font-mono font-medium text-gray-900 text-right">{accountNumber}</span>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* QR Lightbox Modal */}
      {showLightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 md:p-4"
          onClick={() => setShowLightbox(false)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowLightbox(false);
            }}
            className="absolute top-2 md:top-4 right-2 md:right-4 w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="Đóng"
          >
            <X className="w-4 h-4 md:w-6 md:h-6 text-white" />
          </button>
          <div className="max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={qrImagePath}
              alt="QR Code - Maritime Bank (Phóng to)"
              className="w-full h-auto rounded-lg shadow-2xl"
            />
            <p className="text-white text-center mt-4 text-xs md:text-sm opacity-80">
              Maritime Bank - {accountName} - {accountNumber}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
