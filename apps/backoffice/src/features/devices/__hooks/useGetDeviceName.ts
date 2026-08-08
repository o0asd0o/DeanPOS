import { useCallback } from "react";
import type { DeviceOutput } from "../helpers.ts";

const useGetDeviceName = ({
  storeNameById,
  userNameById,
}: {
  storeNameById: Map<string, string>;
  userNameById: Map<string, string>;
}) => {
  return useCallback(
    (device: DeviceOutput, key: "storeName" | "userName") => {
      if (key === "storeName") return storeNameById.get(device.storeId) ?? "";
      if (key === "userName" && device.assignedUserId) {
        return userNameById.get(device.assignedUserId) ?? "";
      }
      return "";
    },
    [storeNameById, userNameById],
  );
};

export default useGetDeviceName;
