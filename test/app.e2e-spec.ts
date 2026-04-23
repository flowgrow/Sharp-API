import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import sharp from 'sharp';
import { AppModule } from '@/app.module';

describe('AppController (e2e)', () => {
    let app: INestApplication;

    beforeEach(async () => {
        process.env.IMAGE_KEY = '691e523490bf50a5323572fff18c2dc0625c69dc449be7bc3ecf47840f17a85b';
        process.env.IMAGE_SALT = 'ca0d2b3a2b990217cb336ef159fac050f54216d6dacc53509254e23abb1a8b06';
        process.env.SOURCE_URL_ENCRYPTION_KEY = '44a7df0a146489a9b8e5d3cec4a38e2f84ab8b65f9e6e4af316f0d92044f7df7';

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule]
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    afterEach(async () => {
        await app.close();
        jest.restoreAllMocks();
    });

    it('/ (GET)', () => {
        return request(app.getHttpServer()).get('/').expect(200).expect('Welcome to the Sharp API !');
    });

    it('/guyg/rs:300:300/enc/dqwd (GET)', () => {
        return request(app.getHttpServer()).get('/guyg/rs:300:300/enc/dqwd').expect(403).expect('Invalid signature');
    });

    it('/upload/rs:20:20/png (POST)', async () => {
        const imageBuffer = await sharp({
            create: {
                width: 40,
                height: 30,
                channels: 3,
                background: { r: 255, g: 0, b: 0 }
            }
        })
            .jpeg()
            .toBuffer();

        const response = await request(app.getHttpServer())
            .post('/upload/rs:20:20/png')
            .attach('file', imageBuffer, {
                filename: 'fixture.jpg',
                contentType: 'image/jpeg'
            })
            .expect(200);

        expect(response.headers['content-type']).toContain('image/png');
        const metadata = await sharp(response.body).metadata();
        expect(metadata.format).toBe('png');
        expect(metadata.width).toBe(20);
        expect(metadata.height).toBe(20);
    });

    it('/upload/rs:20:20/webp?quality=30 (POST)', async () => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
        const imageBuffer = await sharp({
            create: {
                width: 80,
                height: 60,
                channels: 3,
                background: { r: 0, g: 255, b: 0 }
            }
        })
            .jpeg()
            .toBuffer();

        const response = await request(app.getHttpServer())
            .post('/upload/rs:20:20/webp?quality=30')
            .attach('file', imageBuffer, {
                filename: 'fixture.jpg',
                contentType: 'image/jpeg'
            })
            .expect(200);

        expect(response.headers['content-type']).toContain('image/webp');
        const metadata = await sharp(response.body).metadata();
        expect(metadata.format).toBe('webp');
        expect(metadata.width).toBe(20);
        expect(metadata.height).toBe(20);
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"event":"image_request"'));
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"fileName":"fixture.jpg"'));
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"outputFormat":"webp"'));
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"quality":30'));
    });

    it('/upload/rs:20:20/png without file (POST)', () => {
        return request(app.getHttpServer())
            .post('/upload/rs:20:20/png')
            .expect(400)
            .expect(({ body }) => {
                expect(body.message).toBe('File upload is required. Send multipart/form-data with a "file" field.');
                expect(body.statusCode).toBe(400);
            });
    });
});
