import { promises as fsPromises } from 'node:fs';
import { extname } from 'node:path';
import { Injectable } from '@nestjs/common';
import type { ImageFormat, ImageOption } from '@/common/type/types';

@Injectable()
export class ParserService {
    public parseFormatFromExtension(extension?: string): ImageFormat | undefined {
        if (!extension) return undefined;

        return extension.toLowerCase() as ImageFormat;
    }

    public parseFormatFromMimeType(mimeType?: string): ImageFormat | undefined {
        if (!mimeType || !mimeType.startsWith('image/')) {
            return undefined;
        }

        return this.parseFormatFromExtension(mimeType.split('/')[1]);
    }

    public async parseImageFormat(sourcePath: string): Promise<ImageFormat | undefined> {
        let format: ImageFormat | undefined = this.parseFormatFromExtension(extname(sourcePath).substring(1));

        if (!format) {
            try {
                const buffer = await fsPromises.readFile(sourcePath);
                const fileType = await import('file-type');
                const fileTypeResult = await fileType.fileTypeFromBuffer(buffer);
                format = fileTypeResult?.ext as ImageFormat;
            } catch (error) {
                console.error('Error determining image format:', error);
                format = undefined;
            }
        }

        return format;
    }

    public async parseImageFormatFromBuffer(buffer: Buffer, fileName?: string, mimeType?: string): Promise<ImageFormat | undefined> {
        const formatFromMimeType = this.parseFormatFromMimeType(mimeType);
        if (formatFromMimeType) {
            return formatFromMimeType;
        }

        const formatFromFileName = this.parseFormatFromExtension(extname(fileName || '').substring(1));
        if (formatFromFileName) {
            return formatFromFileName;
        }

        try {
            const fileType = await import('file-type');
            const fileTypeResult = await fileType.fileTypeFromBuffer(buffer);

            return fileTypeResult?.ext as ImageFormat | undefined;
        } catch (error) {
            console.error('Error determining uploaded image format:', error);

            return undefined;
        }
    }

    public parseProcessingOptions(processingOptions: string): ImageOption {
        let width: number | undefined;
        let height: number | undefined;
        let suffix: string | undefined;

        processingOptions.split('/').forEach((option) => {
            const parts = option.split(':');
            if (parts[0] === 'rs') {
                if (parts.length === 3) {
                    const parsedWidth = parseInt(parts[1], 10);
                    const parsedHeight = parseInt(parts[2], 10);
                    width = !Number.isNaN(parsedWidth) && parsedWidth !== 0 ? parsedWidth : undefined;
                    height = !Number.isNaN(parsedHeight) && parsedHeight !== 0 ? parsedHeight : undefined;
                } else if (parts.length === 4) {
                    const parsedWidth = parseInt(parts[1], 10);
                    const parsedHeight = parseInt(parts[2], 10);
                    suffix = parts[3];
                    width = !Number.isNaN(parsedWidth) && parsedWidth !== 0 ? parsedWidth : undefined;
                    height = !Number.isNaN(parsedHeight) && parsedHeight !== 0 ? parsedHeight : undefined;
                }
            }
        });

        return { width, height, suffix };
    }
}
