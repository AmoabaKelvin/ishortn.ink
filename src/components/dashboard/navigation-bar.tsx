import { UserButton } from "@clerk/nextjs";

const NavigationBar = () => {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-semibold leading-tight text-gray-800">
        <span className="text-blue-600">ishortn.ink</span> / Dashboard
      </h2>
      <UserButton />
    </div>
  );
};

export default NavigationBar;
