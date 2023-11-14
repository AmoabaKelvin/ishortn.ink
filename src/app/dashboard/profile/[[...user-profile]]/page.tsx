import TabSwitcher from "@/components/dashboard/tab-switcher";
import { UserProfile } from "@clerk/nextjs";

const UserProfilePage = () => (
  <div className="flex flex-col gap-10">
    <TabSwitcher />
    <div className="flex flex-col items-center justify-between w-full">
      <UserProfile path="/dashboard/profile" routing="path" />
    </div>
  </div>
);

export default UserProfilePage;
