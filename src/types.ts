export type MenuCategory = 'Breakfast' | 'Lunch' | 'Snacks' | 'Supper';

export type DietaryTag = 'Vegetarian' | 'Coastal' | 'Grill' | 'Hearty' | 'Chef Special';

export interface DishOption {
  id: string;
  label: string;
  priceDelta: number;
  imageOverride?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  category: MenuCategory;
  price: number;
  description: string;
  image: string;
  prepMinutes: number;
  subLabel: string;
  dietaryTags: DietaryTag[];
  optionGroupName?: string;
  options?: DishOption[];
  supportsSpiceLevel?: boolean;
}

export type SpiceLevel = 'Mild' | 'Medium' | 'Pilipili Hot';

export interface CartItem {
  cartItemId: string;
  menuItemId: string;
  name: string;
  category: MenuCategory;
  unitPrice: number;
  quantity: number;
  image: string;
  selectedOptionLabel?: string;
  spiceLevel?: SpiceLevel;
  notes?: string;
}

export type OrderStatus = 'Received' | 'Preparing' | 'Ready' | 'Served';

export interface OrderItemRecord {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  selectedOptionLabel?: string;
  spiceLevel?: SpiceLevel;
  notes?: string;
}

export interface TableOrder {
  id: string;
  orderNumber: string;
  tableNumber: number;
  guestName?: string;
  items: OrderItemRecord[];
  subtotal: number;
  serviceNote?: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  estimatedMinutes: number;
}

export type ServiceRequestType = 'Waiter Call' | 'Request Bill' | 'Extra Napkins & Water';

export interface ServiceRequest {
  id: string;
  tableNumber: number;
  type: ServiceRequestType;
  status: 'Open' | 'Resolved';
  createdAt: string;
}

export type AppView = 'menu' | 'tracker' | 'qr' | 'kitchen';
