export interface ShopItem {
  itemId: string;
  name: string;
  price: number;
  stock: number | "infinity";
  category: string;
  description: string;
  imageUrl: string;
}

export interface CartItem extends ShopItem {
  quantity: number;
}
