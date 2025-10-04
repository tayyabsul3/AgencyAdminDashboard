// redux/slices/agencySlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";


interface AgencyData {
loading: boolean,
  error: any,
  agencyId: string ,
  ownerId: string | null,
  agencyName: string | null,
  email: string | null,
  subscription: any | null,
  clients: any[],
  branding:any
}


const initialState :AgencyData = {
  loading: false,
  error: null,
  agencyId:  "",
  ownerId: null,
  agencyName: null,
  email: null,
  subscription: null,
  clients: [],
  branding: {
    logo: "", // placeholder default
    primaryColor: "#4F46E5",   // indigo
    secondaryColor:"",
    customDomain: "",
  },
};

const agencySlice = createSlice({
  name: "agency",
  initialState,
  reducers: {
 setAgencyData: (state, action: PayloadAction<Partial<any>>) => {
  const { agencyId, ownerId, agencyName, email, subscription, clients,branding } = action.payload;

  if (agencyId !== undefined) state.agencyId = agencyId;
  if (ownerId !== undefined) state.ownerId = ownerId;
  if (agencyName !== undefined) state.agencyName = agencyName;
  if (email !== undefined) state.email = email;
  if (subscription !== undefined) state.subscription = subscription;
  if (clients !== undefined) state.clients = clients;
  if (branding !== undefined) state.branding = branding;

  state.loading = false;
  state.error = null;
}
}})

export const { setAgencyData } =
  agencySlice.actions;
export default agencySlice.reducer;
