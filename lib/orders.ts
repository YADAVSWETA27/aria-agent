type Order = {
  customer: string;
  product: string;
  value: number;
  status: "Out for Delivery" | "Delivered" | "Processing";
  carrier?: string;
  tracking?: string;
  deliveredDaysAgo?: number;
  note?: string;
};

export const ORDERS: Record<string, Order> = {
  "ORD-101": {
    customer: "Priya Sharma",
    product: "Vitamin C Serum (30ml)",
    value: 699,
    status: "Out for Delivery",
    carrier: "BlueDart",
    tracking: "BD-982103",
    note: "Expected by 6 PM today",
  },
  "ORD-102": {
    customer: "Rahul Verma",
    product: "Hydrating Sunscreen SPF 50",
    value: 499,
    status: "Delivered",
    carrier: "Delhivery",
    tracking: "DL-441029",
    deliveredDaysAgo: 14,
    note: "Delivered 14 days ago",
  },
  "ORD-103": {
    customer: "Ananya Patel",
    product: "Green Tea Face Wash + Toner",
    value: 850,
    status: "Processing",
    note: "Ordered 3 hours ago",
  },
};
const WORD_DIGITS: Record<string, string> = {
  zero: "0", oh: "0", one: "1", two: "2", three: "3",
  four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9",
};

// Turns "ORD-101", "ord 101", "ORD101" and "order one zero one" into "101"
function extractDigits(raw: string) {
  return raw
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => WORD_DIGITS[t] ?? t.replace(/\D/g, ""))
    .join("");
}
export function getOrderDetails(rawId?: string) {
  if (!rawId || !rawId.trim()) {
    return { error: "MISSING_ID", message: "No order ID was provided." };
  }

  // Handles "ord 101", "ORD-101", "o r d one zero one" (digits only)
    const digits = extractDigits(rawId);
  const id = `ORD-${digits}`;
  const order = ORDERS[id];

  if (!digits || !order) {
    return { error: "NOT_FOUND", message: `No order found for "${rawId}".` };
  }

  return {
    order_id: id,
    ...order,
    can_cancel: order.status === "Processing",
    return_window_open:
      order.status === "Delivered" && (order.deliveredDaysAgo ?? 99) <= 7,
    shipping_fee: order.value > 499 ? 0 : 50,
  };
}