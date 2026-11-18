import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import * as orderService from '../services/orderService.js';
import * as prescriptionService from '../services/prescriptionService.js';
import { config } from '../config.js';
import { asyncHandler } from '../utils/http.js';

const uploadSchema = z.object({
  reference: z.string().trim().min(4).max(40),
  phone: z.string().trim().min(7).max(20),
});

function removeUploaded(file) {
  if (file?.filename) fs.rmSync(path.join(config.prescriptionsDir, file.filename), { force: true });
}

export const place = asyncHandler(async (req, res) => {
  const order = await orderService.placeGuestOrder(req.body, req.ip);
  res.status(201).json({ order });
});

export const uploadPrescription = asyncHandler(async (req, res) => {
  const parsed = uploadSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    removeUploaded(req.file);
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Some fields are invalid. Please check and try again.',
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
  }
  try {
    const prescription = await prescriptionService.uploadForGuest(
      req.params.id,
      parsed.data,
      req.file,
      req.ip
    );
    res.status(201).json({ prescription });
  } catch (err) {
    removeUploaded(req.file);
    throw err;
  }
});

export const track = (req, res) => {
  res.json({ order: orderService.trackOrder(req.body) });
};
