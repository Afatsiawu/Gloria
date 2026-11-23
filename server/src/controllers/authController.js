import * as authService from '../services/authService.js';
import { signToken, setAuthCookie, clearAuthCookie } from '../middleware/auth.js';
import { asyncHandler } from '../utils/http.js';
import { listNotifications } from '../services/notificationService.js';

export const csrf = (req, res) => res.json({ csrfToken: req.csrfToken, csrfSignature: req.csrfSignature });

export const register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.body, req.ip);
  setAuthCookie(res, signToken(user));
  res.status(201).json({ user });
});

export const login = asyncHandler(async (req, res) => {
  const user = await authService.login(req.body, req.ip);
  setAuthCookie(res, signToken(user));
  res.json({ user });
});

export const logout = (req, res) => {
  clearAuthCookie(res);
  res.json({ message: 'Signed out.' });
};

export const me = (req, res) => res.json({ user: authService.publicUser(req.user) });

export const forgotPassword = asyncHandler(async (req, res) => {
  res.json(await authService.forgotPassword(req.body));
});

export const resetPassword = asyncHandler(async (req, res) => {
  res.json(await authService.resetPassword(req.body, req.ip));
});

export const requestOrderLink = asyncHandler(async (req, res) => {
  res.json(await authService.requestOrderLink(req.user.id));
});

export const verifyOrderLink = asyncHandler(async (req, res) => {
  res.json(await authService.verifyOrderLink(req.user.id, req.body.code));
});

export const updateProfile = asyncHandler(async (req, res) => {
  res.json({ user: authService.updateProfile(req.user.id, req.body, req.ip) });
});

export const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
  res.json({ message: 'Password updated.' });
});

export const exportData = (req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="my-pharmalink-data.json"');
  res.json(authService.exportMyData(req.user.id));
};

export const requestDeletion = asyncHandler(async (req, res) => {
  res.status(202).json({
    request: authService.requestDeletion(req.user.id),
    message: 'Your deletion request has been logged. An administrator will process it within 30 days.',
  });
});

export const myNotifications = (req, res) => {
  res.json({ items: listNotifications(req.user.id, { pageSize: 100 }) });
};
