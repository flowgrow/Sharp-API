import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UtilsService } from './common/utils/utils.service';
import { ImageController } from './image/image.controller';
import { CacheService } from './service/cache.service';
import { ImageFetchService } from './service/image-fetch.service';
import { ImageProcessingService } from './service/image-processing.service';
import { ParserService } from './service/parser.service';
import { ShutdownService } from './service/shutdown.service';
import { SignatureService } from './service/signature.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            envFilePath: ['.env', '.env.local']
        }),
        CacheModule.register()
    ],
    controllers: [AppController, ImageController],
    providers: [
        AppService,
        ShutdownService,
        UtilsService,
        ParserService,
        CacheService,
        ImageProcessingService,
        ImageFetchService,
        SignatureService
    ]
})
export class AppModule {}
