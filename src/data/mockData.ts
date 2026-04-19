export type OrderStatus = "pending" | "shipping" | "delivered";

export interface TimelineEvent {
  status: string;
  location: string;
  time: string;
  description: string;
  completed: boolean;
}

export interface Order {
  id: string;
  status: OrderStatus;
  date: string;
  origin: string;
  destination: string;
  weight: string;
  price: string;
  category: string;
  timeline: TimelineEvent[];
}

export const MOCK_ORDERS: Order[] = [
  {
    id: "MN-88291",
    status: "shipping",
    date: "Mar 22, 2026",
    origin: "Paris, FR",
    destination: "Ho Chi Minh, VN",
    weight: "2.4 kg",
    price: "$43.68",
    category: "Antiques",
    timeline: [
      { status: "Order Placed", location: "Paris Atelier", time: "Mar 20, 10:30 AM", description: "Package received and verified at origin hub.", completed: true },
      { status: "Customs Cleared", location: "CDG Airport", time: "Mar 21, 02:15 PM", description: "Export documentation approved.", completed: true },
      { status: "In Transit", location: "International Air", time: "Mar 22, 08:00 AM", description: "Departed from Paris hub.", completed: true },
      { status: "Arrived at Destination", location: "Tan Son Nhat", time: "Pending", description: "Awaiting local customs clearance.", completed: false },
      { status: "Delivered", location: "Final Destination", time: "Pending", description: "Handover to recipient.", completed: false },
    ]
  },
  {
    id: "MN-88292",
    status: "delivered",
    date: "Mar 18, 2026",
    origin: "Seoul, KR",
    destination: "Hanoi, VN",
    weight: "1.2 kg",
    price: "$21.84",
    category: "Electronics",
    timeline: [
      { status: "Order Placed", location: "Seoul Hub", time: "Mar 15, 09:00 AM", description: "Package received.", completed: true },
      { status: "Customs Cleared", location: "Incheon", time: "Mar 16, 11:00 AM", description: "Cleared for export.", completed: true },
      { status: "In Transit", location: "Air Freight", time: "Mar 17, 04:00 PM", description: "Arrived in Hanoi.", completed: true },
      { status: "Delivered", location: "Hanoi Office", time: "Mar 18, 10:30 AM", description: "Successfully delivered.", completed: true },
    ]
  },
  {
    id: "MN-88293",
    status: "pending",
    date: "Mar 24, 2026",
    origin: "Tokyo, JP",
    destination: "Da Nang, VN",
    weight: "5.0 kg",
    price: "$91.00",
    category: "Fragile",
    timeline: [
      { status: "Order Placed", location: "Tokyo Hub", time: "Mar 24, 08:00 AM", description: "Package scheduled for pickup.", completed: true },
      { status: "Awaiting Pickup", location: "Tokyo Hub", time: "Pending", description: "Courier assigned.", completed: false },
    ]
  }
];
