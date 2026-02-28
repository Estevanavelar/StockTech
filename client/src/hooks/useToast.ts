import { toast } from "sonner";

export type ToastType = "success" | "error" | "info" | "warning";

const DEFAULT_DURATION = 5000;

export function useToast() {
  const showToast = (message: string, type: ToastType = "info") => {
    const options = { duration: DEFAULT_DURATION };
    switch (type) {
      case "success":
        toast.success(message, options);
        break;
      case "error":
        toast.error(message, options);
        break;
      case "warning":
        toast.warning(message, options);
        break;
      case "info":
      default:
        toast.info(message, options);
        break;
    }
  };

  return { showToast, toast };
}

export default useToast;
