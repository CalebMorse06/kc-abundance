export interface Restaurant {
  id: string;
  name: string;
  category: string;
  emoji: string;
  rating: number;
  reviews: number;
  deliveryTime: string;
  deliveryFee: number;
  minOrder: number;
  address: string;
  tags: string[];
  open: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  emoji: string;
  category: string;
  popular?: boolean;
}

export const RESTAURANTS: Restaurant[] = [
  {
    id: 'r1',
    name: 'Waldo Pizza',
    category: 'Pizza',
    emoji: '🍕',
    rating: 4.8,
    reviews: 342,
    deliveryTime: '25-35',
    deliveryFee: 2.99,
    minOrder: 12,
    address: '7433 Broadway Blvd, KCMO',
    tags: ['Local Favorite', 'Vegetarian Options'],
    open: true,
  },
  {
    id: 'r2',
    name: 'Q39 BBQ',
    category: 'BBQ',
    emoji: '🍖',
    rating: 4.9,
    reviews: 1204,
    deliveryTime: '30-45',
    deliveryFee: 3.99,
    minOrder: 20,
    address: '1000 W 39th St, KCMO',
    tags: ['KC Classic', 'Award-Winning'],
    open: true,
  },
  {
    id: 'r3',
    name: 'Fervere Bread',
    category: 'Bakery',
    emoji: '🥖',
    rating: 4.7,
    reviews: 198,
    deliveryTime: '20-30',
    deliveryFee: 1.99,
    minOrder: 8,
    address: '1702 Summit St, KCMO',
    tags: ['Artisan', 'Fresh Daily'],
    open: true,
  },
  {
    id: 'r4',
    name: 'Genghis Khan Mongolian',
    category: 'Asian',
    emoji: '🥢',
    rating: 4.5,
    reviews: 287,
    deliveryTime: '35-50',
    deliveryFee: 3.49,
    minOrder: 15,
    address: '3901 Main St, KCMO',
    tags: ['Build Your Bowl'],
    open: true,
  },
  {
    id: 'r5',
    name: 'Corvino Supper Club',
    category: 'Fine Dining',
    emoji: '🍷',
    rating: 4.9,
    reviews: 512,
    deliveryTime: '40-55',
    deliveryFee: 5.99,
    minOrder: 40,
    address: '1830 Walnut St, KCMO',
    tags: ['Premium', 'Date Night'],
    open: true,
  },
  {
    id: 'r6',
    name: 'Tacos El Caballo',
    category: 'Mexican',
    emoji: '🌮',
    rating: 4.6,
    reviews: 873,
    deliveryTime: '15-25',
    deliveryFee: 1.49,
    minOrder: 8,
    address: '2900 Southwest Blvd, KCMO',
    tags: ['Fast', 'Authentic', 'Popular'],
    open: true,
  },
];

export const MENUS: Record<string, MenuItem[]> = {
  r1: [
    { id: 'm1', name: 'Classic Margherita', description: 'San Marzano tomatoes, fresh mozzarella, basil', price: 14.99, emoji: '🍕', category: 'Pizza', popular: true },
    { id: 'm2', name: 'BBQ Chicken Pizza', description: 'Smoked chicken, red onion, cilantro, KC BBQ sauce', price: 16.99, emoji: '🍕', category: 'Pizza', popular: true },
    { id: 'm3', name: 'Veggie Supreme', description: 'Roasted peppers, mushrooms, olives, artichoke', price: 15.49, emoji: '🍕', category: 'Pizza' },
    { id: 'm4', name: 'House Salad', description: 'Mixed greens, cherry tomatoes, balsamic', price: 8.99, emoji: '🥗', category: 'Sides' },
    { id: 'm5', name: 'Garlic Knots (6)', description: 'House-made dough, roasted garlic, parmesan', price: 6.99, emoji: '🧄', category: 'Sides', popular: true },
    { id: 'm6', name: 'Tiramisu', description: 'Classic Italian dessert, espresso-soaked', price: 7.49, emoji: '🍮', category: 'Desserts' },
  ],
  r2: [
    { id: 'm1', name: 'Brisket Plate', description: '½ lb smoked brisket, two sides, house bread', price: 22.99, emoji: '🥩', category: 'Plates', popular: true },
    { id: 'm2', name: 'Burnt Ends', description: 'Kansas City classic — crispy smoked beef tips', price: 18.99, emoji: '🍖', category: 'Plates', popular: true },
    { id: 'm3', name: 'Pulled Pork Sandwich', description: 'Hand-pulled pork, pickles, coleslaw', price: 13.99, emoji: '🥪', category: 'Sandwiches' },
    { id: 'm4', name: 'Mac & Cheese', description: 'Smoked gouda, breadcrumb crust', price: 7.99, emoji: '🧀', category: 'Sides', popular: true },
    { id: 'm5', name: 'Coleslaw', description: 'House vinegar slaw', price: 4.99, emoji: '🥗', category: 'Sides' },
    { id: 'm6', name: 'Banana Pudding', description: 'Layered vanilla wafer pudding', price: 6.49, emoji: '🍌', category: 'Desserts' },
  ],
  r3: [
    { id: 'm1', name: 'Country Miche Loaf', description: 'Sourdough, crispy crust, open crumb', price: 9.99, emoji: '🍞', category: 'Breads', popular: true },
    { id: 'm2', name: 'Croissant', description: 'Butter laminated, flaky layers', price: 4.49, emoji: '🥐', category: 'Pastries', popular: true },
    { id: 'm3', name: 'Cinnamon Roll', description: 'Brioche dough, cream cheese glaze', price: 5.49, emoji: '🍥', category: 'Pastries' },
    { id: 'm4', name: 'Baguette', description: 'French-style, crispy exterior', price: 5.99, emoji: '🥖', category: 'Breads' },
    { id: 'm5', name: 'Lemon Tart', description: 'Almond frangipane, citrus curd', price: 6.99, emoji: '🍋', category: 'Desserts', popular: true },
  ],
  r4: [
    { id: 'm1', name: 'Build Your Bowl — Small', description: 'Choose protein, vegetables, and sauce', price: 12.99, emoji: '🥘', category: 'Bowls', popular: true },
    { id: 'm2', name: 'Build Your Bowl — Large', description: 'Choose protein, vegetables, and sauce', price: 17.99, emoji: '🥘', category: 'Bowls' },
    { id: 'm3', name: 'Potstickers (6)', description: 'Pan-fried, ginger dipping sauce', price: 8.99, emoji: '🥟', category: 'Starters', popular: true },
    { id: 'm4', name: 'Fried Rice', description: 'Wok-tossed, egg, scallion', price: 9.49, emoji: '🍚', category: 'Sides' },
    { id: 'm5', name: 'Spring Rolls (3)', description: 'Fresh herbs, peanut sauce', price: 7.49, emoji: '🌯', category: 'Starters' },
  ],
  r5: [
    { id: 'm1', name: 'Mushroom Risotto', description: 'Truffle oil, parmesan, herbs', price: 28.00, emoji: '🍄', category: 'Mains', popular: true },
    { id: 'm2', name: 'Pan-Seared Salmon', description: 'Saffron cream, haricots verts', price: 34.00, emoji: '🐟', category: 'Mains' },
    { id: 'm3', name: 'Wagyu Beef Tenderloin', description: '6oz, red wine jus, potato gratin', price: 52.00, emoji: '🥩', category: 'Mains', popular: true },
    { id: 'm4', name: 'Charcuterie Board', description: 'Cured meats, artisan cheeses, house pickles', price: 24.00, emoji: '🧀', category: 'Starters' },
    { id: 'm5', name: 'Chocolate Soufflé', description: '(Order ahead) Valrhona chocolate, crème anglaise', price: 14.00, emoji: '🍫', category: 'Desserts', popular: true },
  ],
  r6: [
    { id: 'm1', name: 'Street Tacos (3)', description: 'Choice of carne asada or al pastor, onion, cilantro', price: 10.99, emoji: '🌮', category: 'Tacos', popular: true },
    { id: 'm2', name: 'Birria Quesatacos (2)', description: 'Braised beef, Oaxaca cheese, consommé dip', price: 13.99, emoji: '🌮', category: 'Tacos', popular: true },
    { id: 'm3', name: 'Tamales (3)', description: 'Pork in red chile, masa, corn husk', price: 9.99, emoji: '🫔', category: 'Classics' },
    { id: 'm4', name: 'Elote', description: 'Grilled corn, cotija, lime, chile', price: 5.49, emoji: '🌽', category: 'Sides', popular: true },
    { id: 'm5', name: 'Horchata (16oz)', description: 'House-made rice milk, cinnamon', price: 3.99, emoji: '🥛', category: 'Drinks' },
    { id: 'm6', name: 'Churros (4)', description: 'Cinnamon sugar, chocolate dipping sauce', price: 6.49, emoji: '🍩', category: 'Desserts' },
  ],
};

export interface CartItem {
  item: MenuItem;
  quantity: number;
  restaurantId: string;
  restaurantName: string;
}
