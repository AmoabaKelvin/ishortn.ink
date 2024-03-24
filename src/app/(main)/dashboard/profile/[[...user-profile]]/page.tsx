import { UserProfile } from "@clerk/nextjs";

const UserProfilePage = () => (
  <div className="flex flex-col items-center justify-between w-full">
    <UserProfile path="/dashboard/profile" routing="path" />
  </div>
);

export default UserProfilePage;
