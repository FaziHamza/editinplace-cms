export const CMS_STYLES = `
/* ===== EDITINPLACE CMS ===== */

/* LOADER */
.lcms-loader-overlay {
  position: fixed; inset: 0; z-index: 10003;
  display: flex; align-items: center; justify-content: center;
  background: rgba(8, 8, 15, 0.45);
  backdrop-filter: blur(12px) saturate(1.4);
  -webkit-backdrop-filter: blur(12px) saturate(1.4);
}
.lcms-loader-content { display: flex; flex-direction: column; align-items: center; gap: 28px; }
.lcms-orbit-loader { position: relative; width: 90px; height: 90px; }
.lcms-orbit { position: absolute; inset: 0; border-radius: 50%; border: 1px solid transparent; }
.lcms-orbit-1 { border-top-color: rgba(var(--lcms-primary-rgb, 0,200,83),0.5); animation: lcmsSpin 2.4s linear infinite; }
.lcms-orbit-2 { inset: 10px; border-right-color: rgba(var(--lcms-primary-rgb, 0,200,83),0.4); animation: lcmsSpin 3.2s linear infinite reverse; }
.lcms-orbit-3 { inset: 20px; border-bottom-color: rgba(var(--lcms-primary-rgb, 0,200,83),0.35); animation: lcmsSpin 4.2s linear infinite; }
.lcms-particle {
  position: absolute; width: 8px; height: 8px; border-radius: 50%; top: -4px; left: 50%; margin-left: -4px;
  box-shadow: 0 0 12px 3px currentColor;
}
.lcms-orbit-1 .lcms-particle { background: var(--lcms-primary, #00C853); color: var(--lcms-primary, #00C853); }
.lcms-orbit-2 .lcms-particle { background: rgba(var(--lcms-primary-rgb, 0,200,83),0.8); color: rgba(var(--lcms-primary-rgb, 0,200,83),0.8); top: 50%; left: auto; right: -4px; margin-left: 0; margin-top: -4px; }
.lcms-orbit-3 .lcms-particle { background: rgba(var(--lcms-primary-rgb, 0,200,83),0.6); color: rgba(var(--lcms-primary-rgb, 0,200,83),0.6); top: auto; bottom: -4px; }
.lcms-core-glow {
  position: absolute; width: 30px; height: 30px; top: 50%; left: 50%; transform: translate(-50%,-50%);
  border-radius: 50%; background: radial-gradient(circle, rgba(var(--lcms-primary-rgb, 0,200,83),0.4), transparent 70%);
  animation: lcmsPulse 2s ease-in-out infinite;
}
.lcms-core {
  position: absolute; width: 12px; height: 12px; top: 50%; left: 50%; transform: translate(-50%,-50%);
  border-radius: 50%; background: linear-gradient(135deg, var(--lcms-primary, #00C853), rgba(var(--lcms-primary-rgb, 0,200,83),0.6));
  box-shadow: 0 0 20px rgba(var(--lcms-primary-rgb, 0,200,83),0.6);
}
.lcms-loader-text {
  font-family: system-ui, -apple-system, sans-serif; font-size: 12px; font-weight: 600;
  color: rgba(255,255,255,0.5); letter-spacing: 4px; text-transform: uppercase;
  animation: lcmsBreath 2.5s ease-in-out infinite;
}
@keyframes lcmsSpin { to { transform: rotate(360deg); } }
@keyframes lcmsPulse { 0%,100% { transform: translate(-50%,-50%) scale(1); opacity: 0.5; } 50% { transform: translate(-50%,-50%) scale(1.8); opacity: 0.2; } }
@keyframes lcmsBreath { 0%,100% { letter-spacing: 4px; opacity: 0.5; } 50% { letter-spacing: 6px; opacity: 0.8; } }

/* TOAST */
.lcms-toast {
  position: fixed; top: 24px; left: 50%; transform: translateX(-50%); z-index: 10004;
  padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 600;
  font-family: system-ui, -apple-system, sans-serif; color: white;
  display: flex; align-items: center; gap: 8px;
  box-shadow: 0 8px 32px rgba(var(--lcms-primary-rgb, 0,200,83),0.25);
  animation: lcmsToastIn 0.3s ease, lcmsToastOut 0.3s ease 2.7s forwards; white-space: nowrap;
}
.lcms-toast-success { background: linear-gradient(135deg, var(--lcms-primary, #00C853), var(--lcms-primary-dark, #2E7D32)); }
.lcms-toast-error { background: linear-gradient(135deg, #dc2626, #ef4444); }
@keyframes lcmsToastIn { from { opacity: 0; transform: translateX(-50%) translateY(-12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
@keyframes lcmsToastOut { from { opacity: 1; transform: translateX(-50%) translateY(0); } to { opacity: 0; transform: translateX(-50%) translateY(-12px); } }

/* FAB */
.lcms-fab { position: fixed; z-index: 10001; user-select: none; touch-action: none; }
.lcms-fab-btn {
  width: 52px; height: 52px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2);
  background: rgba(var(--lcms-primary-rgb, 0,200,83),0.35); color: white;
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  cursor: grab; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 20px rgba(var(--lcms-primary-rgb, 0,200,83),0.3), inset 0 1px 0 rgba(255,255,255,0.15);
  transition: transform 0.2s, box-shadow 0.2s, background 0.2s; position: relative;
}
.lcms-fab-btn:not(.lcms-fab-active) { background: rgba(var(--lcms-primary-rgb, 0,200,83),0.25); box-shadow: 0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1); }
.lcms-fab-btn.lcms-fab-active { background: rgba(var(--lcms-primary-rgb, 0,200,83),0.4); box-shadow: 0 4px 24px rgba(var(--lcms-primary-rgb, 0,200,83),0.4), 0 0 16px rgba(var(--lcms-primary-rgb, 0,200,83),0.2), inset 0 1px 0 rgba(255,255,255,0.2); }
.lcms-fab-btn:hover { transform: scale(1.08); background: rgba(var(--lcms-primary-rgb, 0,200,83),0.5); box-shadow: 0 6px 28px rgba(var(--lcms-primary-rgb, 0,200,83),0.4), inset 0 1px 0 rgba(255,255,255,0.2); }
.lcms-badge {
  position: absolute; top: -4px; right: -4px; background: #ef4444; color: white;
  font-size: 11px; font-weight: 700; width: 20px; height: 20px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; border: 2px solid white;
}

/* PANEL */
.lcms-panel {
  background: rgba(12,12,18,0.55); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(var(--lcms-primary-rgb, 0,200,83),0.25); border-radius: 16px; padding: 16px; min-width: 230px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06);
  color: white; font-family: system-ui, -apple-system, sans-serif;
  animation: lcmsPanelIn 0.25s ease; position: absolute;
}
@keyframes lcmsPanelIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }

/* SITE IDENTIFIER */
.lcms-site-id {
  display: flex; align-items: center; gap: 5px;
  font-size: 10px; color: rgba(255,255,255,0.4);
  padding: 0 0 8px; margin-bottom: 8px;
  border-bottom: 1px solid rgba(var(--lcms-primary-rgb, 0,200,83),0.12);
  font-family: system-ui, -apple-system, sans-serif;
  letter-spacing: 0.3px;
}
.lcms-site-id-icon { font-size: 12px; opacity: 0.7; }
.lcms-site-id-text {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px;
  font-weight: 500;
}

/* BRANDING */
.lcms-branding {
  display: flex; align-items: center; gap: 6px; padding: 8px 0 4px;
  border-top: 1px solid rgba(var(--lcms-primary-rgb, 0,200,83),0.15); margin-top: 10px;
  cursor: pointer; transition: opacity 0.2s; user-select: none;
}
.lcms-branding:hover { opacity: 0.8; }
.lcms-branding-logo {
  width: 18px; height: 18px; border-radius: 4px; background: linear-gradient(135deg, var(--lcms-primary, #00C853), var(--lcms-primary-dark, #2E7D32));
  display: flex; align-items: center; justify-content: center;
}
.lcms-branding-text {
  font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.35); letter-spacing: 0.5px;
}
.lcms-branding-text span { color: var(--lcms-primary, #00C853); font-weight: 700; }

.lcms-panel-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.lcms-toggle { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; }
.lcms-toggle input { display: none; }
.lcms-toggle-slider {
  width: 36px; height: 20px; border-radius: 10px; position: relative;
  background: rgba(255,255,255,0.15); transition: background 0.25s;
}
.lcms-toggle-slider::after {
  content: ''; position: absolute; width: 16px; height: 16px; border-radius: 50%;
  top: 2px; left: 2px; background: rgba(255,255,255,0.6); transition: transform 0.25s, background 0.25s;
}
.lcms-toggle input:checked + .lcms-toggle-slider { background: var(--lcms-primary, #00C853); }
.lcms-toggle input:checked + .lcms-toggle-slider::after { transform: translateX(16px); background: white; }
.lcms-toggle-label { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.5); letter-spacing: 0.5px; transition: color 0.25s; }
.lcms-toggle input:checked ~ .lcms-toggle-label { color: rgba(var(--lcms-primary-rgb, 0,200,83),0.75); }
.lcms-lang-switch { margin-left: auto; position: relative; }
.lcms-lang-select { background: rgba(var(--lcms-primary-rgb, 0,200,83),0.15); border: 1px solid rgba(var(--lcms-primary-rgb, 0,200,83),0.4); border-radius: 6px; color: white; padding: 3px 24px 3px 8px; font-size: 11px; font-weight: 600; cursor: pointer; appearance: none; -webkit-appearance: none; outline: none; transition: all 0.2s; }
.lcms-lang-select:hover { background: rgba(var(--lcms-primary-rgb, 0,200,83),0.3); }
.lcms-lang-select:focus { border-color: var(--lcms-primary, #00C853); }
.lcms-lang-select option { background: #1a1a2e; color: white; }
.lcms-lang-arrow { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); pointer-events: none; color: rgba(255,255,255,0.6); font-size: 10px; }
.lcms-close-btn { background: transparent; border: none; color: rgba(255,255,255,0.4); cursor: pointer; padding: 2px; display: flex; transition: color 0.2s; }
.lcms-close-btn:hover { color: white; }
.lcms-changes-info { font-size: 12px; color: rgba(var(--lcms-primary-rgb, 0,200,83),0.75); margin-bottom: 10px; padding-left: 2px; }

.lcms-undo-row { display: flex; gap: 6px; margin-bottom: 12px; }
.lcms-icon-btn {
  width: 36px; height: 32px; border-radius: 8px; border: 1px solid rgba(var(--lcms-primary-rgb, 0,200,83),0.3);
  background: rgba(var(--lcms-primary-rgb, 0,200,83),0.1); color: rgba(255,255,255,0.8); cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: all 0.2s;
}
.lcms-icon-btn:hover:not(:disabled) { background: rgba(var(--lcms-primary-rgb, 0,200,83),0.25); border-color: rgba(var(--lcms-primary-rgb, 0,200,83),0.5); color: white; }
.lcms-icon-btn:disabled { opacity: 0.25; cursor: not-allowed; }

/* COLOR THEME PICKER */
.lcms-theme-row {
  display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
  padding: 6px 0;
}
.lcms-theme-label {
  font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.45);
  text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap;
}
.lcms-theme-colors {
  display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
}
.lcms-theme-swatch {
  width: 20px; height: 20px; border-radius: 50%; border: 2px solid transparent;
  cursor: pointer; transition: all 0.2s; position: relative;
}
.lcms-theme-swatch:hover { transform: scale(1.15); }
.lcms-theme-swatch.active { border-color: white; box-shadow: 0 0 8px rgba(255,255,255,0.3); }
.lcms-theme-custom {
  width: 20px; height: 20px; border-radius: 50%; border: 1px dashed rgba(255,255,255,0.3);
  cursor: pointer; overflow: hidden; position: relative;
}
.lcms-theme-custom input {
  position: absolute; inset: -4px; width: 28px; height: 28px; border: none;
  background: transparent; cursor: pointer; opacity: 0;
}
.lcms-theme-custom-preview {
  width: 100%; height: 100%; border-radius: 50%;
  background: conic-gradient(red, yellow, lime, aqua, blue, magenta, red);
}

.lcms-history-btn {
  width: 100%; padding: 7px 12px; border-radius: 8px;
  border: 1px dashed rgba(var(--lcms-primary-rgb, 0,200,83),0.35); background: rgba(var(--lcms-primary-rgb, 0,200,83),0.08);
  color: rgba(255,255,255,0.6); font-size: 12px; font-weight: 500; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  transition: all 0.2s; margin-bottom: 12px; font-family: system-ui, -apple-system, sans-serif;
}
.lcms-history-btn:hover { background: rgba(var(--lcms-primary-rgb, 0,200,83),0.18); border-color: rgba(var(--lcms-primary-rgb, 0,200,83),0.5); color: white; }
.lcms-history-btn.active { background: rgba(var(--lcms-primary-rgb, 0,200,83),0.25); border-color: var(--lcms-primary, #00C853); border-style: solid; color: white; }

.lcms-history-panel { margin-top: 8px; border-top: 1px solid rgba(var(--lcms-primary-rgb, 0,200,83),0.15); padding-top: 10px; }
.lcms-history-title { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
.lcms-history-empty { font-size: 12px; color: rgba(255,255,255,0.3); text-align: center; padding: 12px 0; }
.lcms-history-list { max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.lcms-history-list::-webkit-scrollbar { width: 4px; }
.lcms-history-list::-webkit-scrollbar-track { background: transparent; }
.lcms-history-list::-webkit-scrollbar-thumb { background: rgba(var(--lcms-primary-rgb, 0,200,83),0.3); border-radius: 4px; }
.lcms-history-item {
  width: 100%; text-align: left; background: rgba(var(--lcms-primary-rgb, 0,200,83),0.06);
  border: 1px solid rgba(var(--lcms-primary-rgb, 0,200,83),0.12); border-radius: 8px; padding: 8px 10px;
  cursor: pointer; transition: all 0.2s; color: white; font-family: system-ui, -apple-system, sans-serif;
}
.lcms-history-item:hover { background: rgba(var(--lcms-primary-rgb, 0,200,83),0.15); border-color: rgba(var(--lcms-primary-rgb, 0,200,83),0.3); }
.lcms-history-label { font-size: 12px; font-weight: 500; margin-bottom: 2px; }
.lcms-history-meta { font-size: 10px; color: rgba(255,255,255,0.4); display: flex; align-items: center; gap: 6px; }
.lcms-history-lang { background: rgba(var(--lcms-primary-rgb, 0,200,83),0.2); padding: 1px 5px; border-radius: 3px; font-size: 9px; font-weight: 600; color: rgba(var(--lcms-primary-rgb, 0,200,83),0.75); }

.lcms-actions { display: flex; flex-direction: column; gap: 6px; }
.lcms-actions button {
  width: 100%; padding: 9px 14px; border-radius: 8px; font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; border: none;
  font-family: system-ui, -apple-system, sans-serif;
}
.lcms-btn-save { background: var(--lcms-primary, #00C853); color: white; }
.lcms-btn-save:hover { background: var(--lcms-primary, #00C853); filter: brightness(1.15); }
.lcms-btn-save:disabled { background: rgba(var(--lcms-primary-rgb, 0,200,83),0.2); color: rgba(255,255,255,0.35); cursor: not-allowed; filter: none; }
.lcms-btn-publish { background: linear-gradient(135deg, var(--lcms-primary, #00C853), var(--lcms-primary-dark, #2E7D32)); color: white; }
.lcms-btn-publish:hover { background: linear-gradient(135deg, var(--lcms-primary, #00C853), var(--lcms-primary-dark, #2E7D32)); filter: brightness(1.1); }
.lcms-btn-publish:disabled { background: rgba(var(--lcms-primary-rgb, 0,200,83),0.2); color: rgba(255,255,255,0.35); cursor: not-allowed; filter: none; }
.lcms-btn-cancel { background: transparent; color: rgba(255,255,255,0.5); border: 1px solid rgba(var(--lcms-primary-rgb, 0,200,83),0.25) !important; }
.lcms-btn-cancel:hover { color: white; border-color: rgba(var(--lcms-primary-rgb, 0,200,83),0.5) !important; background: rgba(var(--lcms-primary-rgb, 0,200,83),0.08); }
.lcms-btn-cancel:disabled { opacity: 0.3; cursor: not-allowed; }
.lcms-btn-logout { background: rgba(244,67,54,0.12); color: rgba(244,67,54,0.85); border: 1px solid rgba(244,67,54,0.25) !important; margin-top: 4px; }
.lcms-btn-logout:hover { background: rgba(244,67,54,0.2); color: #f44336; border-color: rgba(244,67,54,0.5) !important; }

.lcms-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: lcmsSpin 0.6s linear infinite; }

/* IMAGE UPLOAD OVERLAY */
.lcms-img-upload-overlay {
  position: fixed; inset: 0; z-index: 10005;
  display: flex; align-items: center; justify-content: center;
  background: rgba(8, 8, 15, 0.5); backdrop-filter: blur(8px);
}
.lcms-img-upload-content {
  display: flex; flex-direction: column; align-items: center; gap: 16px;
  color: white; font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px; font-weight: 600;
}
.lcms-spinner-lg { width: 36px; height: 36px; border: 3px solid rgba(255,255,255,0.2); border-top-color: var(--lcms-primary, #00C853); border-radius: 50%; animation: lcmsSpin 0.6s linear infinite; }

/* LOGIN MODAL */
.lcms-login-overlay {
  position: fixed; inset: 0; z-index: 10010;
  display: flex; align-items: center; justify-content: center;
  background: rgba(8, 8, 15, 0.75);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  font-family: system-ui, -apple-system, sans-serif;
}
.lcms-login-box {
  position: relative;
  background: #13151a; border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px; padding: 36px 32px; width: 340px;
  box-shadow: 0 24px 60px rgba(0,0,0,0.6);
}
.lcms-modal-close-btn {
  position: absolute; top: 12px; right: 12px;
  width: 28px; height: 28px; border-radius: 6px;
  background: rgba(255,255,255,0.08); border: none;
  color: rgba(255,255,255,0.5); font-size: 18px; line-height: 1;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all 0.15s ease;
}
.lcms-modal-close-btn:hover {
  background: rgba(255,255,255,0.15); color: rgba(255,255,255,0.9);
}
.lcms-modal-back-btn {
  position: absolute; top: 12px; left: 12px;
  width: 28px; height: 28px; border-radius: 6px;
  background: rgba(255,255,255,0.08); border: none;
  color: rgba(255,255,255,0.5); font-size: 16px; line-height: 1;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all 0.15s ease;
}
.lcms-modal-back-btn:hover {
  background: rgba(255,255,255,0.15); color: rgba(255,255,255,0.9);
}
.lcms-login-logo {
  display: flex; align-items: center; justify-content: center;
  gap: 8px; margin-bottom: 24px;
}
.lcms-login-logo-icon {
  width: 32px; height: 32px; border-radius: 8px;
  background: linear-gradient(135deg, var(--lcms-primary, #00C853), var(--lcms-primary-dark, #2E7D32));
  display: flex; align-items: center; justify-content: center;
}
.lcms-login-logo-text { color: white; font-size: 15px; font-weight: 700; letter-spacing: 0.5px; }
.lcms-login-title { color: white; font-size: 18px; font-weight: 700; text-align: center; margin-bottom: 6px; }
.lcms-login-sub { color: rgba(255,255,255,0.4); font-size: 12px; text-align: center; margin-bottom: 24px; }
.lcms-login-field { margin-bottom: 14px; }
.lcms-login-label { display: block; color: rgba(255,255,255,0.6); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; }
.lcms-login-input {
  width: 100%; box-sizing: border-box;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px; padding: 10px 12px;
  color: white; font-size: 13px; font-family: inherit; outline: none;
  transition: border-color 0.2s;
}
.lcms-login-input:focus { border-color: var(--lcms-primary, #00C853); }
.lcms-login-input::placeholder { color: rgba(255,255,255,0.25); }
.lcms-password-wrapper { position: relative; display: flex; align-items: center; }
.lcms-password-wrapper .lcms-login-input { padding-right: 40px; width: 100%; }
.lcms-password-toggle {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  background: none; border: none !important; outline: none !important; cursor: pointer; padding: 4px;
  color: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
  transition: color 0.2s; line-height: 0; z-index: 1;
}
.lcms-password-toggle:hover { color: rgba(0,0,0,0.8); }
.lcms-password-toggle svg { display: block; }
.lcms-login-btn {
  width: 100%; padding: 11px; margin-top: 6px; border: none; border-radius: 8px; cursor: pointer;
  background: linear-gradient(135deg, var(--lcms-primary, #00C853), var(--lcms-primary-dark, #2E7D32));
  color: white; font-size: 13px; font-weight: 700; font-family: inherit;
  letter-spacing: 0.3px; transition: filter 0.2s;
}
.lcms-login-btn:hover { filter: brightness(1.1); }
.lcms-login-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.lcms-login-error {
  background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3);
  border-radius: 8px; padding: 9px 12px; color: #f87171;
  font-size: 12px; text-align: center; margin-top: 12px; display: none;
}
.lcms-login-error.visible { display: block; }

/* OTP SCREEN */
.lcms-otp-input { text-align: center !important; font-size: 22px !important; letter-spacing: 10px !important; font-weight: 700 !important; font-family: monospace !important; }
.lcms-otp-timer {
  text-align: center; color: rgba(255,255,255,0.5); font-size: 12px;
  margin: 8px 0 4px;
}
.lcms-otp-resend {
  text-align: center; color: rgba(255,255,255,0.4); font-size: 12px;
  margin-top: 12px;
}
.lcms-otp-resend-btn {
  background: none; border: none; color: var(--lcms-primary, #00C853);
  cursor: pointer; font-size: 12px; font-weight: 600; font-family: inherit;
  text-decoration: underline; padding: 0;
}
.lcms-otp-resend-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.lcms-otp-back-btn {
  display: block; width: 100%; background: none; border: none;
  color: rgba(255,255,255,0.4); font-size: 12px; cursor: pointer;
  padding: 8px 0; margin-top: 8px; font-family: inherit;
  transition: color 0.2s;
}
.lcms-otp-back-btn:hover { color: rgba(255,255,255,0.7); }

/* LICENSE OVERLAY */
.lcms-license-overlay {
  position: fixed; inset: 0; z-index: 10020;
  display: flex; align-items: center; justify-content: center;
  background: rgba(8, 8, 15, 0.85);
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  font-family: system-ui, -apple-system, sans-serif;
}
.lcms-license-box {
  background: #13151a; border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px; padding: 40px 36px; width: 380px; text-align: center;
  box-shadow: 0 24px 60px rgba(0,0,0,0.6);
}
.lcms-license-icon {
  width: 56px; height: 56px; border-radius: 16px; margin: 0 auto 20px;
  background: linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.1));
  border: 1px solid rgba(239,68,68,0.3);
  display: flex; align-items: center; justify-content: center;
}
.lcms-license-icon.trial {
  background: linear-gradient(135deg, rgba(251,191,36,0.2), rgba(251,191,36,0.1));
  border-color: rgba(251,191,36,0.3);
}
.lcms-license-title {
  color: white; font-size: 20px; font-weight: 700; margin-bottom: 8px;
}
.lcms-license-msg {
  color: rgba(255,255,255,0.5); font-size: 13px; line-height: 1.6; margin-bottom: 24px;
}
.lcms-license-btn {
  display: inline-block; padding: 11px 28px; border: none; border-radius: 8px; cursor: pointer;
  background: linear-gradient(135deg, var(--lcms-primary, #00C853), var(--lcms-primary-dark, #2E7D32));
  color: white; font-size: 13px; font-weight: 700; font-family: inherit;
  letter-spacing: 0.3px; transition: filter 0.2s; text-decoration: none;
}
.lcms-license-btn:hover { filter: brightness(1.1); }
.lcms-license-sub {
  color: rgba(255,255,255,0.3); font-size: 11px; margin-top: 16px;
}
.lcms-license-sub a { color: rgba(var(--lcms-primary-rgb, 0,200,83),0.7); text-decoration: none; }
.lcms-license-sub a:hover { text-decoration: underline; }

/* TRIAL BANNER */
.lcms-trial-banner {
  display: flex; align-items: center; gap: 6px;
  background: rgba(251,191,36,0.12); border: 1px solid rgba(251,191,36,0.3);
  border-radius: 8px; padding: 6px 10px; margin-bottom: 10px;
  font-size: 11px; font-weight: 600; color: #fbbf24;
}
.lcms-trial-banner-icon { font-size: 14px; }
.lcms-trial-banner-text { flex: 1; }
.lcms-trial-banner-dismiss {
  background: none; border: none; color: rgba(251,191,36,0.5); cursor: pointer;
  padding: 0; font-size: 14px; line-height: 1; transition: color 0.2s;
}
.lcms-trial-banner-dismiss:hover { color: #fbbf24; }

/* RICH TEXT TOOLBAR */
.lcms-rich-toolbar {
  position: fixed; z-index: 10010;
  display: flex; align-items: center; gap: 2px;
  padding: 4px 6px;
  background: rgba(30, 15, 60, 0.92);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(var(--lcms-primary-rgb, 0,200,83), 0.3);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  opacity: 0; transform: translateY(8px);
  transition: opacity 0.15s, transform 0.15s;
  pointer-events: none;
  font-family: system-ui, -apple-system, sans-serif;
}
.lcms-rich-toolbar.visible { opacity: 1; transform: translateY(0); pointer-events: auto; }
.lcms-rich-toolbar button {
  width: 28px; height: 28px; border: none; border-radius: 4px;
  background: transparent; color: #d0d0d0; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; padding: 0;
  transition: background 0.15s, color 0.15s;
}
.lcms-rich-toolbar button:hover { background: rgba(var(--lcms-primary-rgb, 0,200,83), 0.3); color: #fff; }
.lcms-rich-toolbar button.active { background: rgba(var(--lcms-primary-rgb, 0,200,83), 0.5); color: #fff; }
.lcms-rich-toolbar .lcms-tb-sep { width: 1px; height: 18px; background: rgba(255,255,255,0.12); margin: 0 3px; flex-shrink: 0; }

/* HIDDEN ELEMENTS */
.lcms-hidden { display: none !important; }

/* EDIT MODE — keep animations running, just make CMS elements editable */
body.lcms-editing [data-cms] {
  user-select: text !important;
  -webkit-user-select: text !important;
  cursor: text !important;
}
`;
