import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { MAX_UPLOAD_BYTES } from './uploads.service';

/** Champ multipart « file » contenant une image, gardé en mémoire le temps du traitement. */
export const ImageUpload = () =>
  applyDecorators(
    UseInterceptors(
      // Sans « dest », multer garde le fichier en mémoire.
      FileInterceptor('file', {
        limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
      }),
    ),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
    }),
  );
