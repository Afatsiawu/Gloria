import * as cartService from '../services/cartService.js';

export const get = (req, res) => res.json({ cart: cartService.getCart(req.user.id) });
export const add = (req, res) => res.json({ cart: cartService.addItem(req.user.id, req.body) });
export const update = (req, res) => res.json({ cart: cartService.updateItem(req.user.id, req.params.itemId, req.body.quantity) });
export const remove = (req, res) => res.json({ cart: cartService.removeItem(req.user.id, req.params.itemId) });
export const clear = (req, res) => res.json({ cart: cartService.clear(req.user.id) });
