import { Download, Check, Truck, Gavel, Home, History, Package, Wallet, Verified, Headset, ArrowLeft, MapPin, Calendar, Weight, Tag } from "lucide-react";
import { useParams, Link } from "react-router-dom";
import { MOCK_ORDERS } from "../data/mockData";

export default function OrderDetail() {
  const { id } = useParams();
  const order = MOCK_ORDERS.find(o => o.id === id) || MOCK_ORDERS[0];

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
              order.status === 'delivered' ? "bg-green-100 text-green-800" : "bg-primary-container text-on-primary-container"
            }`}>
              <Truck className="mr-2 w-4 h-4 fill-current" />
              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </span>
            <span className="text-on-surface-variant text-sm font-medium">Estimated Delivery: {order.date}</span>
          </div>
        </div>
        <button className="flex items-center gap-2 bg-primary text-on-primary px-8 py-4 rounded-full font-bold hover:bg-primary/90 shadow-lg transition-all active:scale-95">
          <Download className="w-5 h-5" />
          Download Invoice
        </button>
      </header>

      <section className="mb-16 bg-surface-container-low rounded-[20px] p-8 md:p-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-outline">
              <MapPin className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Warehouse Address</span>
            </div>
            <p className="font-headline font-bold text-primary text-lg">{order.origin} → {order.destination}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-outline">
              <Weight className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Weight</span>
            </div>
            <p className="font-headline font-bold text-primary text-lg">{order.weight}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-outline">
              <Tag className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Category</span>
            </div>
            <p className="font-headline font-bold text-primary text-lg">{order.category}</p>
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
              {order.timeline.map((event, i) => (
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
          <div className="rounded-[20px] overflow-hidden shadow-sm h-64 grayscale contrast-125 opacity-80">
            <img
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAcR7bjjt5K9jYatxVBxsY3AfYQrW3aFecCIhGHKcM78M5RJM-ZGoeD_0Sa9EbC0NX4Si8U6ML3GNyuPTgQVpN0vYqOZqgQ8pREUA70Cra3etpujAJR9ezLmqkbHGENfK1gB40fzjCFZtgXtFbpm0bW52_LMY4yH1pXss-fXLOmj8DkskZwkw8Z1PbI1XdbeD3uYR46iw727LkW0FaGntgJdhGMrY76b-F7hW27b8QsvpgsNT9m1sedorHVWJYZFwv8poO4823iKQ"
              alt="Map Location"
              referrerPolicy="no-referrer"
            />
          </div>
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
                  <p className="text-on-surface font-medium">{order.category} Items</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Nhân viên</p>
                <p className="text-on-surface font-medium">N/A</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Weight</p>
                  <p className="text-on-surface font-medium">{order.weight}</p>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Status</p>
                  <p className="text-on-surface font-medium capitalize">{order.status}</p>
                </div>
              </div>
              <div className="pt-6 border-t border-outline-variant/20">
                <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider mb-2">Declared Value</p>
                <p className="text-2xl font-headline text-primary">{order.price} USD</p>
              </div>
            </div>
          </div>

          <div className="bg-primary text-on-primary rounded-[20px] p-8 shadow-xl">
            <h3 className="text-2xl font-headline mb-6">Billing Summary</h3>
            <div className="space-y-4">
              <div className="flex justify-between text-sm opacity-80">
                <span>Shipping Fees</span>
                <span>$38.50</span>
              </div>
              <div className="flex justify-between text-sm opacity-80">
                <span>Insurance (Premium)</span>
                <span>$5.18</span>
              </div>
              <div className="pt-4 border-t border-on-primary/20 flex justify-between items-end">
                <span className="font-bold">Total Paid</span>
                <span className="text-3xl font-headline">{order.price}</span>
              </div>
              <div className="pt-4 flex items-center gap-2 text-xs opacity-70">
                <Verified className="w-4 h-4 fill-current" />
                <span>Payment confirmed via Corporate Account</span>
              </div>
            </div>
          </div>

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
