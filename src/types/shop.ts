import { PriceUnit } from "../constants/priceUnit";

export interface ShopItem {
  itemId: string;
  name: string;
  price: number;
  priceUnit?: PriceUnit;
  stock: number | "infinity";
  description: string;
  imageUrl: string;
}

export interface CartItem extends ShopItem {
  quantity: number;
}
