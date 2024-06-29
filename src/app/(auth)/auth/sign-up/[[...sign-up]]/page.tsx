import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return <SignUp path="/auth/sign-up" />;
}
