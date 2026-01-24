import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';

describe('AppController (e2e)', () => {
    let app: INestApplication;

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule]
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    it('/ (GET)', () => {
        return request(app.getHttpServer()).get('/').expect(200).expect('Welcome to the Sharp API !');
    });

    it('/guyg/rs:300:300/enc/dqwd (GET)', () => {
        return request(app.getHttpServer()).get('/guyg/rs:300:300/enc/dqwd').expect(403).expect('Invalid signature');
    });
});
