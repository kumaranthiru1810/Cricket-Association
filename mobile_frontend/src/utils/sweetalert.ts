import { Alert } from 'react-native';

export type SweetAlertIcon = 'success' | 'error' | 'warning' | 'info' | 'question';
export type SweetAlertPosition = 'top' | 'top-start' | 'top-end' | 'center' | 'bottom' | 'bottom-start' | 'bottom-end';

export interface SweetAlertOptions {
  title?: string;
  text?: string;
  html?: string;
  icon?: SweetAlertIcon;
  showCancelButton?: boolean;
  confirmButtonText?: string;
  cancelButtonText?: string;
  confirmButtonColor?: string;
  cancelButtonColor?: string;
  timer?: number;
  timerProgressBar?: boolean;
  toast?: boolean;
  position?: SweetAlertPosition;
  showConfirmButton?: boolean;
}

/**
 * Show a standard alert popup (Native fallback)
 */
export const showAlert = async (
  title: string,
  text?: string,
  icon: SweetAlertIcon = 'info'
) => {
  return new Promise<{ isConfirmed: boolean }>((resolve) => {
    Alert.alert(title, text || '', [
      { text: 'OK', onPress: () => resolve({ isConfirmed: true }) },
    ]);
  });
};

/**
 * Show a success alert (Native fallback)
 */
export const showSuccess = async (title: string, text?: string, _timer: number = 2500) => {
  return showAlert(title, text, 'success');
};

/**
 * Show an error alert (Native fallback)
 */
export const showError = async (title: string, text?: string) => {
  return showAlert(title, text, 'error');
};

/**
 * Show a warning alert (Native fallback)
 */
export const showWarning = async (title: string, text?: string) => {
  return showAlert(title, text, 'warning');
};

/**
 * Show an info alert (Native fallback)
 */
export const showInfo = async (title: string, text?: string) => {
  return showAlert(title, text, 'info');
};

/**
 * Show a confirmation dialog (Native fallback)
 */
export const showConfirm = async (
  title: string,
  text?: string,
  confirmButtonText: string = 'Yes',
  cancelButtonText: string = 'Cancel',
  _icon: SweetAlertIcon = 'warning'
): Promise<boolean> => {
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      title,
      text || '',
      [
        { text: cancelButtonText, style: 'cancel', onPress: () => resolve(false) },
        { text: confirmButtonText, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
};

/**
 * Show a quick corner toast notification (Native fallback)
 */
export const showToast = async (
  title: string,
  _icon: SweetAlertIcon = 'success',
  _timer: number = 3000
) => {
  return showAlert(title);
};

export const swal = {
  fire: async (options: SweetAlertOptions | string, text?: string, icon?: SweetAlertIcon) => {
    if (typeof options === 'string') {
      return showAlert(options, text, icon);
    }
    if (options.showCancelButton) {
      const confirmed = await showConfirm(
        options.title || '',
        options.text || options.html,
        options.confirmButtonText,
        options.cancelButtonText,
        options.icon
      );
      return { isConfirmed: confirmed, isDismissed: !confirmed };
    }
    return showAlert(options.title || '', options.text || options.html, options.icon);
  },
  close: () => {},
};

export default swal;
