// redux/slices/subscriptionSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type ClientUsageStatus = "accepted" | "pending" | "archived";

export interface ClientUsage {
  id: string;
  name: string;
  email: string;
  status: ClientUsageStatus;
  creditsUsed: number;
}

export interface SubscriptionState {
  limit: number; // total credits allowed
  used: number;  // credits used
  usageByClient: ClientUsage[];
  loading: boolean;
  error: string | null;
}

const initialState: SubscriptionState = {
  limit: 150,
  used: 45,
  usageByClient: [
    { id: "1", name: "Client A", email: "a@example.com", status: "accepted", creditsUsed: 20 },
    { id: "2", name: "Client B", email: "b@example.com", status: "accepted", creditsUsed: 15 },
    { id: "3", name: "Client C", email: "c@example.com", status: "archived", creditsUsed: 10 },
  ],
  loading: false,
  error: null,
};

const subscriptionSlice = createSlice({
  name: "subscription",
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    buyCredits: (state, action: PayloadAction<number>) => {
      // Adds credits to the org pool
      state.limit += action.payload;
    },
  },
});

export const { setLoading, setError, buyCredits } = subscriptionSlice.actions;
export default subscriptionSlice.reducer;
