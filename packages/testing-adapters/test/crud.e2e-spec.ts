import { Test, TestingModule } from '@nestjs/testing';
import {
    INestApplication,
    ValidationPipe,
    VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { KoaAdapter } from '@nestjs-adapters/koa';
import { PolkaAdapter } from '@nestjs-adapters/polka';
import { RestanaAdapter } from '@nestjs-adapters/restana';
import { HyperExpressAdapter } from '@nestjs-adapters/hyper-express';

const Adapters = [KoaAdapter, PolkaAdapter, RestanaAdapter];

Adapters.forEach((Adapter) => {
    describe(`CRUD ${Adapter.name} (e2e)`, () => {
        let app: INestApplication;

        beforeEach(async () => {
            const moduleFixture: TestingModule = await Test.createTestingModule(
                {
                    imports: [AppModule],
                },
            ).compile();

            app = moduleFixture.createNestApplication(new Adapter());
            app.setGlobalPrefix('api');
            app.enableVersioning({
                type: VersioningType.URI,
            });
            app.useGlobalPipes(new ValidationPipe());
            await app.init();
        });

        afterEach(async () => {
            app && (await app.close());
            app = null;
        });

        it('/api/v1/resources (GET)', (done) => {
            request(app.getHttpServer())
                .get('/api/v1/resources')
                .expect(200)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.text).toEqual('Hello World!V1');
                    return done();
                });
        });

        it('/api/v2/resources (GET)', (done) => {
            request(app.getHttpServer())
                .get('/api/v2/resources')
                .expect(200)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.text).toEqual('Hello World!V2');
                    return done();
                });
        });
    });
});
