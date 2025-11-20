"use client";

import { dark } from "@clerk/themes";
import { useCurrentTheme } from "@/hooks/use-current-theme";
import { UserButton, useUser } from "@clerk/nextjs";

interface Props {
  showName?: boolean;
}

export const UserControl = ({ showName }: Props) => {
  const currentTheme = useCurrentTheme();
  const { user } = useUser();

  const userPlan = (user?.publicMetadata?.plan as string) || "free";

  // Optional: style plan badge based on plan type
  const planColors: Record<string, string> = {
    free: "bg-gray-200 text-gray-800",
    pro: "bg-gradient-to-r from-blue-600 to-blue-800 text-white",
  };

  return (
    <div className="flex items-center gap-3">
      <UserButton
        showName={showName}
        appearance={{
          elements: {
            userButtonBox: "rounded-md!",
            userButtonAvatarBox: "rounded-md! size-8",
            userButtonTrigger: "rounded-md!",
          },
          baseTheme: currentTheme === "dark" ? dark : undefined,
        }}
      />
      <span
        className={`text-sm font-medium px-2 py-1 rounded-md ${planColors[userPlan]}`}
      >
        {userPlan.charAt(0).toUpperCase() + userPlan.slice(1)}
      </span>
    </div>
  );
};
