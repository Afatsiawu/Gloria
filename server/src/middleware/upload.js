import multer from 'multer';
import path from 'node:path';
import { config } from '../config.js';
import { randomFileName } from '../utils/reference.js';
import { badRequest } from '../utils/http.js';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.prescriptionsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || (file.mimetype === 'application/pdf' ? '.pdf' : '.jpg');
    cb(null, randomFileName(ext));
  },
});

export const uploadPrescription = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(badRequest('Upload a JPG, PNG, WEBP image or a PDF prescription.'));
    }
    cb(null, true);
  },
}).single('file');
