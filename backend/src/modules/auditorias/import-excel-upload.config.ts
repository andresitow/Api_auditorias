import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import { extname } from 'path';

const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
];
const ALLOWED_EXTENSIONS = ['.xlsx'];

/** memoryStorage: el archivo se parsea en memoria con exceljs (import-excel.service.ts)
 * y se descarta, no queda persistido en disco como sí ocurre con las evidencias. */
export const importExcelMulterOptions = {
  storage: memoryStorage(),
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    callback: (error: Error | null, accept: boolean) => void,
  ) => {
    const ext = extname(file.originalname).toLowerCase();
    if (
      !ALLOWED_MIME_TYPES.includes(file.mimetype) &&
      !ALLOWED_EXTENSIONS.includes(ext)
    ) {
      callback(
        new BadRequestException('El archivo debe ser un Excel (.xlsx)'),
        false,
      );
      return;
    }
    callback(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
};
