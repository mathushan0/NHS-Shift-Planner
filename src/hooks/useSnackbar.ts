import { useUIStore, SnackbarVariant } from '../stores/uiStore';

export function useSnackbar() {
  const showSnackbar = useUIStore(state => state.showSnackbar);

  return {
    show: (message: string, options?: {
      variant?: SnackbarVariant;
      actionLabel?: string;
      onAction?: () => void;
      duration?: number;
    }) => {
      showSnackbar({
        message,
        variant: options?.variant ?? 'default',
        actionLabel: options?.actionLabel,
        onAction: options?.onAction,
        duration: options?.duration ?? 5000,
      });
    },
    success: (message: string, actionLabel?: string, onAction?: () => void) => {
      showSnackbar({ message, variant: 'success', actionLabel, onAction });
    },
    error: (message: string) => {
      showSnackbar({ message, variant: 'error' });
    },
    warning: (message: string) => {
      showSnackbar({ message, variant: 'warning' });
    },
  };
}
