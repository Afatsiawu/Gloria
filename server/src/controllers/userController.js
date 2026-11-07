import * as userService from '../services/userService.js';
import { paged, pagination } from '../utils/pagination.js';
import { asyncHandler } from '../utils/http.js';

export const list = (req, res) => {
  const { page, pageSize, offset } = pagination(req.query);
  const { items, total } = userService.listUsers({ ...req.query, pageSize, offset });
  res.json(paged(items, total, page, pageSize));
};

export const create = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.body, req.user.id, req.ip);
  res.status(201).json({ user });
});

export const update = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body, req.user.id, req.ip);
  res.json({ user });
});

export const suspend = (req, res) => {
  res.json({ user: userService.setUserActive(req.params.id, false, req.user.id, req.ip) });
};

export const activate = (req, res) => {
  res.json({ user: userService.setUserActive(req.params.id, true, req.user.id, req.ip) });
};

export const dataRequests = (_req, res) => res.json({ items: userService.dataRequests() });

export const processDataRequest = (req, res) => {
  res.json({ request: userService.processDataRequest(req.params.id, req.user.id, req.ip) });
};
