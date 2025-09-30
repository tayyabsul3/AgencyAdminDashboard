import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Define the initial state shape explicitly with proper types.
interface orderState {
  orders: any[];
  Branches: any[] | null;
  currentBranch: any | null;
  categories: any | null;
  menu: any[] | null;
  branchOpen: boolean;
  currentBranchIndex: number | null;
  currency: any;
}

const orderSlice = createSlice({
  name: "order",
  initialState: {
    orders: {},
    Branches: null,
    currentBranch: null,
    categories: null,
    menu: null,
    branchOpen: true,
    currentBranchIndex: null,
    currency: {},
  } as orderState,
  reducers: {
    createOrder: (state, action) => {
      const { data } = action.payload;
      state.orders = data;
    },
    updateOrderData: (state, action) => {
      const {
        orders,

        Branches,
        currentBranch,
        branchOpen,
        categories,
        menu,
        currency,
        currentBranchIndex,
      } = action.payload;
      if (currentBranchIndex > -1) {
        state.currentBranchIndex = currentBranchIndex;
      }
      if (branchOpen !== undefined) state.branchOpen = branchOpen;
      if (orders) state.orders = orders;
      if (currency) state.currency = currency;
      if (Branches) state.Branches = Branches;
      if (currentBranch) state.currentBranch = currentBranch;
      if (categories) state.categories = categories;
      if (menu) state.menu = menu;
    },
  },
});

export const { createOrder, updateOrderData } = orderSlice.actions;

export default orderSlice.reducer;
