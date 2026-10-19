import Swal, { SweetAlertIcon, SweetAlertPosition } from 'sweetalert2';

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

// Configured SweetAlert2 instance with Clean White Background & Federation styling
const CricSwal = Swal.mixin({
  background: '#ffffff',
  color: '#0f172a',
  confirmButtonColor: '#eab308',
  cancelButtonColor: '#64748b',
  buttonsStyling: true,
  customClass: {
    popup: 'cric-swal-popup',
    title: 'cric-swal-title',
    htmlContainer: 'cric-swal-text',
    confirmButton: 'cric-swal-confirm-btn',
    cancelButton: 'cric-swal-cancel-btn',
  }
});

/**
 * Show a standard alert popup
 */
export const showAlert = async (
  title: string,
  text?: string,
  icon: SweetAlertIcon = 'info'
) => {
  return CricSwal.fire({
    title,
    text,
    icon,
    confirmButtonText: 'OK',
  });
};

/**
 * Show a success alert
 */
export const showSuccess = async (title: string, text?: string, timer: number = 2500) => {
  return CricSwal.fire({
    title,
    text,
    icon: 'success',
    timer,
    timerProgressBar: true,
    confirmButtonText: 'OK',
  });
};

/**
 * Show an error alert
 */
export const showError = async (title: string, text?: string) => {
  return CricSwal.fire({
    title,
    text,
    icon: 'error',
    confirmButtonText: 'OK',
    confirmButtonColor: '#ef4444',
  });
};

/**
 * Show a warning alert
 */
export const showWarning = async (title: string, text?: string) => {
  return CricSwal.fire({
    title,
    text,
    icon: 'warning',
    confirmButtonText: 'OK',
    confirmButtonColor: '#f59e0b',
  });
};

/**
 * Show an info alert
 */
export const showInfo = async (title: string, text?: string) => {
  return CricSwal.fire({
    title,
    text,
    icon: 'info',
    confirmButtonText: 'OK',
    confirmButtonColor: '#3b82f6',
  });
};

/**
 * Show a confirmation dialog (e.g. logout or delete actions)
 * Returns a Promise that resolves to true if confirmed, false otherwise
 */
export const showConfirm = async (
  title: string,
  text?: string,
  confirmButtonText: string = 'Yes',
  cancelButtonText: string = 'Cancel',
  icon: SweetAlertIcon = 'warning'
): Promise<boolean> => {
  const result = await CricSwal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    reverseButtons: true,
  });

  return result.isConfirmed;
};

/**
 * Show a quick corner toast notification
 */
export const showToast = async (
  title: string,
  icon: SweetAlertIcon = 'success',
  timer: number = 3000
) => {
  return Swal.fire({
    toast: true,
    position: 'top-end',
    icon,
    title,
    showConfirmButton: false,
    timer,
    timerProgressBar: true,
    background: '#ffffff',
    color: '#0f172a',
  });
};

export const swal = CricSwal;

// Auto-enhance standard window.alert on Web browsers with SweetAlert2
if (typeof window !== 'undefined') {
  // Save original alert in case needed internally
  const originalAlert = window.alert;

  window.alert = (msg?: any) => {
    try {
      const rawText = String(msg ?? '');
      let title = 'Cricket Association';
      let text = rawText;
      let icon: SweetAlertIcon = 'info';

      // Check if message has Title: Text format (e.g., "Over Complete: msg")
      if (rawText.includes(': ') && rawText.indexOf(': ') < 35) {
        const parts = rawText.split(': ');
        title = parts[0].trim();
        text = parts.slice(1).join(': ').trim();
      }

      const lower = rawText.toLowerCase();
      if (
        lower.includes('error') ||
        lower.includes('failed') ||
        lower.includes('invalid') ||
        lower.includes('denied') ||
        lower.includes('not allowed')
      ) {
        if (title === 'Cricket Association') title = 'Error';
        icon = 'error';
      } else if (
        lower.includes('success') ||
        lower.includes('complete') ||
        lower.includes('saved') ||
        lower.includes('awarded') ||
        lower.includes('started')
      ) {
        if (title === 'Cricket Association') title = 'Success';
        icon = 'success';
      } else if (
        lower.includes('warning') ||
        lower.includes('required') ||
        lower.includes('limit') ||
        lower.includes('incomplete') ||
        lower.includes('locked')
      ) {
        if (title === 'Cricket Association') title = 'Notice';
        icon = 'warning';
      }

      CricSwal.fire({
        title,
        text,
        icon,
        confirmButtonText: 'OK',
      });
    } catch (_e) {
      if (typeof originalAlert === 'function') {
        originalAlert(msg);
      }
    }
  };
}

export default CricSwal;

