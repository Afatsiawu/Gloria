import { dashboard } from '../services/dashboardService.js';

export const get = (req, res) => res.json(dashboard(req.user));
