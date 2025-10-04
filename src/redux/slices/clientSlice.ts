import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface ClientState {
  userId: string;
  email: string;
  name: string;
  ownerId: string;
  agencyId: string;
  agencyName: string;
  status: string;
  tier: string;
  articlesGenerated: number;
  agencySubscription: any; // Agency's subscription details for shared pool
}

const initialState: ClientState = {
  userId: "",
  email: "",
  name: "",
  ownerId: "",
  agencyId: "",
  agencyName: "",
  status: "",
  tier: "",
  articlesGenerated: 0,
  agencySubscription: null,
};

export const clientSlice = createSlice({
  name: "client",
  initialState,
  reducers: {
    setClientData: (state, action: PayloadAction<ClientState | any>) => {
      return { ...state, ...action.payload };
    },
    clearClientData: (state) => {
      return initialState;
    },
    updateClientArticles: (state, action: PayloadAction<number>) => {
      state.articlesGenerated = action.payload;
    },
  },
});

export const { setClientData, clearClientData, updateClientArticles } = clientSlice.actions;
export default clientSlice.reducer;