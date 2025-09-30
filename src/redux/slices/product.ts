import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { toast } from "sonner";

// Define the initial state shape explicitly with proper types.
interface ProductState {
  items: any[];
  product: null;
  cart: any[];
  isHydrated: boolean; // Added flag to handle hydration
}

const loadCartFromLocalStorage = (): any[] => {
  if (typeof window !== "undefined") {
    const savedCart = localStorage.getItem("cart");
    return savedCart ? JSON.parse(savedCart) : [];
  }
  return [];
};

const productSlice = createSlice({
  name: "product",
  initialState: {
    items: [],
    product: null,
    cart: [], // Start with empty cart
    isHydrated: false, // Flag to track hydration status
  } as ProductState,
  reducers: {
    addtocart: (state, action: PayloadAction<{ item: any }>) => {
      const { item } = action.payload;
      // const { currentBranch } = useAppSelector((state) => state.order);
      // const taxType = currentBranch.taxType;
      const id = item.name;
      let ClonedItem = [...state.cart];
      const existingIndex = ClonedItem.findIndex((i) => i.name === id);
      if (existingIndex !== -1) {
        ClonedItem[existingIndex].quantity =
          parseInt(ClonedItem[existingIndex].quantity) +
          parseInt(item.quantity);
        state.cart = ClonedItem;
      } else {
        state.cart.push(item);
      }

      toast.success(item.name + "  added to Cart");
      localStorage.setItem("cart", JSON.stringify(state.cart)); // Save to localStorage
    },
    removefromcart: (state, action) => {
      const { id } = action.payload;
      state.cart = state.cart.filter((i) => i.name !== id);
      localStorage.setItem("cart", JSON.stringify(state.cart)); // Update localStorage
    },
    updateQuantity: (state, action) => {
      const { id, type } = action.payload;
      let ClonedItem = [...state.cart];

      ClonedItem = ClonedItem.map((item) => {
        if (item.name === id) {
          const currentQuantity = parseInt(item.quantity);
          const stock = parseInt(item.stock);

          if (type === "increase") {
            if (currentQuantity >= stock) {
              toast.error("Out of stock");
              return item; // Return without change
            } else {
              return { ...item, quantity: currentQuantity + 1 };
            }
          } else if (type === "decrease") {
            if (currentQuantity === 1) {
              return null;
            } else {
              return { ...item, quantity: currentQuantity - 1 };
            }
          }
        }
        return item;
      });

      state.cart = ClonedItem.filter((item) => item !== null);
      localStorage.setItem("cart", JSON.stringify(state.cart));
    },

    updateProductData: (state, action) => {
      const { cart, product } = action.payload;
      if (cart) {
        state.cart = cart;
      }
      if (product) {
        state.product = product;
      }
    },
    hydrateCart: (state) => {
      // Triggered once the component is mounted
      if (typeof window !== "undefined" && !state.isHydrated) {
        const loadedCart = loadCartFromLocalStorage();
        state.cart = loadedCart;
        state.isHydrated = true; // Set hydrated flag to true
      }
    },
  },
});

export const {
  addtocart,
  updateProductData,
  updateQuantity,
  removefromcart,
  hydrateCart,
} = productSlice.actions;

export default productSlice.reducer;
