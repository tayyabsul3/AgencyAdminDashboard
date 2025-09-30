import InviteRegistration from "@/components/auth/InvitaionForm";
import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Next.js SignUp Page | QueryFuelAdmin ",
  description: "This is Next.js Signin Page QueryFuelAdmin Dashboard Template",
};

export default function SignIn() {
  return <InviteRegistration />;
}
