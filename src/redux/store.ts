"use client";
import { configureStore } from "@reduxjs/toolkit";
import agencyReducer from "./slices/agencySlice";
import clientReducer from "./slices/clientSlice";
import subscriptionReducer from "./slices/subscriptionSlice";


export const makeStore = () => {
  return configureStore({
    reducer: {
      agency: agencyReducer,
       client: clientReducer,
      subscription:subscriptionReducer
    },
  });
};

// Infer the type of makeStore
export type AppStore = ReturnType<typeof makeStore>;
// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
