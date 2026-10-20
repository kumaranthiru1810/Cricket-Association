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
const CricSwal = (Swal && typeof (Swal as any).mixin === 'function')
  ? (Swal as any).mixin({
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
    })
  : {
      fire: async (opts: any) => {
        if (typeof window !== 'undefined') {
          const msg = typeof opts === 'string' ? opts : (opts?.title ? `${opts.title}: ${opts?.text || ''}` : opts?.text || '');
          window.alert(msg);
        }
        return { isConfirmed: true, isDismissed: false };
      }
    };

// Inject CSS styles matching Federation Theme & user screenshot
if (typeof document !== 'undefined') {
  const styleId = 'cric-swal-custom-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.innerHTML = `
      .swal2-container {
        z-index: 9999999 !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      }
      .swal2-popup.cric-swal-popup,
      .swal2-popup {
        border-radius: 20px !important;
        background: #ffffff !important;
        color: #0f172a !important;
        border: 1px solid rgba(226, 232, 240, 0.9) !important;
        box-shadow: 0 25px 60px -10px rgba(0, 0, 0, 0.22) !important;
        padding: 32px 28px !important;
        max-width: 480px !important;
        width: 90% !important;
      }
      .swal2-icon.swal2-success {
        border-color: #a7f3d0 !important;
        color: #22c55e !important;
      }
      .swal2-icon.swal2-success [class^='swal2-success-line'] {
        background-color: #22c55e !important;
      }
      .swal2-icon.swal2-success .swal2-success-ring {
        border: .25em solid rgba(34, 197, 94, 0.3) !important;
      }
      .swal2-title.cric-swal-title,
      .swal2-title {
        color: #0f172a !important;
        font-size: 22px !important;
        font-weight: 800 !important;
        letter-spacing: -0.3px !important;
        margin-top: 14px !important;
        margin-bottom: 10px !important;
      }
      .swal2-html-container.cric-swal-text,
      .swal2-html-container {
        color: #475569 !important;
        font-size: 14.5px !important;
        line-height: 1.6 !important;
        margin-bottom: 18px !important;
      }
      .cric-swal-confirm-btn,
      .swal2-confirm {
        background: linear-gradient(135deg, #eab308 0%, #ca8a04 100%) !important;
        color: #020612 !important;
        font-weight: 800 !important;
        font-size: 15px !important;
        border-radius: 12px !important;
        padding: 12px 36px !important;
        border: none !important;
        box-shadow: 0 6px 18px rgba(234, 179, 8, 0.38) !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        min-width: 110px !important;
      }
      .cric-swal-confirm-btn:hover,
      .swal2-confirm:hover {
        transform: translateY(-1px) !important;
        box-shadow: 0 8px 24px rgba(234, 179, 8, 0.5) !important;
      }
      .cric-swal-cancel-btn,
      .swal2-cancel {
        background: #f1f5f9 !important;
        color: #475569 !important;
        font-weight: 700 !important;
        font-size: 14.5px !important;
        border-radius: 12px !important;
        padding: 12px 28px !important;
        border: 1px solid #cbd5e1 !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
      }
      .cric-swal-cancel-btn:hover,
      .swal2-cancel:hover {
        background: #e2e8f0 !important;
        color: #1e293b !important;
      }
    `;
    document.head.appendChild(styleEl);
  }
}

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
 * Show a success alert (with OK button matching screenshot)
 */
export const showSuccess = async (title: string, text?: string, timer?: number) => {
  return CricSwal.fire({
    title,
    text,
    icon: 'success',
    ...(timer ? { timer, timerProgressBar: true } : {}),
    confirmButtonText: 'OK',
    showConfirmButton: true,
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
    showConfirmButton: true,
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
    confirmButtonColor: '#eab308',
    showConfirmButton: true,
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
    showConfirmButton: true,
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
  if (Swal && typeof (Swal as any).fire === 'function') {
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
  }
  return CricSwal.fire({ title });
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

