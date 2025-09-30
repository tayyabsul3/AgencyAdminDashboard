import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface globalState {
  iscartvisible: boolean;
  mobileheader: boolean;
  fullloader: boolean;
}

const globalState = createSlice({
  name: "globalState",
  initialState: {
    iscartvisible: false,
    mobileheader: false,
    fullloader: true,
  } as globalState,
  reducers: {
    toogleShowCart: (state, action) => {
      state.iscartvisible = !state.iscartvisible;
    },
    toogleShowHeader: (state, action) => {
      state.mobileheader = !state.mobileheader;
    },
    updateState: (state, action) => {
      const { mobileheader, iscartvisible, fullloader } = action.payload;
      if (mobileheader) {
        state.mobileheader = mobileheader;
      }
      if (iscartvisible) state.iscartvisible = iscartvisible;
      if (fullloader) state.fullloader = fullloader;
    },
  },
});

export const { toogleShowCart, updateState, toogleShowHeader } =
  globalState.actions;

export default globalState.reducer;
