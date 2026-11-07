import * as service from '../services/analyticsService.js';

export const summary = (req, res) => res.json(service.summary(req.user, req.query));
export const forecast = (req, res) => res.json(service.forecast(req.user, req.query));
