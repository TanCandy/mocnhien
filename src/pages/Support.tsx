import { Search, MessageCircle, Phone, Mail, ChevronRight, HelpCircle, Package, CreditCard, ShieldCheck } from "lucide-react";

export default function Support() {
  const categories = [
    { title: "Shipping & Tracking", icon: Package, count: 24 },
    { title: "Payments & Billing", icon: CreditCard, count: 12 },
    { title: "Customs & Duties", icon: ShieldCheck, count: 18 },
    { title: "General Inquiries", icon: HelpCircle, count: 32 },
  ];

  const articles = [
    "How do I track my international shipment?",
    "What items are prohibited for shipping to Vietnam?",
    "Understanding customs declaration fees",
    "How to file an insurance claim for damaged goods",
    "Updating your delivery address after dispatch",
  ];

  return (
    <div className="max-w-7xl mx-auto px-8 pb-24">
      <section className="bg-primary text-on-primary rounded-[40px] p-16 text-center space-y-8 relative overflow-hidden mb-16">
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 space-y-4">
          <h1 className="text-5xl font-headline">How can we help you?</h1>
          <p className="text-on-primary/80 max-w-xl mx-auto">
            Search our knowledge base or reach out to our dedicated support team for personalized assistance.
          </p>
        </div>

        <div className="relative max-w-2xl mx-auto z-10">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-primary w-6 h-6" />
          <input
            className="w-full bg-white text-on-surface rounded-full py-5 pl-16 pr-8 text-lg shadow-2xl focus:ring-4 focus:ring-white/20 transition-all"
            placeholder="Search for articles, topics..."
            type="text"
          />
        </div>
      </section>

      <div className="grid lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-12">
          <section>
            <h2 className="text-3xl font-headline text-primary mb-8">Browse by Category</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {categories.map((cat, i) => (
                <div key={i} className="bg-surface-container-low p-8 rounded-[32px] hover:bg-primary hover:text-on-primary transition-all duration-300 group cursor-pointer">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 group-hover:bg-white/20 flex items-center justify-center mb-6 transition-colors">
                    <cat.icon className="w-6 h-6 text-primary group-hover:text-on-primary" />
                  </div>
                  <h3 className="text-xl font-headline mb-1">{cat.title}</h3>
                  <p className="text-sm opacity-60">{cat.count} articles</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-3xl font-headline text-primary mb-8">Popular Articles</h2>
            <div className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 divide-y divide-outline-variant/10 overflow-hidden">
              {articles.map((art, i) => (
                <div key={i} className="flex justify-between items-center p-6 hover:bg-surface-container-low transition-colors cursor-pointer group">
                  <span className="font-medium text-on-surface group-hover:text-primary transition-colors">{art}</span>
                  <ChevronRight className="w-5 h-5 text-outline group-hover:text-primary" />
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-8">
          <div className="bg-surface-container-high rounded-[32px] p-8 space-y-8">
            <h3 className="text-2xl font-headline text-primary">Direct Contact</h3>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageCircle className="text-primary w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-outline">Live Chat</p>
                  <p className="font-medium">Average wait: 2 mins</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Phone className="text-primary w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-outline">Phone Support</p>
                  <p className="font-medium">0328 701 226</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="text-primary w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-outline">Email Us</p>
                  <p className="font-medium">support@mocnhien.com</p>
                </div>
              </div>
            </div>
            <button className="w-full bg-primary text-on-primary py-4 rounded-full font-bold hover:bg-primary/90 transition-all">
              Start a Conversation
            </button>
          </div>

          <div className="relative rounded-[32px] overflow-hidden">
            <img
              className="w-full h-64 object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuB0UI9BNxxXrIsC3Kl2QWN5qod1DvhTQRa0ApGBMSfuAz0BrhJZjokwKrImEAYWEYoa1HAhNK1zWPJVqghKFsygokSO66WekRTtHB0Msgh0eGlzGz6DGCiAMxuHVlOM_1N5NAuzWFzC4RKcVhuthexR8KUoszcH6da5sIJMyfQJ9g7UfgdRFcJML3MJ4gQDtMiu1wwHPbFOiy7HogwIBIdZbJG7PVZq6QCO4qEvpGUwtDiYC74QCD0qNLNrtJG8E630gS9k9N_G8g"
              alt="Support Team"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-primary/40 backdrop-blur-[2px] flex items-center justify-center p-8 text-center">
              <p className="text-on-primary font-headline text-xl italic">"Excellence in logistics is built on the foundation of trust and communication."</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
