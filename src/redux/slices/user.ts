import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
interface userState {
  user: any;
  wishlist: any[];
  isAuthenticated: boolean;
  selectedAddress: any;
}

const userSlice = createSlice({
  name: "user",
  initialState: {
    user: {},
    wishlist: [],
    selectedAddress: null,
    isAuthenticated: false,
  } as userState,
  reducers: {
    Authenticate: (state, action) => {
      const { auth, user } = action.payload;
      if (!auth) {
        state.user = user;
      }
      state.isAuthenticated = auth;
    },
    UpdateUserData: (state, action) => {
      const { user, wishlist, selectedAddress } = action.payload;

      if (user) {
        state.user = user;
      }
      if (wishlist) {
        state.wishlist = wishlist;
      }
      if (selectedAddress) {
        state.selectedAddress = selectedAddress;
      }
    },

    Login: (state, action) => {
      const { data } = action.payload;
      state.user = data;
      state.isAuthenticated = true;
    },
    Signup: (state, action) => {
      const { data } = action.payload;
      state.user = data;
      state.isAuthenticated = true;
    },
    addtowishlist: (state, action) => {
      const { product } = action.payload;
      const existingindex = state.wishlist.findIndex(
        (d) => d.name === product.name
      );
      if (existingindex !== -1) {
        toast.error("Poduct already in Wishlist");
        return;
      } else {
        state.wishlist.push(product);
      }
    },
    removefromwishlist: (state, action) => {
      const { id } = action.payload;

      const updatedWishlist = state.wishlist.filter((item) => item.name !== id);
      // toast.success(id + " removed from wishlist");
      state.wishlist = updatedWishlist;
    },
  },
});

export const {
  Authenticate,
  UpdateUserData,
  Signup,
  removefromwishlist,
  Login,
  addtowishlist,
} = userSlice.actions;

export default userSlice.reducer;
