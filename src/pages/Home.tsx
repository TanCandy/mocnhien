import { CheckCircle, Clock, ArrowRight, Star, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

// Static paths for public folder images (served at root)
const teamImages = [
  "/photo_contact/new_member.jpg",
  "/photo_contact/528577866_122112464858945866_4566905921550425821_n.jpg",
  "/photo_contact/606285868_122149913474945866_8619557916705338608_n.jpg",
];

// Zalo contact numbers — one per team member, parallel to teamImages
const zaloNumbers = [
  "0942946800",
  "0392811031",
  "0918170661",
];

// Promotional order images from history_order folder
const historyOrderImages = [
  "/history_order/672042617_122168526614945866_4072487562837214817_n.jpg",
  "/history_order/672672687_944691634847562_8209665190366024357_n.jpg",
  "/history_order/672678945_1509193220779541_6256201210404622994_n.jpg",
  "/history_order/672685941_122168526482945866_7333684173994690273_n.jpg",
  "/history_order/673865385_2358288697997506_8322815519605626810_n.jpg",
  "/history_order/674324301_2013316550065560_5598735352325989997_n.jpg",
  "/history_order/676374972_1439141914038670_4459127453187640500_n.jpg",
];

export default function Home() {
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Use static paths for team images from public folder
  const photoContactList = teamImages;

  return (
    <div className="min-h-screen overflow-hidden max-w-full">
      {/* =========================================== */}
      {/* HERO SECTION */}
      {/* =========================================== */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#F5ECD9] via-[#FDF8F3] to-[#EFEBE0]">
        {/* Decorative background */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-10 w-72 h-72 bg-[#8B7355] rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#A0896C] rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 md:px-8 lg:px-16 py-12 md:py-20 lg:py-32">
          {/* Main Content */}
          <div className="text-center max-w-4xl mx-auto space-y-8">
            {/* Logo / Brand Name */}
            <div className="inline-block">
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-serif font-bold text-[#5D4C3A] tracking-tight text-center">
                Mộc Nhiên
                <span className="block text-lg md:text-2xl lg:text-3xl font-sans font-medium text-[#8B7355] mt-1">
                  Authentic
                </span>
              </h1>
            </div>

            {/* Subtitle */}
            <div className="space-y-4">
              <p className="text-base md:text-xl lg:text-2xl font-semibold text-[#6B5744] text-center">
                Mua hộ & vận chuyển Mỹ - Nhật - Anh - Úc - Hàn
              </p>

              {/* Marketing Text */}
              <div className="space-y-3 text-sm md:text-base lg:text-lg text-[#6B5744]/80 leading-relaxed max-w-2xl mx-auto">
                <p>
                  Chúng tôi mang thế giới đến gần bạn hơn — từ những thương hiệu quốc tế
                  đến tận tay khách hàng Việt Nam.
                </p>
                <p className="font-medium text-[#5D4C3A]">
                  Cam kết hàng chính hãng 100%, minh bạch, nhanh chóng và an toàn.
                </p>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
              <button
                onClick={() => navigate("/dashboard")}
                className="w-full sm:w-auto px-10 py-4 bg-[#5D4C3A] text-white rounded-full font-bold text-lg shadow-xl shadow-[#5D4C3A]/30 hover:bg-[#4A3C2E] transition-all hover:scale-105 active:scale-95"
              >
                Create Order Now
              </button>
              <a
                href="https://www.facebook.com/profile.php?id=61578376000625"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-10 py-4 bg-white text-[#5D4C3A] border-2 border-[#5D4C3A] rounded-full font-bold text-lg hover:bg-[#FDF8F3] transition-all text-center"
              >
                Contact Now
              </a>
            </div>
          </div>

          {/* Brand Logos Grid */}
          <div className="mt-20 max-w-5xl mx-auto">
            <p className="text-center text-sm font-semibold text-[#8B7355] uppercase tracking-widest mb-8">
              Trusted by global brands
            </p>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-6 items-center opacity-60">
              {["Target", "Walmart", "eBay", "Amazon", "Gucci", "Adidas"].map((brand) => (
                <div key={brand} className="flex items-center justify-center h-16 grayscale">
                  <span className="text-2xl font-serif font-bold text-[#8B7355]">{brand}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================== */}
      {/* ABOUT / BRAND STORY SECTION */}
      {/* =========================================== */}
      <section className="py-12 md:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 md:px-8 lg:px-16">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-[#5D4C3A]">
              Vì sao chọn Mộc Nhiên?
            </h2>

            <div className="space-y-5 text-lg text-[#4A4A4A] leading-relaxed">
              <p>
                <span className="font-semibold text-[#5D4C3A]">Mộc Nhiên Authentic</span>{" "}
                không chỉ là dịch vụ mua hộ — chúng tôi là cầu nối giúp bạn tiếp cận
                hàng chính hãng từ Mỹ, Nhật, Anh và Úc một cách dễ dàng.
              </p>
              <p>
                Với kinh nghiệm xử lý hàng trăm đơn mỗi tháng, chúng tôi đảm bảo quy trình
                rõ ràng, minh bạch và tối ưu chi phí cho khách hàng.
              </p>
            </div>

            {/* Feature highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
              <div className="p-6 rounded-2xl bg-[#FDF8F3] border border-[#EFEBE0]">
                <div className="w-12 h-12 rounded-full bg-[#5D4C3A] flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-serif font-bold text-[#5D4C3A] mb-2">100% Authentic</h4>
                <p className="text-sm text-[#6B5744]">Cam kết hàng chính hãng từ các thương hiệu uy tín</p>
              </div>

              <div className="p-6 rounded-2xl bg-[#FDF8F3] border border-[#EFEBE0]">
                <div className="w-12 h-12 rounded-full bg-[#5D4C3A] flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-serif font-bold text-[#5D4C3A] mb-2">Fast Delivery</h4>
                <p className="text-sm text-[#6B5744]">Vận chuyển nhanh chóng, chỉ 2–3 tuần</p>
              </div>

              <div className="p-6 rounded-2xl bg-[#FDF8F3] border border-[#EFEBE0]">
                <div className="w-12 h-12 rounded-full bg-[#5D4C3A] flex items-center justify-center mx-auto mb-4">
                  <Star className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-serif font-bold text-[#5D4C3A] mb-2">Premium Service</h4>
                <p className="text-sm text-[#6B5744]">Hỗ trợ tư vấn tận tâm 24/7</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================== */}
      {/* SERVICES SECTION */}
      {/* =========================================== */}
      <section className="py-12 md:py-20 bg-[#FDF8F3]">
        <div className="max-w-6xl mx-auto px-4 md:px-8 lg:px-16">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-[#5D4C3A] mb-4">
              Dịch vụ của chúng tôi
            </h2>
            <p className="text-lg text-[#8B7355] italic">
              "Chỉ cần gửi link — chúng tôi lo tất cả."
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: "✓",
                title: "Hàng Mỹ chuẩn auth 100%",
                desc: "Tất cả sản phẩm đều được mua trực tiếp từ các thương hiệu chính hãng",
              },
              {
                icon: "📦",
                title: "Check bill, tracking đầy đủ",
                desc: "Có đầy đủ hóa đơn, mã vận đơn và bảo hành từ nhà sản xuất",
              },
              {
                icon: "🛒",
                title: "Nhận mua hộ từ Amazon, Sephora, Ulta...",
                desc: "Hỗ trợ mua từ mọi website uy tín tại Mỹ, Nhật, Anh, Úc",
              },
              {
                icon: "🚀",
                title: "Vận chuyển nhanh chóng (2–3 tuần)",
                desc: "Giao hàng tận tay bạn trong vòng 14–21 ngày",
              },
              {
                icon: "💬",
                title: "Hỗ trợ tư vấn sản phẩm tận tâm",
                desc: "Đội ngũ tư vấn luôn sẵn sàng hỗ trợ 24/7",
              },
              {
                icon: "🔒",
                title: "Bảo mật thông tin",
                desc: "Thông tin cá nhân và đơn hàng được bảo mật tuyệt đối",
              },
            ].map((service, idx) => (
              <div
                key={idx}
                className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-[#EFEBE0]"
              >
                <div className="text-4xl mb-4">{service.icon}</div>
                <h3 className="font-serif font-bold text-xl text-[#5D4C3A] mb-3">
                  {service.title}
                </h3>
                <p className="text-[#6B5744] leading-relaxed">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================== */}
      {/* ORDER GALLERY SECTION */}
      {/* =========================================== */}
      <section className="py-12 md:py-20 bg-[#F5ECD9]">
        <div className="max-w-6xl mx-auto px-4 md:px-8 lg:px-16">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-[#5D4C3A] mb-4">
              Đơn hàng đã giao thành công
            </h2>
            <p className="text-lg text-[#6B5744]">
              Hình ảnh thực tế từ khách hàng
            </p>
          </div>

          {/* Order Screenshots Gallery */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {historyOrderImages.map((src, idx) => (
              <div
                key={idx}
                className="group relative aspect-square bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-[#EFEBE0] cursor-pointer"
                onClick={() => setSelectedImage(src)}
              >
                <img
                  src={src}
                  alt={`Đơn hàng thành công ${idx + 1}`}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300"></div>
                {/* Zoom icon on hover */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-[#5D4C3A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Lightbox Modal */}
          {selectedImage && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-fade-in"
              onClick={() => setSelectedImage(null)}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImage(null);
                }}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                aria-label="Close lightbox"
              >
                <X className="w-6 h-6 text-white" />
              </button>
              <img
                src={selectedImage}
                alt="Enlarged order screenshot"
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </div>
      </section>

      {/* =========================================== */}
      {/* SUPPORT / TEAM SECTION */}
      {/* =========================================== */}
      <section className="py-12 md:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 md:px-8 lg:px-16">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-[#5D4C3A] mb-4">
              Đội ngũ hỗ trợ của chúng tôi
            </h2>
            <p className="text-lg text-[#6B5744]">
              Những thành viên tận tâm luôn sẵn sàng hỗ trợ bạn 24/7
            </p>
          </div>

          {/* Team Member Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {photoContactList.map((src: string, idx: number) => {
              // Extract name from filename: remove extension and numbers/underscores
              const fileName = src.split('/').pop()?.split('.')[0] || '';
              // Try to extract a readable name, fallback to "Team Member"
              const displayName = fileName
                ? `Team Member ${idx + 1}`
                : `Mộc Nhiên Team ${idx + 1}`;

              return (
                <div
                  key={idx}
                  className="group bg-[#FDF8F3] rounded-2xl overflow-hidden border border-[#EFEBE0] shadow-md hover:shadow-xl transition-all duration-500 hover:-translate-y-2 opacity-0 animate-fade-in-up"
                  style={{ animationDelay: `${idx * 100}ms`, animationFillMode: 'forwards' }}
                >
                  {/* Profile Image */}
                  <div className="aspect-square overflow-hidden bg-[#EFEBE0]">
                    <img
                      src={src}
                      alt={`Team member ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      onError={(e) => {
                        e.currentTarget.src = "/fallback-avatar.png";
                      }}
                    />
                  </div>

                  {/* Card Content */}
                  <div className="p-6 text-center">
                    <h3 className="font-serif font-bold text-xl text-[#5D4C3A] mb-1">
                      {displayName}
                    </h3>
                    <p className="text-sm font-semibold text-[#8B7355] mb-4">
                      Order & Shipping Consultant
                    </p>

                    {/* Contact Info */}
                    <div className="space-y-2 text-sm text-[#6B5744]">
                      <p className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                        </svg>
                        Facebook: Mộc Nhiên Official
                      </p>
                      <p className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.05-.2-.06-.06-.14-.04-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                        </svg>
                        Zalo: {zaloNumbers[idx]}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================== */}
      {/* TIKTOK SECTION */}
      {/* =========================================== */}
      <section className="py-10 md:py-16 bg-gradient-to-r from-[#FDF8F3] to-[#F5ECD9]">
        <div className="max-w-4xl mx-auto px-4 md:px-8 lg:px-16 text-center">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-serif font-bold text-[#5D4C3A] mb-4 md:mb-6">
            Theo dõi chúng tôi trên TikTok
          </h2>
          <p className="text-base md:text-lg text-[#6B5744] mb-6 md:mb-8">
            Xem video về sản phẩm, quy trình mua hộ và những cập nhật mới nhất
          </p>
          <a
            href="https://www.tiktok.com/@mc.nhin.authentic"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 md:gap-3 px-6 md:px-8 py-3 md:py-4 bg-[#FE2C55] text-white rounded-full font-bold text-base md:text-lg shadow-lg hover:bg-[#E01E45] transition-all hover:scale-105 active:scale-95"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.49 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
            </svg>
            Follow on TikTok
          </a>
        </div>
      </section>

      {/* =========================================== */}
      {/* CALL TO ACTION (CTA) SECTION */}
      {/* =========================================== */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-[#5D4C3A] to-[#3D2E22] text-white">
        <div className="max-w-4xl mx-auto px-4 md:px-8 lg:px-16 text-center">
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-serif font-bold mb-4 md:mb-6 leading-tight">
            You just choose the product - we'll take care of the rest.
          </h2>

          <p className="text-base md:text-xl text-[#FDF8F3]/80 mb-8 md:mb-10 max-w-2xl mx-auto">
            Comment "MUA HỘ" hoặc liên hệ ngay để được tư vấn nhanh nhất!
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full sm:w-auto px-6 md:px-12 py-3 md:py-5 bg-white text-[#5D4C3A] rounded-full font-bold text-base md:text-lg shadow-2xl hover:bg-[#FDF8F3] transition-all hover:scale-105 active:scale-95"
            >
              Create Order Now
            </button>
            <a
              href="https://www.facebook.com/profile.php?id=61578376000625"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-6 md:px-12 py-3 md:py-5 border-2 border-white rounded-full font-bold text-base md:text-lg hover:bg-white/10 transition-all text-center"
            >
              Contact Now
            </a>
          </div>

          {/* Trust indicators */}
          <div className="mt-10 md:mt-16 flex flex-wrap items-center justify-center gap-4 md:gap-8 text-xs md:text-sm text-[#FDF8F3]/70">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
              <span>100% Authentic Guarantee</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 md:w-5 md:h-5" />
              <span>24/7 Support</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 md:w-5 md:h-5" />
              <span>500+ Happy Customers</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
