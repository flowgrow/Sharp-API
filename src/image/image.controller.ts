import path from 'node:path';
import { isString } from '@carry0987/utils';
import {
    BadRequestException,
    Controller,
    Get,
    Headers,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Res,
    UploadedFile,
    UseInterceptors
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { ImageFormat } from '@/common/type/types';
import { UtilsService } from '@/common/utils/utils.service';
import { CacheService } from '@/service/cache.service';
import { ImageFetchService } from '@/service/image-fetch.service';
import { ImageProcessingService } from '@/service/image-processing.service';
import { ParserService } from '@/service/parser.service';
import { SignatureService } from '@/service/signature.service';

@Controller()
export class ImageController {
    private readonly imageDebug: boolean;
    private readonly autoDetectWebp: boolean;

    constructor(
        private readonly imageProcessingService: ImageProcessingService,
        private readonly utilsService: UtilsService,
        private readonly cacheService: CacheService,
        private readonly parserService: ParserService,
        private readonly imageFetchService: ImageFetchService,
        private readonly signatureService: SignatureService,
        private readonly configService: ConfigService
    ) {
        this.imageDebug = this.configService.get<boolean>('IMAGE_DEBUG', false);
        this.autoDetectWebp = this.configService.get<boolean>('AUTO_DETECT_WEBP', false);
    }

    @Get('/:signature/:processing_options/enc/:encrypted{/:extension}')
    public async processImage(
        @Param('signature') signature: string,
        @Param('processing_options') processingOptions: string,
        @Param('encrypted') encrypted: string,
        @Param('extension') extension: string,
        @Headers('accept') acceptHeader: string,
        @Headers('if-none-match') clientETag: string,
        @Res() res: Response
    ) {
        const encPath: string = `/${processingOptions}/enc/${encrypted}/${extension || ''}`;

        if (!this.signatureService.decodeAndVerifySignature(signature, encPath)) {
            res.status(HttpStatus.FORBIDDEN).send('Invalid signature');
            return;
        }

        const encryptedDecoded: Buffer = this.utilsService.base64urlDecode(encrypted);
        const sourceURL: string = this.utilsService.decryptSourceURL(encryptedDecoded);

        try {
            const { imageBuffer, format: sourceFormat, filePath } = await this.imageFetchService.fetchImage(sourceURL);
            await this.processAndRespond({
                res,
                acceptHeader,
                clientETag,
                processingOptions,
                extension,
                imageBuffer,
                sourceFormat,
                sourceReference: sourceURL,
                filePath
            });
        } catch (error) {
            const errorMsg = this.imageDebug
                ? `Error processing the image: ${(error as Error).stack}`
                : 'Unknown error occurred while processing the image';
            this.utilsService.handleResponse(res, HttpStatus.INTERNAL_SERVER_ERROR, errorMsg, errorMsg, error as Error);
            if (!this.imageDebug && !res.headersSent) {
                await this.imageProcessingService.sendBlankImage(res);
            }
        }
    }

    @Post('/upload/:processing_options{/:extension}')
    @HttpCode(HttpStatus.OK)
    @UseInterceptors(FileInterceptor('file'))
    public async processUploadedImage(
        @Param('processing_options') processingOptions: string,
        @Param('extension') extension: string,
        @Headers('accept') acceptHeader: string,
        @UploadedFile()
        file:
            | {
                  buffer: Buffer;
                  originalname?: string;
                  mimetype?: string;
              }
            | undefined,
        @Res() res: Response
    ) {
        if (!file?.buffer) {
            throw new BadRequestException('File upload is required. Send multipart/form-data with a "file" field.');
        }

        try {
            const sourceFormat = await this.parserService.parseImageFormatFromBuffer(file.buffer, file.originalname, file.mimetype);

            await this.processAndRespond({
                res,
                acceptHeader,
                clientETag: '',
                processingOptions,
                extension,
                imageBuffer: file.buffer,
                sourceFormat,
                sourceReference: file.originalname || 'uploaded-file'
            });
        } catch (error) {
            const errorMsg = this.imageDebug
                ? `Error processing the image: ${(error as Error).stack}`
                : 'Unknown error occurred while processing the image';
            this.utilsService.handleResponse(res, HttpStatus.INTERNAL_SERVER_ERROR, errorMsg, errorMsg, error as Error);
            if (!this.imageDebug && !res.headersSent) {
                await this.imageProcessingService.sendBlankImage(res);
            }
        }
    }

    private async processAndRespond(options: {
        res: Response;
        acceptHeader?: string;
        clientETag?: string;
        processingOptions: string;
        extension?: string;
        imageBuffer: Buffer;
        sourceFormat?: ImageFormat;
        sourceReference: string;
        filePath?: string;
    }): Promise<void> {
        const {
            res,
            acceptHeader = '',
            clientETag = '',
            processingOptions,
            extension,
            imageBuffer,
            sourceFormat,
            sourceReference,
            filePath
        } = options;
        const { width, height, suffix } = this.parserService.parseProcessingOptions(processingOptions);
        let format: ImageFormat | undefined = extension ? this.parserService.parseFormatFromExtension(extension) : sourceFormat;

        if (this.autoDetectWebp && acceptHeader.includes('image/webp')) {
            format = 'webp';
        }

        if (isString(filePath)) {
            this.cacheService.setResponse(res);
            const { cachedPath, eTag } = await this.cacheService.handleCache({
                fingerPrint: {
                    imageBuffer,
                    sourceFormat,
                    format,
                    width,
                    height,
                    suffix
                },
                sourceURL: sourceReference,
                clientETag
            });
            if (eTag) {
                res.setHeader('ETag', eTag);
            }
            if (cachedPath) {
                res.type(`image/${format || 'jpeg'}`);
                res.sendFile(path.resolve(cachedPath));
                this.utilsService.handleResponse(null, HttpStatus.OK, `Sent cached image for ${cachedPath}`);

                return;
            }
        }

        const processedImage = await this.imageProcessingService.processImage(imageBuffer, width, height, format);
        res.type(`image/${processedImage.format}`).end(processedImage.buffer);
        this.utilsService.handleResponse(null, HttpStatus.OK, `Processed and sent image for ${sourceReference}`);

        if (isString(filePath)) {
            const savePathInfo = await this.imageProcessingService.getImageSavePath({
                sourcePath: sourceReference,
                format: processedImage.format,
                originalFormat: processedImage.originalFormat,
                suffix
            });
            await this.imageProcessingService.saveProcessedImage(processedImage.buffer, savePathInfo);
            await this.cacheService.setCache(sourceReference, {
                imageBuffer,
                format,
                width,
                height,
                suffix
            });
        }
    }
}
